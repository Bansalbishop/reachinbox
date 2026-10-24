import { Router } from 'express';
import { prisma } from '../db';
import { redis } from '../redis';
import { esClient } from '../services/search';

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
    checks.elasticsearch = 'unavailable';
  }

  const criticalOk = checks.postgres === 'ok' && checks.redis === 'ok';
  const allOk = criticalOk && checks.elasticsearch === 'ok';

  // Return HTTP 200 as long as critical services (Postgres + Redis) are operational.
  // Elasticsearch has Postgres fallback in production.
  res.status(criticalOk ? 200 : 503).json({
    status: allOk ? 'healthy' : criticalOk ? 'degraded' : 'unhealthy',
    checks,
  });
});

export default router;
