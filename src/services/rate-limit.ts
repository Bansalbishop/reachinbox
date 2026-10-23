import { redis } from '../redis';
import { logger } from '../lib/logger';

// Lua script for atomic rate-limit reservation.
// Enforces both hourly quota AND minimum interval between sends for a sender.
//
// Keys:
//   KEYS[1] = sender hourly counter key (e.g., ratelimit:sender:<senderId>:hour:<hourKey>)
//   KEYS[2] = sender last-send timestamp key (e.g., ratelimit:sender:<senderId>:last)
//
// Args:
//   ARGV[1] = hourly limit
//   ARGV[2] = minimum interval in milliseconds
//   ARGV[3] = current time in milliseconds
//   ARGV[4] = TTL for hour key in seconds
//
// Returns:
//   [0, 0]                  -> reserved OK, can send now
//   [1, <retryAfterMs>]     -> hourly quota exhausted, retry after this many ms
//   [2, <retryAfterMs>]     -> min interval not met, retry after this many ms
const RESERVE_SCRIPT = `
local hourKey = KEYS[1]
local lastKey = KEYS[2]
local hourlyLimit = tonumber(ARGV[1])
local minIntervalMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local ttlSeconds = tonumber(ARGV[4])

-- Check hourly quota
local current = tonumber(redis.call('GET', hourKey) or '0')
if current >= hourlyLimit then
  local pttl = redis.call('PTTL', hourKey)
  if pttl < 0 then pttl = ttlSeconds * 1000 end
  return {1, pttl}
end

-- Check minimum interval
local lastSendMs = tonumber(redis.call('GET', lastKey) or '0')
local elapsed = nowMs - lastSendMs
if elapsed < minIntervalMs then
  return {2, minIntervalMs - elapsed}
end

-- Reserve: increment counter and set last-send time
redis.call('INCR', hourKey)
-- Set TTL only if key was just created (PTTL returns -1 if no expiry)
local existingTtl = redis.call('PTTL', hourKey)
if existingTtl < 0 then
  redis.call('PEXPIRE', hourKey, ttlSeconds * 1000)
end

redis.call('SET', lastKey, tostring(nowMs), 'PX', minIntervalMs * 2 + 60000)

return {0, 0}
`;

export interface ReservationResult {
  allowed: boolean;
  retryAfterMs: number;
  reason?: 'quota' | 'interval';
}

// Hour key uses UTC floored to the hour for consistent windows.
function hourKey(senderId: string, nowMs: number): string {
  const d = new Date(nowMs);
  const h = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
  return `ratelimit:sender:${senderId}:hour:${h}`;
}

function lastSendKey(senderId: string): string {
  return `ratelimit:sender:${senderId}:last`;
}

export async function reserveSendSlot(
  senderId: string,
  hourlyLimit: number,
  minIntervalMs: number,
  nowMs: number = Date.now()
): Promise<ReservationResult> {
  const r = redis();
  // TTL = seconds until end of current UTC hour
  const msUntilNextHour = 3600000 - (nowMs % 3600000);
  const ttlSeconds = Math.ceil(msUntilNextHour / 1000) + 60; // +60s buffer

  try {
    const result = (await r.eval(
      RESERVE_SCRIPT,
      2,
      hourKey(senderId, nowMs),
      lastSendKey(senderId),
      hourlyLimit,
      minIntervalMs,
      nowMs,
      ttlSeconds
    )) as [number, number];

    const [code, retryAfterMs] = result;
    if (code === 0) {
      return { allowed: true, retryAfterMs: 0 };
    }
    return {
      allowed: false,
      retryAfterMs,
      reason: code === 1 ? 'quota' : 'interval',
    };
  } catch (err) {
    logger.error({ err, senderId }, 'Rate-limit reservation failed');
    throw err;
  }
}

// Quota-hit deduplication: returns true only on the first call per sender per hour window.
export async function isFirstQuotaHit(senderId: string, nowMs: number = Date.now()): Promise<boolean> {
  const r = redis();
  const d = new Date(nowMs);
  const h = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
  const key = `ratelimit:sender:${senderId}:quota_notified:${h}`;
  const set = await r.set(key, '1', 'EX', 3700, 'NX');
  return set === 'OK';
}
