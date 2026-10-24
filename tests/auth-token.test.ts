import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/config', () => ({
  config: () => ({
    SESSION_SECRET: 'test-secret-1234567890-test-secret-1234567890',
    SESSION_MAX_AGE_MS: 86400000,
  }),
}));

import { createAuthToken, verifyAuthToken } from '../src/lib/auth-token';

describe('auth-token', () => {
  it('creates and verifies a valid token', () => {
    const userId = 'user-test-123';
    const token = createAuthToken(userId);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const verified = verifyAuthToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(userId);
  });

  it('rejects tampered tokens', () => {
    const token = createAuthToken('user-123');
    const [payload, sig] = token.split('.');
    const tampered = `${payload}x.${sig}`;

    const verified = verifyAuthToken(tampered);
    expect(verified).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyAuthToken('')).toBeNull();
    expect(verifyAuthToken('not-a-token')).toBeNull();
    expect(verifyAuthToken('a.b.c')).toBeNull();
  });
});
