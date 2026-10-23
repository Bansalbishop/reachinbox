import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

vi.mock('../src/config', () => ({
  config: () => ({
    SMTP_HOST: 'smtp.ethereal.email',
    SMTP_PORT: 587,
    SMTP_USER: 'test@ethereal.email',
    SMTP_PASS: 'testpass',
  }),
}));

import { sendEmail } from '../src/services/email-sender';

describe('email-sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with messageId on SMTP acceptance', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<abc123@ethereal.email>' });

    const result = await sendEmail({
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('<abc123@ethereal.email>');
    expect(result.retryable).toBe(false);
  });

  it('returns retryable failure for transient SMTP errors', async () => {
    const err = new Error('Connection timeout');
    (err as any).responseCode = 421;
    mockSendMail.mockRejectedValue(err);

    const result = await sendEmail({
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('Connection timeout');
  });

  it('returns non-retryable failure for permanent SMTP errors (550)', async () => {
    const err = new Error('Mailbox not found');
    (err as any).responseCode = 550;
    mockSendMail.mockRejectedValue(err);

    const result = await sendEmail({
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('treats errors without a response code as retryable', async () => {
    mockSendMail.mockRejectedValue(new Error('Network error'));

    const result = await sendEmail({
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });
});
