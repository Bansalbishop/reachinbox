import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { config } from '../config';
import { prisma } from '../db';
import { logger } from '../lib/logger';
import { isFirstQuotaHit } from './rate-limit';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  return Buffer.from(config().SLACK_TOKEN_ENCRYPTION_KEY, 'hex');
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(encrypted: string): string {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

export async function notifyQuotaHit(
  userId: string,
  senderId: string,
  senderEmail: string,
  hourlyLimit: number
): Promise<void> {
  const isFirst = await isFirstQuotaHit(senderId);
  if (!isFirst) return;

  const connection = await prisma.slackConnection.findFirst({
    where: { userId },
  });

  if (!connection) {
    logger.info({ userId, senderId }, 'No Slack connection, skipping quota notification');
    return;
  }

  try {
    const token = decryptToken(connection.encryptedToken);
    const client = new WebClient(token);

    const channelId = connection.channelId || connection.botUserId;
    if (!channelId) {
      logger.warn({ userId }, 'No Slack channel configured');
      return;
    }

    await client.chat.postMessage({
      channel: channelId,
      text: `⚠️ Hourly email quota reached for sender *${senderEmail}*. Limit: ${hourlyLimit}/hour. Remaining emails have been rescheduled to the next available slot.`,
    });

    logger.info({ userId, senderId, senderEmail }, 'Slack quota notification sent');
  } catch (err: any) {
    // Don't crash email processing on Slack failures
    logger.error(
      { err: { message: err.message, code: err.code }, userId, senderId },
      'Failed to send Slack notification'
    );
  }
}
