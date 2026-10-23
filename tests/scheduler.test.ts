import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db', () => ({
  prisma: {
    scheduledEmail: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    emailBatch: {
      update: vi.fn(),
    },
  },
}));

const mockAdd = vi.fn();
vi.mock('../src/lib/email-queue', () => ({
  emailQueue: () => ({ add: mockAdd }),
}));

import { prisma } from '../src/db';
import { scheduleEmail, scheduleBatch, reconcilePendingEmails } from '../src/services/scheduler';

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleEmail', () => {
    it('creates a BullMQ job with correct delay and stable ID', async () => {
      mockAdd.mockResolvedValue({});
      (prisma.scheduledEmail.update as any).mockResolvedValue({});

      const futureDate = new Date(Date.now() + 60000);
      await scheduleEmail('email-123', 'sender-1', futureDate);

      expect(mockAdd).toHaveBeenCalledWith(
        'send',
        { emailId: 'email-123', senderId: 'sender-1' },
        expect.objectContaining({
          jobId: 'email-email-123',
          delay: expect.any(Number),
        })
      );

      // Delay should be approximately 60 seconds
      const delay = mockAdd.mock.calls[0][2].delay;
      expect(delay).toBeGreaterThan(50000);
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('updates email status to QUEUED', async () => {
      mockAdd.mockResolvedValue({});
      (prisma.scheduledEmail.update as any).mockResolvedValue({});

      await scheduleEmail('email-123', 'sender-1', new Date(Date.now() + 1000));

      expect(prisma.scheduledEmail.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: { status: 'QUEUED' },
      });
    });

    it('uses delay 0 for past-due emails', async () => {
      mockAdd.mockResolvedValue({});
      (prisma.scheduledEmail.update as any).mockResolvedValue({});

      await scheduleEmail('email-old', 'sender-1', new Date(Date.now() - 10000));

      const delay = mockAdd.mock.calls[0][2].delay;
      expect(delay).toBe(0);
    });
  });

  describe('scheduleBatch', () => {
    it('schedules all pending emails in a batch', async () => {
      const emails = [
        { id: 'e1', senderId: 's1', scheduledAt: new Date(Date.now() + 1000) },
        { id: 'e2', senderId: 's1', scheduledAt: new Date(Date.now() + 6000) },
        { id: 'e3', senderId: 's1', scheduledAt: new Date(Date.now() + 11000) },
      ];
      (prisma.scheduledEmail.findMany as any).mockResolvedValue(emails);
      mockAdd.mockResolvedValue({});
      (prisma.scheduledEmail.update as any).mockResolvedValue({});
      (prisma.emailBatch.update as any).mockResolvedValue({});

      await scheduleBatch('batch-1');

      expect(mockAdd).toHaveBeenCalledTimes(3);
      expect(prisma.emailBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { status: 'PROCESSING' },
      });
    });
  });

  describe('reconcilePendingEmails', () => {
    it('enqueues all PENDING emails and updates status', async () => {
      (prisma.scheduledEmail.findMany as any).mockResolvedValue([
        { id: 'orphan-1', senderId: 's1', scheduledAt: new Date(Date.now() + 5000) },
      ]);
      mockAdd.mockResolvedValue({});
      (prisma.scheduledEmail.update as any).mockResolvedValue({});

      const count = await reconcilePendingEmails();
      expect(count).toBe(1);
      expect(mockAdd).toHaveBeenCalledTimes(1);
    });

    it('handles already-queued jobs gracefully', async () => {
      (prisma.scheduledEmail.findMany as any).mockResolvedValue([
        { id: 'dup-1', senderId: 's1', scheduledAt: new Date() },
      ]);
      mockAdd.mockRejectedValue(new Error('job already exists'));
      (prisma.scheduledEmail.update as any).mockResolvedValue({});

      const count = await reconcilePendingEmails();
      expect(count).toBe(1);
    });
  });
});
