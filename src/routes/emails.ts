import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db';
import { scheduleBatch } from '../services/scheduler';
import { indexEmail } from '../services/search';
import { logger } from '../lib/logger';

const router = Router();

const createBatchSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  recipients: z.array(z.string().email()).min(1).max(1000),
  senderId: z.string().min(1),
  startAt: z.string().datetime(),
  idempotencyKey: z.string().min(1).max(255),
});

// POST /api/email-batches
router.post('/api/email-batches', requireAuth, async (req: Request, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
  const body = { ...req.body, idempotencyKey: idempotencyKey || req.body.idempotencyKey };

  const parsed = createBatchSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    });
    return;
  }

  const userId = req.session.userId!;
  const { subject, body: emailBody, recipients, senderId, startAt } = parsed.data;

  // Verify sender belongs to user
  const sender = await prisma.sender.findFirst({
    where: { id: senderId, userId, enabled: true },
  });
  if (!sender) {
    res.status(404).json({
      error: { message: 'Sender not found or disabled', code: 'SENDER_NOT_FOUND' },
    });
    return;
  }

  // Idempotency check
  const existing = await prisma.emailBatch.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
  });
  if (existing) {
    if (existing.userId !== userId) {
      res.status(409).json({
        error: { message: 'Idempotency key conflict', code: 'IDEMPOTENCY_CONFLICT' },
      });
      return;
    }
    res.status(200).json({ batch: existing, created: false });
    return;
  }

  const startDate = new Date(startAt);
  if (startDate.getTime() < Date.now() - 60000) {
    res.status(400).json({
      error: { message: 'startAt must be in the future', code: 'INVALID_START_TIME' },
    });
    return;
  }

  // Create batch and all emails in a transaction
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.emailBatch.create({
      data: {
        userId,
        subject,
        body: emailBody,
        startAt: startDate,
        idempotencyKey: parsed.data.idempotencyKey,
        totalCount: recipients.length,
      },
    });

    // Space emails by sender's minimum interval
    const scheduledEmails = recipients.map((recipient, i) => ({
      batchId: b.id,
      userId,
      senderId,
      recipient,
      subject,
      body: emailBody,
      scheduledAt: new Date(startDate.getTime() + i * sender.minIntervalMs),
      idempotencyKey: `${parsed.data.idempotencyKey}:${i}`,
    }));

    await tx.scheduledEmail.createMany({ data: scheduledEmails });
    return b;
  });

  // Schedule into BullMQ (outside transaction - reconciliation handles failures)
  try {
    await scheduleBatch(batch.id);
  } catch (err) {
    logger.error({ err, batchId: batch.id }, 'Failed to schedule batch into queue - will be reconciled');
  }

  // Index in Elasticsearch (best-effort)
  const emails = await prisma.scheduledEmail.findMany({
    where: { batchId: batch.id },
    include: { sender: true },
  });
  for (const email of emails) {
    indexEmail({
      emailId: email.id,
      userId: email.userId,
      senderId: email.senderId,
      batchId: email.batchId,
      senderEmail: email.sender.email,
      recipient: email.recipient,
      subject: email.subject,
      status: email.status,
      scheduledAt: email.scheduledAt.toISOString(),
      createdAt: email.createdAt.toISOString(),
    }).catch(() => {}); // Fire and forget, reconciliation handles failures
  }

  res.status(201).json({ batch, created: true });
});

// GET /api/email-batches
router.get('/api/email-batches', requireAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));

  const [batches, total] = await Promise.all([
    prisma.emailBatch.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.emailBatch.count({ where: { userId: req.session.userId } }),
  ]);

  res.json({ batches, total, page, size });
});

// GET /api/emails/scheduled
router.get('/api/emails/scheduled', requireAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));

  const [emails, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: { userId: req.session.userId, status: { in: ['PENDING', 'QUEUED'] } },
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * size,
      take: size,
      include: { sender: { select: { email: true, name: true } } },
    }),
    prisma.scheduledEmail.count({
      where: { userId: req.session.userId, status: { in: ['PENDING', 'QUEUED'] } },
    }),
  ]);

  res.json({ emails, total, page, size });
});

// GET /api/emails/sent
router.get('/api/emails/sent', requireAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));

  const [emails, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: { userId: req.session.userId, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
      include: { sender: { select: { email: true, name: true } } },
    }),
    prisma.scheduledEmail.count({
      where: { userId: req.session.userId, status: 'SENT' },
    }),
  ]);

  res.json({ emails, total, page, size });
});

// GET /api/emails - Search/filter via Elasticsearch
router.get('/api/emails', requireAuth, async (req: Request, res: Response) => {
  const { searchEmails } = await import('../services/search');

  try {
    const result = await searchEmails({
      userId: req.session.userId!,
      recipient: req.query.recipient as string,
      subject: req.query.subject as string,
      senderEmail: req.query.senderEmail as string,
      senderId: req.query.senderId as string,
      status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: parseInt(req.query.page as string) || 1,
      size: Math.min(100, parseInt(req.query.size as string) || 20),
    });

    res.json(result);
  } catch (err) {
    // Fallback to Postgres if ES is down
    logger.error({ err }, 'Elasticsearch search failed, falling back to Postgres');
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));

    const where: any = { userId: req.session.userId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.senderId) where.senderId = req.query.senderId;
    if (req.query.recipient) where.recipient = { contains: req.query.recipient, mode: 'insensitive' };

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        include: { sender: { select: { email: true, name: true } } },
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    res.json({ hits: emails, total, page, size, source: 'postgres' });
  }
});

export default router;
