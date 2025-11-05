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

async function getAllPrices(ttlMs = DEFAULT_TTL) {
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
  const result = await getAllPrices(ttlMs);
  const target = String(symbol).toUpperCase();
  const entry = result.data.find((p) => String(p.Category).toUpperCase() === target);
  if (!entry) {
    const err = new Error('Symbol not supported');
    err.status = 400;
    throw err;
  }
  return { price: entry.Price, stale: result.stale };
}

module.exports = {
  getAllPrices,
  getPriceForSymbol,
  assets,
  symbolToCoingecko
};

