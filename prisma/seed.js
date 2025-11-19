// Prisma seed script to populate initial data
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
});

async function main() {
  console.log('Seeding database...');

  // Seed default cryptos (matching SQL data format)
  const cryptos = [
    { id: 1, category: 'bitcoin' },
    { id: 2, category: 'ethereum' }
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

