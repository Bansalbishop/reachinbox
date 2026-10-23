import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({
      error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
    });
    return;
  }
  next();
}

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    userId: string;
    oauthState?: string;
    slackOauthState?: string;
  }
}
