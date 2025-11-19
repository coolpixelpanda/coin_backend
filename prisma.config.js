// Prisma 7.0: Configuration file for migrations
// This file is used by Prisma Migrate, not Prisma Client
module.exports = {
  datasource: {
    url: process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL,
  },
};

