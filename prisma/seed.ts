import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial development data...');

  const user = await prisma.user.upsert({
    where: { googleId: 'dev-google-id-001' },
    update: {},
    create: {
      googleId: 'dev-google-id-001',
      email: 'dev@reachinbox.test',
      name: 'Developer Account',
      avatar: 'https://lh3.googleusercontent.com/a/default-user',
    },
  });

  console.log(`User created or verified: ${user.email} (${user.id})`);

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: 'sales@reachinbox.test',
      },
    },
    update: {},
    create: {
      userId: user.id,
      email: 'sales@reachinbox.test',
      name: 'ReachInbox Sales Team',
      enabled: true,
      hourlyLimit: 50,
      minIntervalMs: 2000,
    },
  });

  console.log(`Initial sender configured: ${sender.email} (${sender.id})`);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
