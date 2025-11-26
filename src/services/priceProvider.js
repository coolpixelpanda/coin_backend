const logger = require('../logger');

const DEFAULT_TTL = Number(process.env.PRICE_CACHE_TTL_MS || 60000); // 60s

const assets = [
  { id: 1, symbol: 'BTC', coingeckoId: 'bitcoin' },
  { id: 2, symbol: 'ETH', coingeckoId: 'ethereum' },
  { id: 3, symbol: 'USDT', coingeckoId: 'tether' }
];

const symbolToCoingecko = assets.reduce((acc, a) => { acc[a.symbol] = a.coingeckoId; return acc; }, {});

const cache = {
  data: null, // [{ Id, Category, Price }]
  fetchedAt: 0,
  inFlight: null
};

async function fetchFromCoinGecko() {
  const idsParam = assets.map((a) => a.coingeckoId).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`;

  const headers = { accept: 'application/json' };
  // Optional API key if provided (no guessing header names)
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-api-key'] = process.env.COINGECKO_API_KEY; // Will be ignored if not supported
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const err = new Error(`Price source error: ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();

  const payload = assets.map((a) => ({
    Id: a.id,
    Category: a.symbol,
    Price: Number(data?.[a.coingeckoId]?.usd ?? 0)
  }));
  return payload;
}

async function refreshCache() {
  if (cache.inFlight) return cache.inFlight;
  cache.inFlight = (async () => {
    try {
      const data = await fetchFromCoinGecko();
      cache.data = data;
      cache.fetchedAt = Date.now();
      logger.info({ count: data.length }, 'Price cache refreshed');
      return data;
    } finally {
      cache.inFlight = null;
    }
  })();
  return cache.inFlight;
}

function isFresh(ttlMs = DEFAULT_TTL) {
  return cache.data && Date.now() - cache.fetchedAt < ttlMs;
}

