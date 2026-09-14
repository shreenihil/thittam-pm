import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparePassword, createServerSession, revokeUserSessions } from '@/lib/auth';
import { generateCryptographicToken, CSRF_COOKIE_NAME, SECURITY_HEADERS } from '@/lib/security';
import { applyRateLimit } from '@/lib/rateLimit';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 10, windowMs: 60 * 1000, keyPrefix: 'auth_login' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { department: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Check Account Lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMins = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked due to repeated failed login attempts. Please try again in ${remainingMins} minute(s).` },
        { status: 429, headers: SECURITY_HEADERS }
      );
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      // Atomic increment to prevent concurrent race condition updates
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
      });

      let lockoutUntil: Date | null = null;
      if (updatedUser.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await db.user.update({
          where: { id: user.id },
          data: { lockoutUntil },
        });
      }

      await db.activityLog.create({
        data: {
          entityType: 'user',
          entityId: user.id,
          action: lockoutUntil ? 'account_locked' : 'failed_login_attempt',
          actorId: user.id,
          meta: JSON.stringify({ attempts: updatedUser.failedLoginAttempts, email: user.email }),
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          error: lockoutUntil
            ? 'Too many failed attempts. Account locked for 15 minutes.'
            : 'Invalid email or password',
        },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Reset failed login attempts & lockout
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Revoke previous sessions & create fresh session
    await revokeUserSessions(user.id);
    await createServerSession(user.id);

    // Generate Double-Submit CSRF Token
    const csrfToken = generateCryptographicToken();

    await db.activityLog.create({
      data: {
        entityType: 'user',
        entityId: user.id,
        action: 'login_success',
        actorId: user.id,
      },
    }).catch(() => {});

    const response = NextResponse.json(
      {
        success: true,
        csrfToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          designation: user.designation,
          departmentId: user.departmentId,
          departmentName: user.department?.name || null,
          mustResetPassword: user.mustResetPassword,
          weeklyCapacityHours: user.weeklyCapacityHours,
        },
      },
      { headers: SECURITY_HEADERS }
    );

    // Set CSRF token cookie readable by client JS for header inclusion
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
