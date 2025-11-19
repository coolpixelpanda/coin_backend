const { prisma } = require('../db');
const logger = require('../logger');
const { isBtcPaymentConfirmed, checkBtcPayment } = require('./confirmations');

const POLL_INTERVAL = Number(process.env.TX_POLL_INTERVAL_MS || 30000);
const MIN_CONFS = Number(process.env.TX_MIN_CONFIRMATIONS || 1);
const BTC_NETWORK = (process.env.BTC_NETWORK || 'mainnet').toLowerCase();

async function runOnce() {
  const pending = await prisma.transaction.findMany({
    where: { status: 'pending' },
    orderBy: { id: 'asc' },
    take: 50,
    select: {
      id: true,
      userId: true,
      cryptoCategory: true,
      amount: true,
      walletAddress: true,
      status: true
    }
  });

  const recognizedRows = await prisma.transaction.groupBy({
    by: ['walletAddress'],
    where: { status: 'success' },
    _sum: { amount: true }
  });
  
  const recognizedMap = new Map();
  for (const row of recognizedRows) {
    if (!row.walletAddress) continue;
    const sats = Math.round(Number(row._sum.amount || 0) * 1e8);
    recognizedMap.set(row.walletAddress, sats);
  }
  logger.info({ pendingCount: pending.length }, 'txWatcher fetched pending');
  for (const tx of pending) {
    try {
      const category = String(tx.cryptoCategory || '').trim().toUpperCase();
      const isTestnet = BTC_NETWORK === 'testnet';
      const isBtcCategory = category === 'BTC' || (isTestnet && category === 'TBTC');
      if (isBtcCategory) {
        const d = await checkBtcPayment(tx.walletAddress, tx.amount, MIN_CONFS);
        const recognizedSats = recognizedMap.get(tx.walletAddress) || 0;
        const expectedSats = Math.round(Number(tx.amount) * 1e8);
        const availableSats = d.consideredSats - recognizedSats;
        if (d.ok) {
          if (availableSats >= expectedSats) {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { status: 'success' }
            });
            recognizedMap.set(tx.walletAddress, recognizedSats + expectedSats);
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
      logger.warn({ txId: tx.id, address: tx.walletAddress, category: tx.cryptoCategory, amount: tx.amount, minConfs: MIN_CONFS, btcNetwork: BTC_NETWORK, err: err.message, stack: err.stack }, 'Confirmation check failed');
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

