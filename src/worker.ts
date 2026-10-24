import { Worker, Job } from 'bullmq';
import { config } from './config';
import { prisma } from './db';
import { createRedisConnection } from './redis';
import { EMAIL_QUEUE_NAME, type EmailJobData } from './lib/email-queue';
import { logger } from './lib/logger';
import { sendEmail } from './services/email-sender';
import { reserveSendSlot } from './services/rate-limit';
import { notifyQuotaHit } from './services/slack-notifier';
import { updateEmailStatus } from './services/search';
import { reconcilePendingEmails } from './services/scheduler';

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, senderId } = job.data;
  const jobLog = logger.child({ jobId: job.id, emailId, senderId });

  // Claim the email atomically - prevents duplicate sends across workers
  const email = await prisma.scheduledEmail.updateMany({
    where: {
      id: emailId,
      status: { in: ['QUEUED', 'PENDING'] },
    },
    data: {
      status: 'SENDING',
      claimedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (email.count === 0) {
    // Already claimed/sent/failed by another worker or retry
    const current = await prisma.scheduledEmail.findUnique({
      where: { id: emailId },
      select: { status: true },
    });
    jobLog.info({ currentStatus: current?.status }, 'Email already claimed or processed, skipping');
    return;
  }

  // Load full email data
  const emailRecord = await prisma.scheduledEmail.findUnique({
    where: { id: emailId },
    include: { sender: true, batch: true },
  });

  if (!emailRecord) {
    jobLog.error('Email record not found');
    return;
  }

  // Check rate limit
  const reservation = await reserveSendSlot(
    senderId,
    emailRecord.sender.hourlyLimit,
    emailRecord.sender.minIntervalMs
  );

  if (!reservation.allowed) {
    // Reschedule - don't fail or drop the job
    const retryDelay = reservation.retryAfterMs + 500; // small buffer
    jobLog.info(
      { reason: reservation.reason, retryAfterMs: retryDelay },
      'Rate limited, rescheduling'
    );

    // Reset status back to QUEUED for rescheduling
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: 'QUEUED',
        claimedAt: null,
        scheduledAt: new Date(Date.now() + retryDelay),
      },
    });

    // Notify on quota hit
    if (reservation.reason === 'quota') {
      notifyQuotaHit(
        emailRecord.userId,
        senderId,
        emailRecord.sender.email,
        emailRecord.sender.hourlyLimit
      ).catch((err) => jobLog.error({ err }, 'Quota notification failed'));
    }

    // Throw a special error that BullMQ will retry with the specified delay
    const err = new Error('RATE_LIMITED');
    (err as any).retryDelay = retryDelay;
    throw err;
  }

  // Send the email
  const result = await sendEmail({
    from: emailRecord.sender.name
      ? `"${emailRecord.sender.name}" <${emailRecord.sender.email}>`
      : emailRecord.sender.email,
    to: emailRecord.recipient,
    subject: emailRecord.subject,
    html: emailRecord.body,
  });

  if (result.success) {
    // SMTP accepted - commit SENT status
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerMessageId: result.messageId || null,
        lastError: null,
      },
    });

    // Update batch counters
    await prisma.emailBatch.update({
      where: { id: emailRecord.batchId },
      data: { sentCount: { increment: 1 } },
    });

    // Update Elasticsearch (best-effort)
    updateEmailStatus(emailId, 'SENT', new Date().toISOString()).catch(() => {});

    jobLog.info({ messageId: result.messageId }, 'Email sent successfully');

    // Check if batch is complete
    const batch = await prisma.emailBatch.findUnique({
      where: { id: emailRecord.batchId },
    });
    if (batch && batch.sentCount + batch.failedCount >= batch.totalCount) {
      await prisma.emailBatch.update({
        where: { id: emailRecord.batchId },
        data: { status: 'COMPLETED' },
      });
    }
  } else if (!result.retryable) {
    // Permanent failure
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: 'FAILED',
        lastError: result.error,
      },
    });

    await prisma.emailBatch.update({
      where: { id: emailRecord.batchId },
      data: { failedCount: { increment: 1 } },
    });

    updateEmailStatus(emailId, 'FAILED').catch(() => {});
    jobLog.error({ error: result.error }, 'Email permanently failed');
  } else {
    // Transient failure - let BullMQ retry with backoff
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: 'QUEUED',
        claimedAt: null,
        lastError: result.error,
      },
    });

    updateEmailStatus(emailId, 'QUEUED').catch(() => {});
    throw new Error(`SMTP transient failure: ${result.error}`);
  }
}

// async function main() {
//   const cfg = config();

//   await prisma.$connect();
//   logger.info('Worker connected to PostgreSQL');

//   // Reconcile on startup
//   try {
//     const count = await reconcilePendingEmails();
//     if (count > 0) logger.info({ count }, 'Worker reconciled pending emails');
//   } catch (err) {
//     logger.error({ err }, 'Worker reconciliation failed');
//   }

//   const worker = new Worker<EmailJobData>(
//     EMAIL_QUEUE_NAME,
//     processEmailJob,
//     {
//       connection: createRedisConnection(),
//       concurrency: cfg.WORKER_CONCURRENCY,
//       limiter: undefined,
//     }
//   );

//   worker.on('completed', (job) => {
//     logger.debug({ jobId: job?.id }, 'Job completed');
//   });

//   worker.on('failed', (job, err) => {
//     // Rate-limited jobs will be retried by BullMQ
//     if (err.message === 'RATE_LIMITED') {
//       logger.debug({ jobId: job?.id }, 'Job rate-limited, will retry');
//     } else {
//       logger.error({ jobId: job?.id, err: { message: err.message } }, 'Job failed');
//     }
//   });

//   worker.on('error', (err) => {
//     logger.error({ err }, 'Worker error');
//   });

//   logger.info(
//     { concurrency: cfg.WORKER_CONCURRENCY, queue: EMAIL_QUEUE_NAME },
//     'Email worker started'
//   );

//   // Graceful shutdown
//   const shutdown = async (signal: string) => {
//     logger.info({ signal }, 'Shutting down worker');
//     await worker.close();
//     await prisma.$disconnect();
//     process.exit(0);
//   };

//   process.on('SIGTERM', () => shutdown('SIGTERM'));
//   process.on('SIGINT', () => shutdown('SIGINT'));
// }

// main().catch((err) => {
//   logger.error({ err }, 'Worker failed to start');
//   process.exit(1);
// });

export async function startEmailWorker(): Promise<Worker<EmailJobData>> {
  const cfg = config();

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: createRedisConnection(),
      concurrency: cfg.WORKER_CONCURRENCY,
      limiter: undefined,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job?.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    if (err.message === 'RATE_LIMITED') {
      logger.debug({ jobId: job?.id }, 'Job rate-limited, will retry');
    } else {
      logger.error(
        { jobId: job?.id, err: { message: err.message } },
        'Job failed'
      );
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  logger.info(
    {
      concurrency: cfg.WORKER_CONCURRENCY,
      queue: EMAIL_QUEUE_NAME,
    },
    'Email worker started'
  );

  return worker;
}
