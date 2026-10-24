import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config';
import { emailQueue } from './lib/email-queue';
import { errorHandler, notFound } from './middleware/error-handler';
import { requireAuth } from './middleware/auth';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import senderRoutes from './routes/senders';
import slackRoutes from './routes/slack';

export function createApp() {
  const cfg = config();
  const app = express();

  if (cfg.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: cfg.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // Sessions stored in PostgreSQL
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: cfg.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: cfg.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: cfg.SESSION_MAX_AGE_MS,
        httpOnly: true,
        secure: cfg.NODE_ENV === 'production',
        sameSite: cfg.NODE_ENV === 'production' ? 'none' : 'lax',
      },
      name: 'outbox.sid',
    })
  );

  // Bull Board (protected)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue())],
    serverAdapter,
  });
  app.use('/admin/queues', requireAuth, serverAdapter.getRouter());

  // Routes
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(emailRoutes);
  app.use(senderRoutes);
  app.use(slackRoutes);

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
