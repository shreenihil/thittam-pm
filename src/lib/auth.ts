import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { UserSession } from './types';
import { generateCryptographicToken } from './security';

export const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-thittam_session' : 'thittam_session';
export const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days total token lifetime
export const INACTIVITY_TIMEOUT_MS = 30 * 1000; // 30 seconds inactivity / away threshold
export const BCRYPT_COST_FACTOR = 12;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Creates a server-side session in DB and sets the secure HttpOnly cookie
 */
export async function createServerSession(userId: string): Promise<string> {
  const sessionToken = generateCryptographicToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

  await db.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
      lastActiveAt: now,
    },
  });

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });

  return sessionToken;
}

/**
 * Validates session token against database store with 30s inactivity / away timeout
 */
export async function getAuthSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const dbSession = await db.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: { department: true, team: true },
      },
    },
  });

  if (!dbSession) return null;

  const now = new Date();

  // Check if session overall token expired
  if (now > dbSession.expiresAt) {
    await db.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    cookieStore.delete(COOKIE_NAME);
    return null;
  }

  // Check 30s inactivity / tab close / away timeout
  const inactivityMs = now.getTime() - dbSession.lastActiveAt.getTime();
  if (inactivityMs > INACTIVITY_TIMEOUT_MS) {
    await db.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    cookieStore.delete(COOKIE_NAME);
    return null;
  }

  // Check if user is active
  if (!dbSession.user || !dbSession.user.isActive) return null;

  // Check if user account is locked out
  if (dbSession.user.lockoutUntil && dbSession.user.lockoutUntil > now) {
    return null;
  }

  // Non-blocking update of lastActiveAt timestamp on valid navigation
  db.session.update({
    where: { id: dbSession.id },
    data: { lastActiveAt: now },
  }).catch(() => {});

  const user = dbSession.user;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as any,
    designation: user.designation,
    departmentId: user.departmentId,
    departmentName: user.department?.name || null,
    teamId: user.teamId,
    teamName: user.team?.name || null,
    mustResetPassword: user.mustResetPassword,
    weeklyCapacityHours: user.weeklyCapacityHours,
  };
}

/**
 * Revokes all sessions for a user (on logout or password change)
 */
export async function revokeUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } }).catch(() => {});
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Clears current session cookie and revokes database session
 */
export async function clearSessionCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
  }
}
