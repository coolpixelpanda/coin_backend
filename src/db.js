const { PrismaClient } = require('@prisma/client');

// Prisma Client singleton pattern for serverless environments (Vercel)
// This prevents connection pool exhaustion in serverless functions
const globalForPrisma = globalThis;

// Determine if we're using Prisma Accelerate (prisma+postgres://) or direct connection
const databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL;
const isAccelerate = databaseUrl && databaseUrl.startsWith('prisma+postgres://');

// Prisma 7.0: Pass connection URL via accelerateUrl (for Accelerate) or adapter (for direct)
const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
};

if (isAccelerate) {
  // Use Accelerate connection - Prisma 7.0 format
  prismaConfig.accelerateUrl = databaseUrl;
} else if (databaseUrl) {
  // Use direct PostgreSQL connection
  // Note: For Prisma 7.0, direct connections may need adapter package
  // Since we're using Accelerate, this is mainly for fallback
  // If you need direct connections, you may need to install @prisma/adapter-postgresql
  prismaConfig.url = databaseUrl; // Fallback for compatibility
}

const prisma = globalForPrisma.prisma || new PrismaClient(prismaConfig);

// In development, prevent multiple instances during hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Handle graceful shutdown (only in non-serverless environments)
if (typeof process.env.VERCEL === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

module.exports = { prisma };

