import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

function oauthClient(): OAuth2Client {
  const cfg = config();
  return new OAuth2Client(cfg.GOOGLE_CLIENT_ID, cfg.GOOGLE_CLIENT_SECRET, cfg.GOOGLE_CALLBACK_URL);
}

// GET /auth/google - Initiate Google OAuth
router.get('/auth/google', (req: Request, res: Response) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'consent',
  });

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, 'Failed to save session before OAuth redirect');
      res.status(500).json({ error: { message: 'Session error', code: 'SESSION_ERROR' } });
      return;
    }
    res.redirect(url);
  });
});

// GET /auth/google/callback - Handle Google OAuth callback
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cfg = config();

  if (!code || !state || state !== req.session.oauthState) {
    res.status(400).json({ error: { message: 'Invalid OAuth state', code: 'INVALID_STATE' } });
    return;
  }
  delete req.session.oauthState;

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: cfg.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      res.status(400).json({ error: { message: 'Invalid token payload', code: 'INVALID_TOKEN' } });
      return;
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        email: payload.email || '',
        name: payload.name || '',
        avatar: payload.picture || null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        avatar: payload.picture || null,
      },
    });

    // Regenerate session after login
    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, 'Session regeneration failed');
        res.status(500).json({ error: { message: 'Session error', code: 'SESSION_ERROR' } });
        return;
      }
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error({ err: saveErr }, 'Session save failed');
          res.status(500).json({ error: { message: 'Session error', code: 'SESSION_ERROR' } });
          return;
        }
        res.redirect(cfg.FRONTEND_URL);
      });
    });
  } catch (err) {
    logger.error({ err }, 'Google OAuth callback failed');
    res.status(500).json({ error: { message: 'Authentication failed', code: 'AUTH_FAILED' } });
  }
});

// GET /api/auth/me - Return authenticated user
router.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, name: true, avatar: true, createdAt: true },
  });

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
    return;
  }

  res.json({ user });
});

// POST /api/auth/logout
router.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, 'Logout session destroy failed');
    }
    res.clearCookie('outbox.sid');
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

export default router;
