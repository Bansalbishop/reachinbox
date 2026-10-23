import { Router } from 'express';
import { prisma } from '../db';
import { redis } from '../redis';
import { esClient } from '../services/search';
import { logger } from '../lib/logger';

const router = Router();

router.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
  }

  try {
    await redis().ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  try {
    await esClient().ping();
    checks.elasticsearch = 'ok';
  } catch {
    checks.elasticsearch = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'healthy' : 'degraded', checks });
});

export default router;
