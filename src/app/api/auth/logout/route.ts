import { NextResponse } from 'next/server';
import { clearSessionCookie, getAuthSession } from '@/lib/auth';
import { CSRF_COOKIE_NAME, SECURITY_HEADERS } from '@/lib/security';
import { db } from '@/lib/db';

export async function POST() {
  const session = await getAuthSession();
  if (session) {
    await db.activityLog.create({
      data: {
        entityType: 'user',
        entityId: session.id,
        action: 'logout_success',
        actorId: session.id,
      },
    }).catch(() => {});
  }

  await clearSessionCookie();
  const response = NextResponse.json({ success: true }, { headers: SECURITY_HEADERS });
  response.cookies.delete(CSRF_COOKIE_NAME);
  return response;
}
