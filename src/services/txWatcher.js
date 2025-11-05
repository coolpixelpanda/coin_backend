const { pool } = require('../db');
const logger = require('../logger');
const { isBtcPaymentConfirmed, checkBtcPayment } = require('./confirmations');

const POLL_INTERVAL = Number(process.env.TX_POLL_INTERVAL_MS || 30000);
const MIN_CONFS = Number(process.env.TX_MIN_CONFIRMATIONS || 1);
const BTC_NETWORK = (process.env.BTC_NETWORK || 'mainnet').toLowerCase();

async function runOnce() {
  const [pending] = await pool.query(
    "SELECT id, user_id, crypto_category, amount, wallet_address, status FROM transactions WHERE status = 'pending' ORDER BY id ASC LIMIT 50"
  );
  const [recognizedRows] = await pool.query(
    "SELECT wallet_address, SUM(amount) AS total FROM transactions WHERE status = 'success' GROUP BY wallet_address"
  );
  const recognizedMap = new Map();
  for (const row of recognizedRows) {
    if (!row.wallet_address) continue;
    const sats = Math.round(Number(row.total || 0) * 1e8);
    recognizedMap.set(row.wallet_address, sats);
  }
  logger.info({ pendingCount: pending.length }, 'txWatcher fetched pending');
  for (const tx of pending) {
    try {
      const category = String(tx.crypto_category || '').trim().toUpperCase();
      const isTestnet = BTC_NETWORK === 'testnet';
      const isBtcCategory = category === 'BTC' || (isTestnet && category === 'TBTC');
      if (isBtcCategory) {
        const d = await checkBtcPayment(tx.wallet_address, tx.amount, MIN_CONFS);
        const recognizedSats = recognizedMap.get(tx.wallet_address) || 0;
        const expectedSats = Math.round(Number(tx.amount) * 1e8);
        const availableSats = d.consideredSats - recognizedSats;
        if (d.ok) {
          if (availableSats >= expectedSats) {
            await pool.query("UPDATE transactions SET status = 'success' WHERE id = ?", [tx.id]);
            recognizedMap.set(tx.wallet_address, recognizedSats + expectedSats);
            logger.info({
              txId: tx.id,
              address: d.address,
              network: d.network,
              provider: d.provider,
              providerBase: d.providerBase,
              amount: tx.amount,
              targetSats: d.targetSats,
              confirmedReceived: d.confirmedReceived,
              mempoolReceived: d.mempoolReceived,
              consideredSats: d.consideredSats,
              recognizedSats,
              availableSats
            }, 'Transaction confirmed');
          } else {
            logger.info({
              txId: tx.id,
              address: d.address,
              network: d.network,
              provider: d.provider,
              providerBase: d.providerBase,
              amount: tx.amount,
              targetSats: d.targetSats,
              confirmedReceived: d.confirmedReceived,
              mempoolReceived: d.mempoolReceived,
              consideredSats: d.consideredSats,
              recognizedSats,
              availableSats
            }, 'Transaction awaiting additional funds (insufficient delta)');
          }
        } else {
          logger.info({
            txId: tx.id,
            address: d.address,
            network: d.network,
            provider: d.provider,
            providerBase: d.providerBase,
            amount: tx.amount,
            minConfs: d.minConfs,
            targetSats: d.targetSats,
            confirmedReceived: d.confirmedReceived,
            mempoolReceived: d.mempoolReceived,
            consideredSats: d.consideredSats,
            recognizedSats,
            availableSats
          }, 'Transaction not yet confirmed');
        }
      }
      // ETH/USDT confirmation can be implemented with chain-specific providers
    } catch (err) {
      logger.warn({ txId: tx.id, address: tx.wallet_address, category: tx.crypto_category, amount: tx.amount, minConfs: MIN_CONFS, btcNetwork: BTC_NETWORK, err: err.message, stack: err.stack }, 'Confirmation check failed');
    }
  }
}

function startPolling() {
  setInterval(() => {
    runOnce().catch((err) => logger.error({ err }, 'txWatcher iteration failed'));
  }, POLL_INTERVAL);
  logger.info({ intervalMs: POLL_INTERVAL, btcNetwork: BTC_NETWORK }, 'txWatcher started');
}

module.exports = { runOnce, startPolling };

