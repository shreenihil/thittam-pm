import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { canViewActivityLog } from '@/lib/permissions';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canViewActivityLog(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch actor details
  const actorIds = [...new Set(logs.map((l) => l.actorId))];
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true, designation: true, role: true },
  });

  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const enrichedLogs = logs.map((log) => ({
    ...log,
    actor: actorMap.get(log.actorId) || null,
    meta: log.meta ? JSON.parse(log.meta) : null,
  }));

  return NextResponse.json({ logs: enrichedLogs });
}
