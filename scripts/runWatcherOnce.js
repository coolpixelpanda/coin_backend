require('dotenv').config();
const { runOnce } = require('../src/services/txWatcher');

(async () => {
  try {
    await runOnce();
    console.log('Watcher run completed.');
    process.exit(0);
  } catch (err) {
    console.error('Watcher run failed:', err.message);
    process.exit(1);
  }
})();





