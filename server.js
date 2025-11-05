require('dotenv').config();
const app = require('./src/app');
const { startPolling } = require('./src/services/txWatcher');

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Start background confirmation watcher
startPolling();