async function getAllPrices(ttlMs = DEFAULT_TTL, customSymbols = null) {
  // If custom symbols provided, fetch those instead of cached assets
  if (customSymbols && Array.isArray(customSymbols) && customSymbols.length > 0) {
    try {
      // Map symbols to CoinGecko IDs
      const symbolToCoingeckoMap = {
        'BTC': 'bitcoin',
        'TBTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'SOL': 'solana',
        'ADA': 'cardano',
        'XRP': 'ripple',
        'DOGE': 'dogecoin',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'AVAX': 'avalanche-2',
        'LINK': 'chainlink',
        'UNI': 'uniswap',
        'LTC': 'litecoin',
        'BCH': 'bitcoin-cash',
        'ATOM': 'cosmos',
        'ALGO': 'algorand',
        'VET': 'vechain',
        'FIL': 'filecoin',
        'TRX': 'tron',
        'ETC': 'ethereum-classic',
        'XLM': 'stellar',
        'EOS': 'eos',
        'AAVE': 'aave',
        'MKR': 'maker',
        'COMP': 'compound-governance-token',
        'YFI': 'yearn-finance',
        'SUSHI': 'sushi',
        'SNX': 'havven',
        'CRV': 'curve-dao-token',
        '1INCH': '1inch',
        'BAT': 'basic-attention-token',
        'ZRX': '0x',
        'ENJ': 'enjincoin',
        'MANA': 'decentraland',
        'SAND': 'the-sandbox',
        'AXS': 'axie-infinity',
        'GALA': 'gala',
        'CHZ': 'chiliz',
        'FLOW': 'flow',
        'NEAR': 'near',
        'FTM': 'fantom',
        'HBAR': 'hedera-hashgraph',
        'EGLD': 'elrond-erd-2',
        'THETA': 'theta-token',
        'ZIL': 'zilliqa',
        'IOTA': 'iota',
        'WAVES': 'waves',
        'XTZ': 'tezos',
        'DASH': 'dash',
        'ZEC': 'zcash',
        'XMR': 'monero',
        'GRT': 'the-graph',
        'RUNE': 'thorchain',
        'LUNA': 'terra-luna',
        'UST': 'terrausd'
      };
      
      const coingeckoIds = customSymbols
        .map(s => symbolToCoingeckoMap[String(s).toUpperCase()])
        .filter(Boolean);
      
      if (coingeckoIds.length === 0) {
        return { data: [], stale: false };
      }
      
      const idsParam = coingeckoIds.join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`;
      const headers = { accept: 'application/json' };
      if (process.env.COINGECKO_API_KEY) {
        headers['x-cg-api-key'] = process.env.COINGECKO_API_KEY;
      }
      
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        throw new Error(`CoinGecko API error: ${resp.status}`);
      }
      
      const data = await resp.json();
      const reverseMap = Object.fromEntries(
        Object.entries(symbolToCoingeckoMap).map(([k, v]) => [v, k])
      );
      
      const payload = customSymbols.map((symbol, index) => {
        const upperSymbol = String(symbol).toUpperCase();
        const coingeckoId = symbolToCoingeckoMap[upperSymbol];
        const price = coingeckoId ? Number(data?.[coingeckoId]?.usd ?? 0) : 0;
        return {
          Id: index + 1,
          Category: upperSymbol,
          Price: price
        };
      });
      
      return { data: payload, stale: false };
    } catch (err) {
      logger.warn({ err: err.message, symbols: customSymbols }, 'Failed to fetch custom prices');
      throw err;
    }
  }
  
  // Use cached assets (default behavior)
  if (isFresh(ttlMs)) {
    return { data: cache.data, stale: false };
  }
  try {
    const data = await refreshCache();
    return { data, stale: false };
  } catch (err) {
    if (cache.data) {
      logger.warn({ err: err.message }, 'Serving stale prices due to provider error');
      return { data: cache.data, stale: true };
    }
    throw err;
  }
}

async function getPriceForSymbol(symbol, ttlMs = DEFAULT_TTL) {
  const target = String(symbol).toUpperCase();
  
  // First try to get from cache
  const result = await getAllPrices(ttlMs);
  const entry = result.data.find((p) => String(p.Category).toUpperCase() === target);
  
  if (entry) {
    return { price: entry.Price, stale: result.stale };
  }
  
  // If not in cache, try to fetch directly from CoinGecko
  // Map common symbols to CoinGecko IDs
  const symbolToCoingeckoMap = {
    'BTC': 'bitcoin',
    'TBTC': 'bitcoin', // Testnet BTC uses same price
    'ETH': 'ethereum',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'ADA': 'cardano',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'ATOM': 'cosmos',
    'ALGO': 'algorand',
    'VET': 'vechain',
    'FIL': 'filecoin',
    'TRX': 'tron',
    'ETC': 'ethereum-classic',
    'XLM': 'stellar',
    'EOS': 'eos',
    'AAVE': 'aave',
    'MKR': 'maker',
    'COMP': 'compound-governance-token',
    'YFI': 'yearn-finance',
    'SUSHI': 'sushi',
    'SNX': 'havven',
    'CRV': 'curve-dao-token',
    '1INCH': '1inch',
    'BAT': 'basic-attention-token',
    'ZRX': '0x',
    'ENJ': 'enjincoin',
    'MANA': 'decentraland',
    'SAND': 'the-sandbox',
    'AXS': 'axie-infinity',
    'GALA': 'gala',
    'CHZ': 'chiliz',
    'FLOW': 'flow',
    'NEAR': 'near',
    'FTM': 'fantom',
    'HBAR': 'hedera-hashgraph',
    'EGLD': 'elrond-erd-2',
    'THETA': 'theta-token',
    'ZIL': 'zilliqa',
    'IOTA': 'iota',
    'WAVES': 'waves',
    'XTZ': 'tezos',
    'DASH': 'dash',
    'ZEC': 'zcash',
    'XMR': 'monero',
    'GRT': 'the-graph',
    'RUNE': 'thorchain',
    'LUNA': 'terra-luna',
    'UST': 'terrausd'
  };
  
  const coingeckoId = symbolToCoingeckoMap[target];
  
  if (!coingeckoId) {
    const err = new Error(`Symbol "${target}" not supported. Please add it to the database or priceProvider.`);
    err.status = 400;
    throw err;
  }
  
  // Fetch price directly from CoinGecko
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const headers = { accept: 'application/json' };
    if (process.env.COINGECKO_API_KEY) {
      headers['x-cg-api-key'] = process.env.COINGECKO_API_KEY;
    }
    
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`CoinGecko API error: ${resp.status}`);
    }
    
    const data = await resp.json();
    const price = Number(data?.[coingeckoId]?.usd ?? 0);
    
    if (price === 0) {
      throw new Error(`Price not available for ${target}`);
    }
    
    return { price, stale: false };
  } catch (err) {
    logger.warn({ symbol: target, error: err.message }, 'Failed to fetch price for symbol');
    throw err;
  }
}

module.exports = {
  getAllPrices,
  getPriceForSymbol,
  assets,
  symbolToCoingecko
};

