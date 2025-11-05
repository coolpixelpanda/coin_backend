const express = require('express');
const { pool } = require('../db');
const priceProvider = require('../services/priceProvider');

const router = express.Router();

// Raw password storage per requirement (no hashing)

// Sign Up
// POST /api/register
// Payload: { Email, Password }
router.post('/register', async (req, res, next) => {
  try {
    const { Email, Password, Username } = req.body || {};
    req?.log?.info({ email: Email, hasUsername: Boolean(Username) }, 'Register request');
    if (!Email || !Password) {
      return res.status(400).json({ error: 'Email and Password are required' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [Email]);
    if (existing.length > 0) {
      req?.log?.warn({ email: Email }, 'Email already registered');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const [result] = await pool.query(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [Email, Password, Username]
    );

    req?.log?.info({ userId: result.insertId, email: Email }, 'Register success');
    return res.status(201).json({ user_id: result.insertId });
  } catch (err) {
    return next(err);
  }
});

// Sign In
// GET /api/login
// Supports Email/Password via query string or JSON body
router.post('/login', async (req, res, next) => {
  try {
    const Email = req.query.Email ?? req.body?.Email;
    const Password = req.query.Password ?? req.body?.Password;
    req?.log?.info({ email: Email }, 'Login attempt');
    console.log('Email', Email);
    console.log('Password', Password);
    if (!Email || !Password) {
      return res.status(400).json({ error: 'Email and Password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND password = ?',
      [Email, Password]
    );
    if (rows.length === 0) {
      req?.log?.warn({ email: Email }, 'Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    // Derive Total_amount using live prices and summed amounts per category
    const [agg] = await pool.query(
      "SELECT crypto_category AS category, SUM(amount) AS totalAmount FROM transactions WHERE user_id = ? AND status = 'success' GROUP BY crypto_category",
      [user.id]
    );
    let totalFiat = 0;
    for (const row of agg) {
      try {
        const { price } = await priceProvider.getPriceForSymbol(row.category);
        totalFiat += Number(row.totalAmount) * Number(price);
      } catch (_) {
        // If price fetch fails, skip that category contribution
      }
    }
    req?.log?.info({ userId: user.id, email: Email }, 'Login success');
    return res.json({ User_id: user.id, Total_amount: Number(totalFiat) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

