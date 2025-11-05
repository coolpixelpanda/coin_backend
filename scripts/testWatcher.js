require('dotenv').config();
const { pool } = require('../src/db');
const { runOnce } = require('../src/services/txWatcher');

function getArg(name, def) {
  const p = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(p));
  return a ? a.slice(p.length) : def;
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`fetch ${url} -> ${resp.status}`);
  return resp.json();
}

(async () => {
  const address = getArg('address', '');
  const userEmail = getArg('email', 'test@example.com');
  const network = (process.env.BTC_NETWORK || 'mainnet').toLowerCase();
  const btcCategory = network === 'testnet' ? 'TBTC' : 'BTC';
  if (!address) {
    console.error('Usage: node scripts/testWatcher.js --address=tb1... [--email=test@example.com]');
    process.exit(1);
  }

  const base = network === 'testnet'
    ? 'https://blockstream.info/testnet/api'
    : 'https://blockstream.info/api';

  try {
    // 1) Find a confirmed tx paying to address and compute an amount <= received
    const txs = await fetchJson(`${base}/address/${address}/txs`);
    let sats = 0;
    for (const tx of txs) {
      if (!(tx.status && tx.status.confirmed)) continue;
      if (Array.isArray(tx.vout)) {
        let sum = 0;
        for (const out of tx.vout) {
          if (out && out.scriptpubkey_address === address) sum += Number(out.value || 0);
        }
        if (sum > 0) { sats = sum; break; }
      }
    }
    if (!sats) {
      console.error('No confirmed inbound outputs for address. Send tBTC first.');
      process.exit(1);
    }
    const amountBtc = Math.max((sats - 1) / 1e8, 0.00000001);

    // 2) Ensure user exists (create if needed)
    let userId;
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      const [ins] = await pool.query(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [userEmail, 'test', 'Test']
      );
      userId = ins.insertId;
    }

    // 3) Insert pending tx for BTC (network-aware)
    const [txIns] = await pool.query(
      'INSERT INTO transactions (user_id, crypto_category, amount, wallet_address, status) VALUES (?, ?, ?, ?, ?)',
      [userId, btcCategory, amountBtc, address, 'pending']
    );
    const txId = txIns.insertId;
    console.log('Seeded pending tx id:', txId, 'category:', btcCategory, 'amount:', amountBtc);

    // 4) Run watcher once
    await runOnce();

    // 5) Check status
    const [rows] = await pool.query('SELECT status FROM transactions WHERE id = ?', [txId]);
    const status = rows[0]?.status;
    console.log('Result status:', status);
    if (status === 'success') {
      console.log('PASS: Watcher confirmed the transaction.');
      process.exit(0);
    } else {
      console.error('FAIL: Status not success.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
})();



