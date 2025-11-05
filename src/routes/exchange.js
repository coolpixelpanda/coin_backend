const express = require('express');
const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// POST /api/exchange
// Request: { User_id, Category, Amount }
// Response: { User_id, Category, Amount, Status }
router.post('/exchange', async (req, res, next) => {
  const { User_id, Category, Amount } = req.body || {};
  const NETWORK = (process.env.BTC_NETWORK || 'mainnet').toLowerCase();
  const categoryInput = Category === undefined || Category === null ? '' : String(Category).trim();

  if (!User_id || !categoryInput || Amount === undefined) {
    return res.status(400).json({ error: 'User_id, Category and Amount are required' });
  }

  const normalizedCategory = categoryInput.toUpperCase();
  const isBtcAlias = normalizedCategory === 'BTC' || normalizedCategory === 'TBTC';
  const resolvedCategory = isBtcAlias
    ? (NETWORK === 'testnet' ? 'TBTC' : 'BTC')
    : normalizedCategory;
  const supportedSymbols = NETWORK === 'testnet'
    ? ['TBTC', 'ETH', 'USDT']
    : ['BTC', 'ETH', 'USDT'];

  req?.log?.info({ userId: User_id, category: categoryInput, resolvedCategory, amount: Amount, network: NETWORK }, 'Exchange request');

  if (!supportedSymbols.includes(resolvedCategory)) {
    req?.log?.warn({ category: categoryInput, resolvedCategory, network: NETWORK }, 'Invalid crypto category');
    return res.status(400).json({ error: 'Invalid crypto category' });
  }

  const amountNum = Number(Amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query('SELECT id FROM users WHERE id = ?', [User_id]);
    if (userRows.length === 0) {
      req?.log?.warn({ userId: User_id }, 'User not found');
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const BUSINESS_WALLETS_MAINNET = {
      BTC: 'REPLACE_WITH_YOUR_BTC_WALLET',
      ETH: 'REPLACE_WITH_YOUR_ETH_WALLET',
      USDT: 'REPLACE_WITH_YOUR_USDT_WALLET'
    };
    let testnetBtcAddress = null;
    if (NETWORK === 'testnet') {
      try {
        const p = path.resolve(process.cwd(), 'testnet-wallet.json');
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        testnetBtcAddress = j.btcAddress || null;
      } catch (_) {}
    }
    const BUSINESS_WALLETS_TESTNET = {
      TBTC: testnetBtcAddress || 'REPLACE_WITH_YOUR_TESTNET_BTC_WALLET',
      ETH: 'REPLACE_WITH_YOUR_TESTNET_ETH_WALLET',
      USDT: 'REPLACE_WITH_YOUR_TESTNET_USDT_WALLET'
    };
    const BUSINESS_WALLETS = NETWORK === 'testnet' ? BUSINESS_WALLETS_TESTNET : BUSINESS_WALLETS_MAINNET;
    const businessWallet = BUSINESS_WALLETS[resolvedCategory] || null;
    if (!businessWallet) {
      await conn.rollback();
      return res.status(500).json({ error: 'Business wallet not configured for category' });
    }
    await conn.query(
      'INSERT INTO transactions (user_id, crypto_category, amount, wallet_address, status) VALUES (?, ?, ?, ?, ?)',
      [User_id, resolvedCategory, amountNum, businessWallet, 'pending']
    );

    await conn.commit();
    req?.log?.info({ userId: User_id, category: resolvedCategory, amount: amountNum }, 'Exchange recorded as pending');
    return res.json({ User_id, Category: resolvedCategory, Amount: amountNum, Status: 'pending' });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    return next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;

