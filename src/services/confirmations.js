const logger = require('../logger');

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url, headers, retries = 3, baseDelayMs = 300) {
  let attempt = 0;
  const defaultHeaders = { accept: 'application/json', 'user-agent': 'txWatcher/1.0 (+node-fetch)' };
  while (true) {
    const resp = await fetch(url, { headers: { ...defaultHeaders, ...(headers || {}) } });
    if (resp.ok) return resp.json();
    const status = resp.status;
    if ((status === 429 || status >= 500) && attempt < retries) {
      const retryAfter = Number(resp.headers.get('retry-after') || '0') * 1000;
      const jitter = Math.floor(Math.random() * 150);
      const delay = Math.max(retryAfter, baseDelayMs * Math.pow(2, attempt)) + jitter;
      attempt += 1;
      await sleep(delay);
      continue;
    }
    const err = new Error(`Provider error ${status}`);
    err.status = status;
    throw err;
  }
}

function providersForNetwork(network) {
  const order = (process.env.BTC_CONFIRMATION_PROVIDERS || 'blockstream,mempool,blockcypher')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const list = [];
  for (const name of order) {
    if (name === 'blockstream') {
      list.push({ name: 'blockstream', type: 'esplora', base: network === 'testnet' ? 'https://blockstream.info/testnet/api' : 'https://blockstream.info/api' });
    } else if (name === 'mempool') {
      list.push({ name: 'mempool', type: 'esplora', base: network === 'testnet' ? 'https://mempool.space/testnet/api' : 'https://mempool.space/api' });
    } else if (name === 'blockcypher') {
      list.push({ name: 'blockcypher', type: 'blockcypher', base: network === 'testnet' ? 'https://api.blockcypher.com/v1/btc/test3' : 'https://api.blockcypher.com/v1/btc/main' });
    }
  }
  return list;
}

async function readAddressStats(provider, address) {
  if (provider.type === 'esplora') {
    const stats = await fetchJson(`${provider.base}/address/${address}`);
    const confirmedReceived = Number(stats?.chain_stats?.funded_txo_sum || 0);
    const mempoolReceived = Number(stats?.mempool_stats?.funded_txo_sum || 0);
    return { confirmedReceived, mempoolReceived };
  }
  if (provider.type === 'blockcypher') {
    const stats = await fetchJson(`${provider.base}/addrs/${address}/balance`);
    const confirmedReceived = Number(stats?.total_received || 0);
    const mempoolReceived = Math.max(0, Number(stats?.unconfirmed_balance || 0));
    return { confirmedReceived, mempoolReceived };
  }
  throw new Error('Unknown provider type');
}

// BTC via Blockstream address summary
// Returns detailed stats and decision for diagnostics
async function checkBtcPayment(address, amountBtc, minConfs = 1) {
  if (!address) return false;
  const network = (process.env.BTC_NETWORK || 'mainnet').toLowerCase();
  const targetSats = Math.round(Number(amountBtc) * 1e8);
  const providers = providersForNetwork(network);
  let lastErr = null;
  for (const provider of providers) {
    try {
      const { confirmedReceived, mempoolReceived } = await readAddressStats(provider, address);
      const consideredSats = minConfs <= 0 ? confirmedReceived + mempoolReceived : confirmedReceived;
      return {
        ok: consideredSats >= targetSats,
        provider: provider.name,
        providerBase: provider.base,
        network,
        address,
        amountBtc: Number(amountBtc),
        minConfs,
        targetSats,
        confirmedReceived,
        mempoolReceived,
        consideredSats
      };
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  const e = new Error(lastErr?.message || 'All providers failed');
  e.cause = lastErr;
  throw e;
}

// Boolean wrapper
async function isBtcPaymentConfirmed(address, amountBtc, minConfs = 1) {
  const d = await checkBtcPayment(address, amountBtc, minConfs);
  return d.ok;
}

module.exports = {
  isBtcPaymentConfirmed,
  checkBtcPayment
};

