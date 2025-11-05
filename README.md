# Crypto Backend (Node.js + MySQL)

Provides endpoints:
- POST `/api/register`
- GET `/api/login`
- GET `/api/crypto-price`
- POST `/api/exchange`

## Prerequisites
- Node.js 18+
- MySQL 8+

## Setup
1) Create database and tables:
   - Run statements in `sql-command.txt` on your MySQL server.
2) Configure environment:
   - Copy `env.example` to `.env` and fill values.
3) Install and run:
```bash
npm install
npm run dev
```

## Network (mainnet vs testnet)
- Default is mainnet (`BTC_NETWORK=mainnet`).
- For testnet:
  - Use `.env` with `BTC_NETWORK=testnet` or run:
    - `npm run dev:testnet` (development)
    - `npm run start:testnet` (production)
  - Update hardcoded wallets in `src/routes/exchange.js` under the `BUSINESS_WALLETS_TESTNET` map.

## API
- Sign Up: POST `/api/register`
  - Body: `{ "Email": string, "Password": string }`

- Sign In: GET `/api/login`
  - Query or JSON body: `{ "Email": string, "Password": string }`
  - Response: `{ "User_id": number, "Total_amount": number }`

- Request crypto price: GET `/api/crypto-price`
  - Response: `[{ "Id": number, "Category": string, "Price": number }]`

- Exchange crypto to money: POST `/api/exchange`
  - Body: `{ "User_id": number, "Category": string, "Amount": number }`
  - Response: `{ "User_id": number, "Category": string, "Amount": number, "Status": "success" }`
