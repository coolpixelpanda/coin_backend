const { PrismaClient } = require('@prisma/client');

// Prisma Client singleton pattern for serverless environments (Vercel)
// This prevents connection pool exhaustion in serverless functions
const globalForPrisma = globalThis;

// Get database URL from environment (check multiple possible variable names)
const databaseUrl = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL;

// Prisma 7.0 Configuration
// Prisma 7.0 REQUIRES either "adapter" or "accelerateUrl" in the constructor
// We're using Prisma Accelerate, so we need "accelerateUrl"
if (!databaseUrl) {
  throw new Error('Database URL not found. Please set DATABASE_URL, PRISMA_DATABASE_URL, or POSTGRES_URL environment variable.');
}

const isAccelerate = databaseUrl.startsWith('prisma+postgres://');

if (!isAccelerate) {
  throw new Error(
    'This application requires Prisma Accelerate connection string (prisma+postgres://). ' +
    `Received: ${databaseUrl ? databaseUrl.substring(0, 30) + '...' : 'undefined'}. ` +
    'Please set PRISMA_DATABASE_URL with your Accelerate connection string.'
  );
}

const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  accelerateUrl: databaseUrl, // Prisma 7.0 REQUIRED for Accelerate connections
};

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

