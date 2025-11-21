// Load environment variables first (for local development)
// This ensures .env file is loaded before accessing process.env
// Always load dotenv - it's safe to call multiple times
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Prisma Client singleton pattern for serverless environments (Vercel)
// This prevents connection pool exhaustion in serverless functions
const globalForPrisma = globalThis;

// Get database URL from environment
// Priority: PRISMA_DATABASE_URL (Accelerate) > DATABASE_URL > POSTGRES_URL
const accelerateUrl = process.env.PRISMA_DATABASE_URL;
const directUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const databaseUrl = accelerateUrl || directUrl;

// Prisma 7.0 Configuration
// Prisma 7.0 REQUIRES either "adapter" or "accelerateUrl" in the constructor
// We prefer Accelerate for production, but can fall back to direct connection
if (!databaseUrl) {
  throw new Error(
    'Database URL not found. Please set one of:\n' +
    '  - PRISMA_DATABASE_URL (for Prisma Accelerate: prisma+postgres://...)\n' +
    '  - DATABASE_URL (for direct connection: postgres://...)\n' +
    '  - POSTGRES_URL (for direct connection: postgres://...)'
  );
}

const isAccelerate = databaseUrl.startsWith('prisma+postgres://');

const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
};

if (isAccelerate) {
  // Prisma Accelerate connection - REQUIRED in Prisma 7.0
  prismaConfig.accelerateUrl = databaseUrl;
} else {
  // Direct PostgreSQL connection - requires adapter in Prisma 7.0
  // For direct connections, we need to use adapter
  // But since Accelerate is preferred, warn the user
  console.warn(
    '⚠️  Using direct PostgreSQL connection. For better performance in serverless, ' +
    'use Prisma Accelerate (prisma+postgres://) connection string in PRISMA_DATABASE_URL.'
  );
  
  // For direct connections, Prisma 7.0 requires adapter
  // However, if we don't have the adapter package, we'll get a clear error
  // The user should use Accelerate instead
  throw new Error(
    'Direct PostgreSQL connections require @prisma/adapter-postgresql package in Prisma 7.0.\n' +
    'Please use Prisma Accelerate instead:\n' +
    '  1. Set PRISMA_DATABASE_URL with your Accelerate connection string (prisma+postgres://...)\n' +
    '  2. Your Accelerate URL should look like: prisma+postgres://accelerate.prisma-data.net/?api_key=...\n' +
    `  3. Current URL format: ${databaseUrl.substring(0, 50)}...`
  );
}

// Create Prisma Client instance (singleton pattern for serverless)
// This ensures we reuse the same instance across function invocations in Vercel
if (!globalForPrisma.prisma) {
  try {
    globalForPrisma.prisma = new PrismaClient(prismaConfig);
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error);
    console.error('Config:', { 
      hasAccelerateUrl: !!prismaConfig.accelerateUrl,
      urlPrefix: databaseUrl ? databaseUrl.substring(0, 30) : 'undefined'
    });
    throw error;
  }
}

// Always use the singleton instance
const prisma = globalForPrisma.prisma;

// Handle graceful shutdown (only in non-serverless environments)
if (typeof process.env.VERCEL === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

module.exports = { prisma };

