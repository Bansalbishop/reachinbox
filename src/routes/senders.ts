import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db';
import { config } from '../config';

const router = Router();

const createSenderSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  hourlyLimit: z.number().int().min(1).max(1000).optional(),
  minIntervalMs: z.number().int().min(0).max(60000).optional(),
});

// GET /api/senders
router.get('/api/senders', requireAuth, async (req: Request, res: Response) => {
  const senders = await prisma.sender.findMany({
    where: { userId: req.session.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ senders });
});

// POST /api/senders
router.post('/api/senders', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
    });
    return;
  }

  const cfg = config();
  const { email, name, hourlyLimit, minIntervalMs } = parsed.data;

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: { userId: req.session.userId!, email },
    },
    update: {
      name,
      hourlyLimit: hourlyLimit ?? cfg.DEFAULT_HOURLY_LIMIT,
      minIntervalMs: minIntervalMs ?? cfg.DEFAULT_MIN_INTERVAL_MS,
    },
    create: {
      userId: req.session.userId!,
      email,
      name,
      hourlyLimit: hourlyLimit ?? cfg.DEFAULT_HOURLY_LIMIT,
      minIntervalMs: minIntervalMs ?? cfg.DEFAULT_MIN_INTERVAL_MS,
    },
  });

  res.status(201).json({ sender });
});

export default router;
