const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Disable ETag to avoid 304 on dynamic JSON responses
app.set('etag', false);

app.use(express.json());

// Request logging
app.use(pinoHttp({ logger }));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin);
  if (isAllowed && origin) req.log?.debug({ origin }, 'CORS allowed');
  if (!isAllowed) logger.warn({ origin }, 'CORS blocked');
  return cors({
    origin: isAllowed ? true : false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  })(req, res, next);
});
app.options('*', cors());

// Health check
app.get('/', async (req, res) => {
  try {
    // Test database connection
    const { prisma } = require('./db');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database connection failed'
    });
  }
});

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/crypto'));
app.use('/api', require('./routes/exchange'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

