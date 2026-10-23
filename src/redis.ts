import Redis from 'ioredis';
import { config } from './config';

let _redis: Redis | null = null;

export function redis(): Redis {
  if (!_redis) {
    _redis = new Redis(config().REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return _redis;
}

export function createRedisConnection(): Redis {
  return new Redis(config().REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
