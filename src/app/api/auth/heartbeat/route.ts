import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth';
import { SECURITY_HEADERS } from '@/lib/security';

export async function POST() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const dbSession = await db.session.findUnique({
    where: { sessionToken: token },
  });

  if (!dbSession) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const now = new Date();
  const inactivityMs = now.getTime() - dbSession.lastActiveAt.getTime();

  // If already inactive for > 30s before this ping arrived, reject and revoke
  if (inactivityMs > 30 * 1000) {
    await db.session.delete({ where: { id: dbSession.id } }).catch(() => {});
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ error: 'Session timed out due to inactivity' }, { status: 401, headers: SECURITY_HEADERS });
  }

  // Update lastActiveAt
  await db.session.update({
    where: { id: dbSession.id },
    data: { lastActiveAt: now },
  });

  return NextResponse.json(
    { success: true, lastActiveAt: now.toISOString() },
    {
      headers: {
        ...SECURITY_HEADERS,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
