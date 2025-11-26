const express = require('express');
const { prisma } = require('../db');
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
  
  // Get supported cryptocurrencies from database
  const supportedCryptos = await prisma.crypto.findMany({
    select: { category: true }
  });
  
  // Normalize categories to uppercase for comparison
  const supportedSymbols = supportedCryptos
    .map(c => String(c.category || '').toUpperCase().trim())
    .filter(Boolean);
  
  // Handle BTC/TBTC alias for testnet/mainnet
  const isBtcAlias = normalizedCategory === 'BTC' || normalizedCategory === 'TBTC';
  let resolvedCategory = normalizedCategory;
  
  if (isBtcAlias) {
    resolvedCategory = NETWORK === 'testnet' ? 'TBTC' : 'BTC';
  }
  
  // Also check lowercase versions (e.g., 'bitcoin' -> 'BTC')
  const categoryLower = normalizedCategory.toLowerCase();
  const cryptoMap = {
    'bitcoin': NETWORK === 'testnet' ? 'TBTC' : 'BTC',
    'ethereum': 'ETH',
    'tether': 'USDT',
    'btc': NETWORK === 'testnet' ? 'TBTC' : 'BTC',
    'eth': 'ETH',
    'usdt': 'USDT'
  };
  
  if (cryptoMap[categoryLower]) {
    resolvedCategory = cryptoMap[categoryLower];
  }

  req?.log?.info({ userId: User_id, category: categoryInput, resolvedCategory, amount: Amount, network: NETWORK, supportedSymbols }, 'Exchange request');

  // Check if the resolved category is in the supported list
  if (!supportedSymbols.includes(resolvedCategory)) {
    req?.log?.warn({ category: categoryInput, resolvedCategory, network: NETWORK, supportedSymbols }, 'Invalid crypto category');
    return res.status(400).json({ 
      error: 'Invalid crypto category',
      supportedCategories: supportedSymbols,
      received: categoryInput
    });
  }

  const amountNum = Number(Amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: User_id },
      select: { id: true }
    });
    if (!user) {
      req?.log?.warn({ userId: User_id }, 'User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    // Get business wallet address from environment variables or use default
    // Format: {SYMBOL}_WALLET_ADDRESS (e.g., BTC_WALLET_ADDRESS, ETH_WALLET_ADDRESS)
    // For testnet, use {SYMBOL}_TESTNET_WALLET_ADDRESS or fallback to mainnet
    const walletEnvKey = NETWORK === 'testnet' 
      ? `${resolvedCategory}_TESTNET_WALLET_ADDRESS`
      : `${resolvedCategory}_WALLET_ADDRESS`;
    
    let businessWallet = process.env[walletEnvKey] || process.env[`${resolvedCategory}_WALLET_ADDRESS`];
    
    // Fallback: Try to read from testnet-wallet.json for BTC/TBTC
    if (!businessWallet && (resolvedCategory === 'BTC' || resolvedCategory === 'TBTC')) {
      try {
        const p = path.resolve(process.cwd(), 'testnet-wallet.json');
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        businessWallet = j.btcAddress || null;
      } catch (_) {}
    }
    
    // If still no wallet, use a default placeholder
    if (!businessWallet) {
      businessWallet = `REPLACE_WITH_YOUR_${resolvedCategory}_WALLET`;
      req?.log?.warn({ category: resolvedCategory, walletEnvKey }, 'Using placeholder wallet address - configure in environment variables');
    }

    // Use Prisma transaction for atomicity
    const transaction = await prisma.$transaction(async (tx) => {
      return await tx.transaction.create({
        data: {
          userId: User_id,
          cryptoCategory: resolvedCategory,
          amount: amountNum,
          walletAddress: businessWallet,
          status: 'pending'
        }
      });
    });

    req?.log?.info({ userId: User_id, category: resolvedCategory, amount: amountNum }, 'Exchange recorded as pending');
    return res.json({ User_id, Category: resolvedCategory, Amount: amountNum, Status: 'pending' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

