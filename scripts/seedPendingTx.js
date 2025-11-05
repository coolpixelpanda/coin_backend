require('dotenv').config();
const { pool } = require('../src/db');

function getArg(name, def) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : def;
}

(async () => {
  const userId = Number(getArg('user', ''));
  const category = (getArg('category', 'BTC') || '').toUpperCase();
  const amount = Number(getArg('amount', '0'));
  const address = getArg('address', '');

  if (!userId || !category || !amount || !address) {
    console.error('Usage: node scripts/seedPendingTx.js --user=1 --category=BTC --amount=0.0001 --address=tb1...');
    process.exit(1);
  }

  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      console.error('User not found:', userId);
      process.exit(1);
    }
    const [result] = await pool.query(
      'INSERT INTO transactions (user_id, crypto_category, amount, wallet_address, status) VALUES (?, ?, ?, ?, ?)',
      [userId, category, amount, address, 'pending']
    );
    console.log('Inserted pending tx id:', result.insertId);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
})();





