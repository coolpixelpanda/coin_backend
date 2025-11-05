const express = require('express');
const { pool } = require('../db');
const priceProvider = require('../services/priceProvider');

const router = express.Router();

// GET /api/crypto-price
router.get('/crypto-price', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, category FROM cryptos ORDER BY id ASC');
    let results;
    if (rows.length === 0) {
      const { data } = await priceProvider.getAllPrices();
      results = data; // fallback to default assets
    } else {
      results = await Promise.all(rows.map(async (r) => {
        try {
          const category = String(r.category).toUpperCase();
          const { price } = await priceProvider.getPriceForSymbol(category);
          return { Id: r.id, Category: category, Price: Number(price) };
        } catch (_) {
          return { Id: r.id, Category: String(r.category).toUpperCase(), Price: 0 };
        }
      }));
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    req?.log?.info({ count: results.length }, 'Crypto prices fetched');
    return res.status(200).json(results);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

