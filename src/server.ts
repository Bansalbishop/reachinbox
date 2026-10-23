import { config } from './config';
import { createApp } from './app';
import { prisma } from './db';
import { logger } from './lib/logger';
import { reconcilePendingEmails } from './services/scheduler';
import { ensureIndex } from './services/search';

async function main() {
  const cfg = config();
  const app = createApp();

  // Connect to database
  await prisma.$connect();
  logger.info('Connected to PostgreSQL');

  // Ensure Elasticsearch index exists
  try {
    await ensureIndex();
    logger.info('Elasticsearch index ready');
  } catch (err) {
    logger.warn({ err }, 'Elasticsearch not available - search will use Postgres fallback');
  }

  // Reconcile any emails stuck in PENDING state
  try {
    const count = await reconcilePendingEmails();
    if (count > 0) logger.info({ count }, 'Reconciled pending emails on startup');
  } catch (err) {
    logger.error({ err }, 'Reconciliation failed - will retry on next restart');
  }

  const server = app.listen(cfg.PORT, () => {
    logger.info({ port: cfg.PORT, env: cfg.NODE_ENV }, 'API server started');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API server');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'API server failed to start');
  process.exit(1);
});
