# API Endpoints Documentation

## Public Endpoints (No Authentication Required)

### 1. Health Check
- **GET** `/`
- **Description**: Check server and database connection status
- **Response**:
  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```
- **Example**:
  ```bash
  curl https://coin-backend-fawn.vercel.app/
  ```

### 2. Registration Info (GET)
- **GET** `/api/register`
- **Description**: Get information about the registration endpoint
- **Response**:
  ```json
  {
    "message": "Registration endpoint",
    "method": "POST",
    "endpoint": "/api/register",
    "requiredFields": ["Email", "Password"],
    "optionalFields": ["Username"],
    "example": {
      "Email": "user@example.com",
      "Password": "password123",
      "Username": "John Doe"
    }
  }
  ```

### 3. User Registration
- **POST** `/api/register`
- **Description**: Register a new user
- **Body**:
  ```json
  {
    "Email": "user@example.com",
    "Password": "password123",
    "Username": "John Doe"  // Optional
  }
  ```
- **Success Response** (201):
  ```json
  {
    "user_id": 1
  }
  ```
- **Error Responses**:
  - `400`: Missing required fields
  - `409`: Email already registered
- **Example**:
  ```bash
  curl -X POST https://coin-backend-fawn.vercel.app/api/register \
    -H "Content-Type: application/json" \
    -d '{"Email":"test@example.com","Password":"password123"}'
  ```

### 4. User Login
- **POST** `/api/login`
- **Description**: Login and get user information
- **Body** (JSON or Query Parameters):
  ```json
  {
    "Email": "user@example.com",
    "Password": "password123"
  }
  ```
- **Success Response** (200):
  ```json
  {
    "User_id": 1,
    "Total_amount": 0.0
  }
  ```
- **Error Responses**:
  - `400`: Missing required fields
  - `401`: Invalid credentials
- **Example**:
  ```bash
  curl -X POST https://coin-backend-fawn.vercel.app/api/login \
    -H "Content-Type: application/json" \
    -d '{"Email":"test@example.com","Password":"password123"}'
  ```

### 5. Get Crypto Prices
- **GET** `/api/crypto-price`
- **Description**: Get current prices for all supported cryptocurrencies
- **Response** (200):
  ```json
  [
    {
      "Id": 1,
      "Category": "BTC",
      "Price": 43250.50
    },
    {
      "Id": 2,
      "Category": "ETH",
      "Price": 2650.75
    },
    {
      "Id": 3,
      "Category": "USDT",
      "Price": 1.00
    }
  ]
  ```
- **Example**:
  ```bash
  curl https://coin-backend-fawn.vercel.app/api/crypto-price
  ```

## Protected Endpoints (Require User ID)

### 6. Exchange Crypto
- **POST** `/api/exchange`
- **Description**: Exchange cryptocurrency (requires valid User_id)
- **Body**:
  ```json
  {
    "User_id": 1,
    "Category": "BTC",
    "Amount": 0.001
  }
  ```
- **Success Response** (200):
  ```json
  {
    "User_id": 1,
    "Category": "BTC",
    "Amount": 0.001,
    "Status": "pending"
  }
  ```
- **Error Responses**:
  - `400`: Invalid request (missing fields, invalid category, invalid amount)
  - `404`: User not found
  - `500`: Business wallet not configured
- **Example**:
  ```bash
  curl -X POST https://coin-backend-fawn.vercel.app/api/exchange \
    -H "Content-Type: application/json" \
    -d '{"User_id":1,"Category":"BTC","Amount":0.001}'
  ```

## Summary

**All endpoints are public** - there's no authentication middleware. However:
- `/api/exchange` requires a valid `User_id` (obtained from registration/login)
- All endpoints are accessible without API keys or tokens
- CORS is configured to allow requests from allowed origins

## Base URL
- **Production**: `https://coin-backend-fawn.vercel.app`
- **Local Development**: `http://localhost:3000`

