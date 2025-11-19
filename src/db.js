const { PrismaClient } = require('@prisma/client');

// Prisma Client singleton pattern for serverless environments (Vercel)
// This prevents connection pool exhaustion in serverless functions
const globalForPrisma = globalThis;

// Get database URL from environment (check multiple possible variable names)
const databaseUrl = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL;

// Prisma 7.0 Configuration
// Prisma 7.0 REQUIRES either "adapter" or "accelerateUrl" in the constructor
// - Use "accelerateUrl" for Prisma Accelerate connections (prisma+postgres://)
// - Use "adapter" for direct database connections (postgres://)
if (!databaseUrl) {
  throw new Error('Database URL not found. Please set DATABASE_URL, PRISMA_DATABASE_URL, or POSTGRES_URL environment variable.');
}

const isAccelerate = databaseUrl.startsWith('prisma+postgres://');

const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
};

if (isAccelerate) {
  // Prisma Accelerate connection - REQUIRED in Prisma 7.0
  prismaConfig.accelerateUrl = databaseUrl;
} else {
  // Direct PostgreSQL connection - Prisma 7.0 requires adapter
  // Note: For direct connections, you may need to install @prisma/adapter-postgresql
  // For now, we'll try using the adapter format. If this fails, install the adapter package.
  try {
    // Try to use adapter with url property
    const { PrismaPgAdapter } = require('@prisma/adapter-postgresql');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: databaseUrl });
    prismaConfig.adapter = new PrismaPgAdapter(pool);
  } catch (adapterError) {
    // If adapter package is not installed, provide helpful error
    console.error('Direct PostgreSQL connection requires @prisma/adapter-postgresql package.');
    console.error('Install it with: npm install @prisma/adapter-postgresql pg');
    console.error('Or use Prisma Accelerate (prisma+postgres://) connection string instead.');
    throw new Error(
      'Direct PostgreSQL connections require @prisma/adapter-postgresql. ' +
      'Please install it or use Prisma Accelerate connection string.'
    );
  }
}

// Create Prisma Client instance (singleton pattern for serverless)
if (!globalForPrisma.prisma) {
  try {
    globalForPrisma.prisma = new PrismaClient(prismaConfig);
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error);
    throw error;
  }
}

const prisma = globalForPrisma.prisma;

// Handle graceful shutdown (only in non-serverless environments)
if (typeof process.env.VERCEL === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

module.exports = { prisma };

