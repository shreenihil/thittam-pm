import crypto from 'crypto';
import { cookies } from 'next/headers';

// Top common passwords list (top 100 sample + common weak patterns)
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '123456789', '12345678', '12345', '1234567', '1234', 'qwerty',
  '1234567890', '111111', '123123', 'admin', 'password1', 'thittam123', 'letmein',
  'welcome', 'monkey', 'footbal', 'dragon', 'master', 'access', 'shadow', 'superman',
  'michael', 'football', 'baseball', 'harley', 'jordan', 'iloveyou', 'sunshine',
]);

/**
 * Validates minimum password policy:
 * - Minimum length >= 10
 * - Rejects top common passwords
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 10) {
    return { isValid: false, error: 'Password must be at least 10 characters long.' };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return { isValid: false, error: 'This password is too common and easily guessed. Please choose a stronger password.' };
  }

  return { isValid: true };
}

/**
 * Cryptographically random token generator (256 bits entropy)
 */
export function generateCryptographicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Standard OWASP security headers object including Content-Security-Policy
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self';",
};

/**
 * CSRF Header & Cookie constants
 */
export const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-csrf_token' : 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Validates double-submit CSRF token header against CSRF cookie
 */
export function verifyCsrfToken(req: Request): boolean {
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  const cookieStore = cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) return false;
  return crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken));
}
