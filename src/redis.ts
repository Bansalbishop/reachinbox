import Redis, { RedisOptions } from 'ioredis';
import { config } from './config';
import { logger } from './lib/logger';

function getRedisOptions(): RedisOptions {
  const url = config().REDIS_URL;
  const isTls = url.startsWith('rediss://');

  return {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,     // recommended for managed/cloud Redis
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  };
}

let _redis: Redis | null = null;

export function redis(): Redis {
  if (!_redis) {
    _redis = new Redis(config().REDIS_URL, getRedisOptions());
    _redis.on('error', (err) => {
      logger.error({ err: err?.message || err }, 'Redis connection error');
    });
  }
  return _redis;
}

export function createRedisConnection(): Redis {
  const conn = new Redis(config().REDIS_URL, getRedisOptions());
  conn.on('error', (err) => {
    logger.error({ err: err?.message || err }, 'BullMQ Redis connection error');
  });
  return conn;
}
