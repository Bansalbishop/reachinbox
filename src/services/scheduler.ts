import { prisma } from '../db';
import { emailQueue, type EmailJobData } from '../lib/email-queue';
import { logger } from '../lib/logger';

// Enqueue all PENDING emails that should have been queued but weren't
// (e.g., after a crash between DB commit and queue publish).
export async function reconcilePendingEmails(): Promise<number> {
  const pending = await prisma.scheduledEmail.findMany({
    where: { status: 'PENDING' },
    select: { id: true, senderId: true, scheduledAt: true },
  });

  let enqueued = 0;
  for (const email of pending) {
    const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
    const jobId = `email-${email.id}`;
    const data: EmailJobData = { emailId: email.id, senderId: email.senderId };

    try {
      await emailQueue().add('send', data, { jobId, delay: delayMs });
      await prisma.scheduledEmail.update({
        where: { id: email.id, status: 'PENDING' },
        data: { status: 'QUEUED' },
      });
      enqueued++;
    } catch (err: any) {
      // Job ID already exists -> already queued, just update status
      if (err.message?.includes('job already exists') || err.message?.includes('Job already')) {
        await prisma.scheduledEmail.update({
          where: { id: email.id, status: 'PENDING' },
          data: { status: 'QUEUED' },
        });
        enqueued++;
      } else {
        logger.error({ err, emailId: email.id }, 'Failed to reconcile email');
      }
    }
  }

  if (enqueued > 0) {
    logger.info({ count: enqueued }, 'Reconciled pending emails');
  }
  return enqueued;
}

// Schedule a single email into BullMQ
export async function scheduleEmail(emailId: string, senderId: string, scheduledAt: Date): Promise<void> {
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
  const jobId = `email-${emailId}`;
  const data: EmailJobData = { emailId, senderId };

  await emailQueue().add('send', data, { jobId, delay: delayMs });
  await prisma.scheduledEmail.update({
    where: { id: emailId },
    data: { status: 'QUEUED' },
  });
}

// Schedule a batch of emails
export async function scheduleBatch(batchId: string): Promise<void> {
  const emails = await prisma.scheduledEmail.findMany({
    where: { batchId, status: 'PENDING' },
    select: { id: true, senderId: true, scheduledAt: true },
  });

  for (const email of emails) {
    await scheduleEmail(email.id, email.senderId, email.scheduledAt);
  }

  await prisma.emailBatch.update({
    where: { id: batchId },
    data: { status: 'PROCESSING' },
  });

  logger.info({ batchId, count: emails.length }, 'Batch scheduled');
}
