import { NextResponse } from 'next/server';
import { SECURITY_HEADERS } from './security';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const tracker = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of tracker.entries()) {
      if (now > record.resetTime) {
        tracker.delete(key);
      }
    }
  }, 2 * 60 * 1000).unref?.();
}

/**
 * Extracts client IP safely from request headers
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * In-Memory Sliding Window Rate Limiter Helper
 * @param identifier IP or userId
 * @param maxHits Maximum allowed requests within window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxHits: number = 60,
  windowMs: number = 60 * 1000
): { isAllowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = tracker.get(identifier);

  if (!record || now > record.resetTime) {
    tracker.set(identifier, { count: 1, resetTime: now + windowMs });
    return { isAllowed: true, remaining: maxHits - 1, resetTime: now + windowMs };
  }

  if (record.count >= maxHits) {
    return { isAllowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { isAllowed: true, remaining: maxHits - record.count, resetTime: record.resetTime };
}

/**
 * Higher-level rate limit guard for Next.js route handlers
 */
export function applyRateLimit(
  req: Request,
  options: {
    maxHits?: number;
    windowMs?: number;
    keyPrefix?: string;
    customIdentifier?: string;
  } = {}
): { isAllowed: boolean; response?: NextResponse; headers: Record<string, string> } {
  const {
    maxHits = 60,
    windowMs = 60 * 1000,
    keyPrefix = 'global',
    customIdentifier,
  } = options;

  const ip = customIdentifier || getClientIp(req);
  const identifier = `${keyPrefix}:${ip}`;

  const { isAllowed, remaining, resetTime } = checkRateLimit(identifier, maxHits, windowMs);
  const retryAfterSec = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));

  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    'X-RateLimit-Limit': String(maxHits),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  };

  if (!isAllowed) {
    headers['Retry-After'] = String(retryAfterSec);
    const response = NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfterSeconds: retryAfterSec,
      },
      {
        status: 429,
        headers,
      }
    );
    return { isAllowed: false, response, headers };
  }

  return { isAllowed: true, headers };
}
