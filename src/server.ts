import { config } from "./config";
import { createApp } from "./app";
import { prisma } from "./db";
import { logger } from "./lib/logger";
import { startEmailWorker } from "./worker";
import type { Worker } from "bullmq";
import type { EmailJobData } from "./lib/email-queue";
import {
  reconcileOverdueEmails,
  startPeriodicReconciliation,
  stopPeriodicReconciliation,
} from "./services/scheduler";
import { ensureIndex } from "./services/search";

async function main() {
  const cfg = config();
  const app = createApp();

  // Connect to database
  await prisma.$connect();
  logger.info("Connected to PostgreSQL");

  // Ensure Elasticsearch index exists (optional)
  try {
    await ensureIndex();
    logger.info("Elasticsearch index ready");
  } catch (err) {
    logger.warn(
      { err },
      "Elasticsearch not available - search will use Postgres fallback",
    );
  }

  // Start BullMQ email worker first so it's ready to process jobs
  const worker: Worker<EmailJobData> = await startEmailWorker();

  // Reconcile any emails stuck in PENDING, stale SENDING, or overdue QUEUED state
  try {
    const count = await reconcileOverdueEmails();
    if (count > 0) {
      logger.info({ count }, "Reconciled overdue emails on startup");
    }
  } catch (err) {
    logger.error({ err }, "Reconciliation failed - will retry on next check");
  }

  // Start periodic background reconciliation loop (every 30 seconds)
  startPeriodicReconciliation(30000);
  logger.info("Started periodic queue reconciliation runner (30s interval)");

  const server = app.listen(cfg.PORT, () => {
    logger.info({ port: cfg.PORT, env: cfg.NODE_ENV }, "API server started");
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down API, worker, and reconciliation runner");

    stopPeriodicReconciliation();
    server.close();

    await worker.close();
    await prisma.$disconnect();

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "API server failed to start");
  process.exit(1);
});
