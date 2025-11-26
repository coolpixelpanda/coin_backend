// Prisma seed script to populate initial data
const { PrismaClient } = require('@prisma/client');

// For seeding, prefer Accelerate if available, otherwise use direct connection
const accelerateUrl = process.env.PRISMA_DATABASE_URL;
const directUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const databaseUrl = accelerateUrl || directUrl;

if (!databaseUrl) {
  console.error('Error: No database URL found. Please set PRISMA_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const isAccelerate = databaseUrl.startsWith('prisma+postgres://');

const prismaConfig = {};
if (isAccelerate) {
  // Use Accelerate for seeding (works fine)
  prismaConfig.accelerateUrl = databaseUrl;
} else {
  // For direct connections, Prisma 7.0 requires adapter
  // But we can use Accelerate URL from PRISMA_DATABASE_URL if available
  if (accelerateUrl) {
    prismaConfig.accelerateUrl = accelerateUrl;
  } else {
    console.error('Error: For direct PostgreSQL connections, Prisma 7.0 requires @prisma/adapter-postgresql');
    console.error('Please use Prisma Accelerate (PRISMA_DATABASE_URL) or install the adapter package');
    process.exit(1);
  }
}

const prisma = new PrismaClient(prismaConfig);

async function main() {
  console.log('Seeding database...');

  // Seed default cryptos - using standard symbols for exchange compatibility
  const cryptos = [
    { id: 1, category: 'BTC' },   // Bitcoin
    { id: 2, category: 'ETH' },    // Ethereum
    { id: 3, category: 'USDT' },   // Tether
    { id: 4, category: 'XRP' },    // XRP
    { id: 5, category: 'BNB' },   // Binance Coin
    { id: 6, category: 'SOL' }     // Solana
  ];
  
  for (const crypto of cryptos) {
    await prisma.crypto.upsert({
      where: { id: crypto.id },
      update: { category: crypto.category },
      create: crypto,
    });
    console.log(`✓ Seeded crypto: ${crypto.category} (id: ${crypto.id})`);
  }

  // Seed sample feedback (optional - matching SQL data)
  const sampleFeedback = {
    username: 'Tomas Hammer',
    feedback: 'I am really excited to see this opportunity. CoinTransfer is the best place to sell the crypto. I am really a lucky man!!!'
  };
  
  await prisma.feedback.upsert({
    where: { id: 1 },
    update: sampleFeedback,
    create: { id: 1, ...sampleFeedback },
  });
  console.log(`✓ Seeded feedback: ${sampleFeedback.username}`);

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

