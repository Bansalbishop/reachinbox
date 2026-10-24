import crypto from 'crypto';
import { config } from '../config';

interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createAuthToken(userId: string): string {
  const cfg = config();
  const now = Date.now();
  const payload: TokenPayload = {
    userId,
    iat: now,
    exp: now + (cfg.SESSION_MAX_AGE_MS || TOKEN_EXPIRY_MS),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', cfg.SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): { userId: string } | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const cfg = config();
  const expectedSig = crypto
    .createHmac('sha256', cfg.SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload: TokenPayload = JSON.parse(payloadJson);

    if (!payload.userId || typeof payload.userId !== 'string') {
      return null;
    }

    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
