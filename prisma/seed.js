// Prisma seed script to populate initial data
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
});

async function main() {
  console.log('Seeding database...');

  // Seed default cryptos
  const cryptos = ['BTC', 'ETH', 'USDT'];
  
  for (const category of cryptos) {
    await prisma.crypto.upsert({
      where: { category },
      update: {},
      create: { category },
    });
    console.log(`✓ Seeded crypto: ${category}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

