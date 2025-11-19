# Prisma PostgreSQL Setup Checklist

## ✅ Completed Steps

1. ✅ Installed Prisma dependencies (`@prisma/client`, `prisma`)
2. ✅ Created Prisma schema (`prisma/schema.prisma`)
3. ✅ Updated all route files to use Prisma
4. ✅ Configured Prisma Client for Vercel serverless
5. ✅ Set up Prisma Accelerate connection (`accelerateUrl`)

## 🔴 Critical: Database Setup Required

**You MUST create the database tables before the app will work!**

### Option 1: Using Prisma Migrate (Recommended)

```bash
# Create initial migration
npx prisma migrate dev --name init

# Or if you want to push schema without migrations
npx prisma db push
```

### Option 2: Using Prisma DB Push (Quick Setup)

```bash
# Push schema directly to database (no migration history)
npx prisma db push
```

### Seed Initial Data

After creating tables, seed the crypto data:

```bash
npm run db:seed
```

Or manually:

```bash
node prisma/seed.js
```

## 📋 Pre-Deployment Checklist

Before deploying to Vercel, ensure:

1. **Environment Variables in Vercel:**
   - [ ] `PRISMA_DATABASE_URL` - Your Prisma Accelerate connection string (starts with `prisma+postgres://`)
   - [ ] `POSTGRES_URL` - Direct PostgreSQL connection (fallback)
   - [ ] All other environment variables from `.env`

2. **Database Tables Created:**
   - [ ] Run `npx prisma db push` or `npx prisma migrate deploy` locally
   - [ ] Verify tables exist: `users`, `cryptos`, `transactions`

3. **Initial Data Seeded:**
   - [ ] Run `npm run db:seed` to populate `cryptos` table with BTC, ETH, USDT

4. **Build Scripts:**
   - [ ] `package.json` has `"postinstall": "prisma generate"` ✅ (already done)
   - [ ] `package.json` has `"build": "prisma generate"` ✅ (already done)

## 🧪 Testing Locally

1. Set up `.env` file with your connection strings
2. Run migrations: `npx prisma db push`
3. Seed data: `npm run db:seed`
4. Start server: `npm run dev`
5. Test endpoints:
   - `GET /` - Health check
   - `POST /api/register` - User registration
   - `POST /api/login` - User login

## 🚀 Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy
5. After deployment, run migrations on production database:
   ```bash
   # Set DATABASE_URL temporarily to direct connection (not Accelerate)
   export DATABASE_URL="postgres://..."
   npx prisma migrate deploy
   # Or
   npx prisma db push
   ```

## ⚠️ Important Notes

- **Prisma Accelerate** (`prisma+postgres://`) is used for runtime queries
- **Direct PostgreSQL** connection is needed for migrations (`postgres://`)
- Migrations should be run with direct connection, not Accelerate
- After migrations, switch back to Accelerate for runtime

## 🔍 Troubleshooting

If you get errors:

1. **"Cannot read properties of undefined"** → Database tables don't exist, run migrations
2. **"PrismaClientConstructorValidationError"** → Check `PRISMA_DATABASE_URL` is set correctly
3. **"Table does not exist"** → Run `npx prisma db push` or migrations
4. **Connection errors** → Verify environment variables in Vercel dashboard

