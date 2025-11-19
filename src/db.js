const { PrismaClient } = require('@prisma/client');

// Prisma Client singleton pattern for serverless environments (Vercel)
// This prevents connection pool exhaustion in serverless functions
const globalForPrisma = globalThis;

// Get database URL from environment (check multiple possible variable names)
// Prisma looks for DATABASE_URL by default, but we also support PRISMA_DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL;

// Prisma 7.0 Configuration
// For Accelerate URLs (prisma+postgres://), Prisma automatically detects and uses Accelerate
// For direct connections (postgres://), Prisma uses direct connection
// In Prisma 7.0, connection URLs should be set via DATABASE_URL environment variable
// The PrismaClient constructor may not accept url property directly
const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
};

// Ensure DATABASE_URL is set for Prisma to use
// Prisma Client reads from DATABASE_URL environment variable automatically
if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
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

