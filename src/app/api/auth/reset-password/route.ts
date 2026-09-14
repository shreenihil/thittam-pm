import { NextResponse } from 'next/server';
import { getAuthSession, hashPassword, revokeUserSessions } from '@/lib/auth';
import { db } from '@/lib/db';
import { validatePasswordStrength, SECURITY_HEADERS } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
    }

    const { newPassword } = await req.json();
    const strengthCheck = validatePasswordStrength(newPassword);

    if (!strengthCheck.isValid) {
      return NextResponse.json(
        { error: strengthCheck.error },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { id: session.id },
      data: {
        passwordHash,
        mustResetPassword: false,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    await db.activityLog.create({
      data: {
        entityType: 'user',
        entityId: session.id,
        action: 'password_reset_success',
        actorId: session.id,
      },
    }).catch(() => {});

    // Revoke all sessions on password change
    await revokeUserSessions(session.id);

    return NextResponse.json({ success: true }, { headers: SECURITY_HEADERS });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500, headers: SECURITY_HEADERS });
  }
}
