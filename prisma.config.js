// Prisma 7.0: Configuration file for migrations and db push
module.exports = {
  datasource: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  },
};

