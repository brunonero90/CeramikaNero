import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton === undefined) {
    redisSingleton = createRedis();
  }
  return redisSingleton;
}

function createLimiter(
  redis: Redis,
  requests: number,
  window: '1 m' | '5 m' | '10 m' | '1 h',
  prefix: string
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: `ceramika-nero:${prefix}`,
  });
}

const limiters: Record<string, Ratelimit | null> = {};

function getLimiter(
  name: string,
  requests: number,
  window: '1 m' | '5 m' | '10 m' | '1 h'
): Ratelimit | null {
  if (limiters[name] !== undefined) return limiters[name];
  const redis = getRedis();
  if (!redis) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limit] Upstash Redis is not configured; booking rate limits are disabled until UPSTASH_REDIS_REST_URL/TOKEN are set.'
      );
    }
    limiters[name] = null;
    return null;
  }
  limiters[name] = createLimiter(redis, requests, window, name);
  return limiters[name];
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return h.get('x-real-ip') ?? 'unknown';
}

export async function getRateLimitKeys(input: {
  sessionId?: string;
  email?: string;
  token?: string;
}): Promise<{ ip: string; ipKey: string; secondaryKey: string }> {
  const ip = await getClientIp();
  const ipHash = sha256(ip);
  const secondary = input.sessionId
    ? `session:${input.sessionId}`
    : input.email
      ? `email:${sha256(input.email.toLowerCase())}`
      : input.token
        ? `token:${sha256(input.token)}`
        : `fallback:${randomUUID()}`;
  return {
    ip,
    ipKey: `ip:${ipHash}`,
    secondaryKey: secondary,
  };
}

type RateLimitResult =
  { success: true } | { success: false; retryAfter: number };

async function checkLimiter(
  limiter: Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  if (!limiter) {
    return { success: true };
  }
  const { success, reset } = await limiter.limit(key);
  if (success) return { success: true };
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return { success: false, retryAfter };
}

export async function checkBookingRateLimit(
  ipKey: string,
  secondaryKey: string
): Promise<RateLimitResult> {
  const limiter = getLimiter('booking', 5, '1 m');
  const ipResult = await checkLimiter(limiter, ipKey);
  if (!ipResult.success) return ipResult;
  return checkLimiter(limiter, secondaryKey);
}

export async function checkCancelRateLimit(
  tokenKey: string
): Promise<RateLimitResult> {
  const limiter = getLimiter('cancel', 10, '10 m');
  return checkLimiter(limiter, tokenKey);
}

export async function checkWebhookRateLimit(
  ipKey: string
): Promise<RateLimitResult> {
  const limiter = getLimiter('webhook', 100, '1 m');
  return checkLimiter(limiter, ipKey);
}
