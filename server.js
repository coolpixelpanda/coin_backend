require('dotenv').config();
const app = require('./src/app');

// Check if running on Vercel (serverless) or traditional server
const isVercel = typeof process.env.VERCEL !== 'undefined';

if (isVercel) {
  // Export app for Vercel serverless functions
  module.exports = app;
} else {
  // Traditional server mode - start listening and background services
  const { startPolling } = require('./src/services/txWatcher');
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Start background confirmation watcher (only in non-serverless environments)
  startPolling();
}

