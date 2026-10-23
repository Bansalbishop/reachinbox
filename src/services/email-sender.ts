import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../lib/logger';

let _transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const cfg = config();
    _transporter = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: false,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });
  }
  return _transporter;
}

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable: boolean;
}

const PERMANENT_CODES = new Set([550, 551, 552, 553, 554]);

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  try {
    const info = await getTransporter().sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    logger.info({ messageId: info.messageId, to: params.to }, 'Email sent via SMTP');
    return { success: true, messageId: info.messageId, retryable: false };
  } catch (err: any) {
    const code = err?.responseCode;
    const retryable = !PERMANENT_CODES.has(code);
    logger.error(
      { err: { message: err.message, code }, to: params.to, retryable },
      'SMTP send failed'
    );
    return { success: false, error: err.message, retryable };
  }
}
