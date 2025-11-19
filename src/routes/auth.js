const express = require('express');
const { prisma } = require('../db');
const priceProvider = require('../services/priceProvider');

const router = express.Router();

// Raw password storage per requirement (no hashing)

// Sign Up
// POST /api/register
// Payload: { Email, Password }
// GET /api/register - Returns API info (for testing)
router.get('/register', (req, res) => {
  res.json({ 
    message: 'Registration endpoint',
    method: 'POST',
    endpoint: '/api/register',
    requiredFields: ['Email', 'Password'],
    optionalFields: ['Username'],
    example: {
      Email: 'user@example.com',
      Password: 'password123',
      Username: 'John Doe'
    }
  });
});

router.post('/register', async (req, res, next) => {
  try {
    const { Email, Password, Username } = req.body || {};
    req?.log?.info({ email: Email, hasUsername: Boolean(Username) }, 'Register request');
    if (!Email || !Password) {
      return res.status(400).json({ error: 'Email and Password are required' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: Email },
      select: { id: true }
    });
    if (existing) {
      req?.log?.warn({ email: Email }, 'Email already registered');
      return res.status(409).json({ error: 'Email already registered' });
    }

    let result;
    try {
      result = await prisma.user.create({
        data: {
          email: Email,
          password: Password,
          name: Username || null
        },
        select: {
          id: true
        }
      });
    } catch (prismaError) {
      req?.log?.error({ 
        email: Email, 
        error: prismaError?.message,
        code: prismaError?.code,
        meta: prismaError?.meta,
        stack: prismaError?.stack
      }, 'Prisma error during user creation');
      // Re-throw to be handled by outer catch
      throw prismaError;
    }

    if (!result || !result.id) {
      req?.log?.error({ email: Email, result }, 'Failed to create user - result is invalid');
      return res.status(500).json({ error: 'Failed to create user' });
    }

    req?.log?.info({ userId: result.id, email: Email }, 'Register success');
    return res.status(201).json({ user_id: result.id });
  } catch (err) {
    req?.log?.error({ 
      email: Email,
      error: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack
    }, 'Error in register endpoint');
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

    const user = await prisma.user.findFirst({
      where: {
        email: Email,
        password: Password
      },
      select: { id: true }
    });
    if (!user) {
      req?.log?.warn({ email: Email }, 'Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Derive Total_amount using live prices and summed amounts per category
    const agg = await prisma.transaction.groupBy({
      by: ['cryptoCategory'],
      where: {
        userId: user.id,
        status: 'success'
      },
      _sum: {
        amount: true
      }
    });
    let totalFiat = 0;
    for (const row of agg) {
      try {
        const { price } = await priceProvider.getPriceForSymbol(row.cryptoCategory);
        totalFiat += Number(row._sum.amount || 0) * Number(price);
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

