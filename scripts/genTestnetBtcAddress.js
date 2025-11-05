require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { bech32 } = require('bech32');
const secp = require('@noble/secp256k1');
const crypto = require('crypto');

function hash160(buf) {
  const sha = crypto.createHash('sha256').update(buf).digest();
  return crypto.createHash('ripemd160').update(sha).digest();
}

function toBech32WitnessV0(hrp, data20) {
  // witness version 0, program length 20 (P2WPKH)
  const words = bech32.toWords(Buffer.from(data20));
  words.unshift(0x00);
  return bech32.encode(hrp, words);
}

(async () => {
  try {
    const privKey = crypto.randomBytes(32);
    const pubKey = Buffer.from(secp.getPublicKey(privKey, true)); // compressed
    const h160 = hash160(pubKey); // 20 bytes
    const address = toBech32WitnessV0('tb', h160);

    const out = {
      network: 'testnet',
      btcAddress: address,
      privateKeyHex: privKey.toString('hex')
    };
    const target = path.resolve(process.cwd(), 'testnet-wallet.json');
    fs.writeFileSync(target, JSON.stringify(out, null, 2));
    console.log('Generated testnet BTC address:', address);
    console.log('Saved to:', target);
    process.exit(0);
  } catch (err) {
    console.error('Failed to generate address:', err.message);
    process.exit(1);
  }
})();





