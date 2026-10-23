import { Queue } from 'bullmq';
import { createRedisConnection } from '../redis';

export const EMAIL_QUEUE_NAME = 'email-send';

let _queue: Queue | null = null;

export function emailQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(EMAIL_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000, age: 86400 * 7 },
        removeOnFail: { count: 5000, age: 86400 * 30 },
      },
    });
  }
  return _queue;
}

export interface EmailJobData {
  emailId: string;
  senderId: string;
  attempt?: number;
}
