import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing rate-limit
const mockEval = vi.fn();
const mockSet = vi.fn();
const mockRedis = { eval: mockEval, set: mockSet };

vi.mock('../src/redis', () => ({
  redis: () => mockRedis,
}));

import { reserveSendSlot, isFirstQuotaHit } from '../src/services/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reserveSendSlot', () => {
    it('returns allowed when Lua script returns [0, 0]', async () => {
      mockEval.mockResolvedValue([0, 0]);
      const result = await reserveSendSlot('sender-1', 50, 5000);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it('returns quota exhausted when Lua script returns [1, delay]', async () => {
      mockEval.mockResolvedValue([1, 3200000]);
      const result = await reserveSendSlot('sender-1', 50, 5000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('quota');
      expect(result.retryAfterMs).toBe(3200000);
    });

    it('returns interval violation when Lua script returns [2, delay]', async () => {
      mockEval.mockResolvedValue([2, 3000]);
      const result = await reserveSendSlot('sender-1', 50, 5000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('interval');
      expect(result.retryAfterMs).toBe(3000);
    });

    it('uses sender-specific Redis keys', async () => {
      mockEval.mockResolvedValue([0, 0]);
      const now = new Date('2025-03-15T14:30:00Z').getTime();
      await reserveSendSlot('sender-abc', 100, 10000, now);

      const call = mockEval.mock.calls[0];
      // KEYS[1] should contain sender ID and hour key
      expect(call[2]).toContain('sender-abc');
      expect(call[2]).toContain('20250315T14');
      // KEYS[2] should be the last-send key
      expect(call[3]).toContain('sender-abc');
      expect(call[3]).toContain('last');
    });

    it('passes correct arguments to Lua script', async () => {
      mockEval.mockResolvedValue([0, 0]);
      await reserveSendSlot('s1', 75, 3000, 1000000);

      const call = mockEval.mock.calls[0];
      expect(call[4]).toBe(75);  // hourly limit
      expect(call[5]).toBe(3000); // min interval
      expect(call[6]).toBe(1000000); // now
    });

    it('throws on Redis errors', async () => {
      mockEval.mockRejectedValue(new Error('Redis connection lost'));
      await expect(reserveSendSlot('s1', 50, 5000)).rejects.toThrow('Redis connection lost');
    });

    it('maintains independent quotas for different senders', async () => {
      // sender-1 is rate-limited
      mockEval.mockResolvedValueOnce([1, 5000]);
      const r1 = await reserveSendSlot('sender-1', 50, 5000);
      expect(r1.allowed).toBe(false);

      // sender-2 is fine
      mockEval.mockResolvedValueOnce([0, 0]);
      const r2 = await reserveSendSlot('sender-2', 50, 5000);
      expect(r2.allowed).toBe(true);

      // Verify different keys were used
      const key1 = mockEval.mock.calls[0][2];
      const key2 = mockEval.mock.calls[1][2];
      expect(key1).not.toBe(key2);
    });
  });

  describe('isFirstQuotaHit', () => {
    it('returns true when NX set succeeds', async () => {
      mockSet.mockResolvedValue('OK');
      const result = await isFirstQuotaHit('sender-1');
      expect(result).toBe(true);
    });

    it('returns false when NX set fails (already notified)', async () => {
      mockSet.mockResolvedValue(null);
      const result = await isFirstQuotaHit('sender-1');
      expect(result).toBe(false);
    });

    it('uses sender-specific and hour-specific keys', async () => {
      mockSet.mockResolvedValue('OK');
      const now = new Date('2025-06-01T08:00:00Z').getTime();
      await isFirstQuotaHit('sender-xyz', now);

      const call = mockSet.mock.calls[0];
      expect(call[0]).toContain('sender-xyz');
      expect(call[0]).toContain('20250601T08');
    });
  });
});
