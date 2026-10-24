import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../lib/auth-token';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Session cookie check
  if (req.session?.userId) {
    return next();
  }

  // 2. Authorization header: Bearer <token>
  let token: string | undefined;
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query?.token && typeof req.query.token === 'string') {
    // 3. Query param token (e.g. Bull Board direct URL or OAuth redirect)
    token = req.query.token.trim();
  }

  if (token) {
    const verified = verifyAuthToken(token);
    if (verified?.userId) {
      if (!req.session) {
        (req as any).session = {};
      }
      req.session.userId = verified.userId;
      return next();
    }
  }

  res.status(401).json({
    error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
  });
}

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    userId: string;
    oauthState?: string;
    slackOauthState?: string;
  }
}
