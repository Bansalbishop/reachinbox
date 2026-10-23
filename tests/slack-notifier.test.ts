import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../src/db', () => ({
  prisma: {
    slackConnection: {
      findFirst: vi.fn(),
    },
  },
}));

const mockSet = vi.fn();
vi.mock('../src/redis', () => ({
  redis: () => ({ set: mockSet }),
}));

vi.mock('../src/config', () => ({
  config: () => ({
    SLACK_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
  }),
}));

const mockPostMessage = vi.fn();
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
  })),
}));

import { encryptToken, decryptToken, notifyQuotaHit } from '../src/services/slack-notifier';
import { prisma } from '../src/db';

describe('slack-notifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('token encryption', () => {
    it('encrypts and decrypts a token correctly', () => {
      const token = 'xoxb-test-token-12345';
      const encrypted = encryptToken(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted).not.toContain(token);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    it('produces different ciphertext for the same input (random IV)', () => {
      const token = 'xoxb-same-token';
      const e1 = encryptToken(token);
      const e2 = encryptToken(token);
      expect(e1).not.toBe(e2);
      // Both decrypt to the same value
      expect(decryptToken(e1)).toBe(token);
      expect(decryptToken(e2)).toBe(token);
    });
  });

  describe('notifyQuotaHit', () => {
    it('skips notification when no Slack connection exists', async () => {
      mockSet.mockResolvedValue('OK'); // isFirstQuotaHit returns true
      (prisma.slackConnection.findFirst as any).mockResolvedValue(null);

      await notifyQuotaHit('user-1', 'sender-1', 'test@example.com', 50);

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('skips duplicate notifications in the same hour', async () => {
      mockSet.mockResolvedValue(null); // isFirstQuotaHit returns false (already notified)

      await notifyQuotaHit('user-1', 'sender-1', 'test@example.com', 50);

      expect(prisma.slackConnection.findFirst).not.toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('does not crash when Slack API call fails', async () => {
      mockSet.mockResolvedValue('OK');
      (prisma.slackConnection.findFirst as any).mockResolvedValue({
        encryptedToken: encryptToken('xoxb-test'),
        channelId: 'C123',
        botUserId: 'U456',
      });
      mockPostMessage.mockRejectedValue(new Error('channel_not_found'));

      // Should not throw
      await notifyQuotaHit('user-1', 'sender-1', 'test@example.com', 50);
    });
  });
});
