import { config } from '../src/config';
import { prisma } from '../src/db';
import { indexEmail, ensureIndex } from '../src/services/search';
import { logger } from '../src/lib/logger';

async function main() {
  config();
  await prisma.$connect();
  await ensureIndex();

  const batchSize = 100;
  let skip = 0;
  let total = 0;

  while (true) {
    const emails = await prisma.scheduledEmail.findMany({
      skip,
      take: batchSize,
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });

    if (emails.length === 0) break;

    for (const email of emails) {
      await indexEmail({
        emailId: email.id,
        userId: email.userId,
        senderId: email.senderId,
        batchId: email.batchId,
        senderEmail: email.sender.email,
        recipient: email.recipient,
        subject: email.subject,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString(),
        createdAt: email.createdAt.toISOString(),
      });
    }

    total += emails.length;
    skip += batchSize;
    logger.info({ indexed: total }, 'Reconciliation progress');
  }

  logger.info({ total }, 'Elasticsearch reconciliation complete');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'ES reconciliation failed');
  process.exit(1);
});
