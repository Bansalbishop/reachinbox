import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { encryptToken } from '../services/slack-notifier';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/slack/connect - Start Slack OAuth
router.get('/api/slack/connect', requireAuth, (req: Request, res: Response) => {
  const cfg = config();
  if (!cfg.SLACK_CLIENT_ID || !cfg.SLACK_REDIRECT_URI) {
    res.status(503).json({ error: { message: 'Slack not configured', code: 'SLACK_NOT_CONFIGURED' } });
    return;
  }

  const state = crypto.randomBytes(32).toString('hex');
  req.session.slackOauthState = state;

  const params = new URLSearchParams({
    client_id: cfg.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read',
    redirect_uri: cfg.SLACK_REDIRECT_URI,
    state,
  });

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, 'Failed to save session for Slack OAuth');
      res.status(500).json({ error: { message: 'Session error', code: 'SESSION_ERROR' } });
      return;
    }
    res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
  });
});

// GET /api/slack/callback - Handle Slack OAuth callback
router.get('/api/slack/callback', requireAuth, async (req: Request, res: Response) => {
  const cfg = config();
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.slackOauthState) {
    res.status(400).json({ error: { message: 'Invalid Slack OAuth state', code: 'INVALID_STATE' } });
    return;
  }
  delete req.session.slackOauthState;

  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.SLACK_CLIENT_ID,
        client_secret: cfg.SLACK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: cfg.SLACK_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json() as any;
    if (!data.ok) {
      logger.error({ slackError: data.error }, 'Slack OAuth token exchange failed');
      res.status(400).json({ error: { message: 'Slack authorization failed', code: 'SLACK_AUTH_FAILED' } });
      return;
    }

    const encryptedToken = encryptToken(data.access_token);

    await prisma.slackConnection.upsert({
      where: {
        userId_teamId: {
          userId: req.session.userId!,
          teamId: data.team.id,
        },
      },
      update: {
        encryptedToken,
        teamName: data.team.name,
        botUserId: data.bot_user_id,
        scopes: data.scope || '',
        channelId: data.incoming_webhook?.channel_id || null,
      },
      create: {
        userId: req.session.userId!,
        teamId: data.team.id,
        teamName: data.team.name,
        encryptedToken,
        botUserId: data.bot_user_id,
        scopes: data.scope || '',
        channelId: data.incoming_webhook?.channel_id || null,
      },
    });

    res.redirect(`${cfg.FRONTEND_URL}/slack/connected`);
  } catch (err) {
    logger.error({ err }, 'Slack OAuth callback error');
    res.status(500).json({ error: { message: 'Slack connection failed', code: 'SLACK_ERROR' } });
  }
});

// DELETE /api/slack/connection - Disconnect Slack
router.delete('/api/slack/connection', requireAuth, async (req: Request, res: Response) => {
  await prisma.slackConnection.deleteMany({
    where: { userId: req.session.userId },
  });
  res.json({ ok: true });
});

// GET /api/slack/connection - Check Slack connection status
router.get('/api/slack/connection', requireAuth, async (req: Request, res: Response) => {
  const connection = await prisma.slackConnection.findFirst({
    where: { userId: req.session.userId },
    select: { teamId: true, teamName: true, scopes: true, createdAt: true },
  });
  res.json({ connected: !!connection, connection });
});

export default router;
