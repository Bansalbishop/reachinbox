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

// Full reconciliation: handles PENDING, stale SENDING (>5m), and overdue QUEUED emails
export async function reconcileOverdueEmails(): Promise<number> {
  let reconciled = await reconcilePendingEmails();

  try {
    // 1. Reset emails stuck in SENDING for > 5 minutes (worker crashed mid-send)
    const staleTime = new Date(Date.now() - 5 * 60 * 1000);
    const stuckEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: 'SENDING',
        claimedAt: { lt: staleTime },
      },
      select: { id: true, senderId: true },
    });

    for (const email of stuckEmails) {
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: 'QUEUED', claimedAt: null },
      });
      await emailQueue().add(
        'send',
        { emailId: email.id, senderId: email.senderId },
        { delay: 0 }
      );
      reconciled++;
    }

    // 2. Promote or re-enqueue overdue QUEUED emails (> 30s overdue)
    const overdueCutoff = new Date(Date.now() - 30 * 1000);
    const overdueEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: 'QUEUED',
        scheduledAt: { lt: overdueCutoff },
      },
      select: { id: true, senderId: true },
      take: 50,
    });

    const queue = emailQueue();
    for (const email of overdueEmails) {
      const jobId = `email-${email.id}`;
      try {
        const job = await queue.getJob(jobId);
        if (!job) {
          // Job not found in Redis (e.g. Redis restart or failed initial add)
          await queue.add(
            'send',
            { emailId: email.id, senderId: email.senderId },
            { jobId, delay: 0 }
          );
          reconciled++;
        } else {
          const state = await job.getState();
          if (state === 'delayed') {
            // Promote delayed job immediately since scheduled time has passed
            await job.promote();
            reconciled++;
          }
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, emailId: email.id }, 'Failed to check/promote overdue job');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error during overdue email reconciliation');
  }

  return reconciled;
}

// Background reconciliation runner
let _reconcileTimer: NodeJS.Timeout | null = null;

export function startPeriodicReconciliation(intervalMs = 30000): NodeJS.Timeout {
  if (_reconcileTimer) {
    clearInterval(_reconcileTimer);
  }

  _reconcileTimer = setInterval(async () => {
    try {
      await reconcileOverdueEmails();
    } catch (err) {
      logger.error({ err }, 'Background reconciliation loop error');
    }
  }, intervalMs);

  return _reconcileTimer;
}

export function stopPeriodicReconciliation(): void {
  if (_reconcileTimer) {
    clearInterval(_reconcileTimer);
    _reconcileTimer = null;
  }
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
