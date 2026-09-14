import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const access = await checkProjectAccess(session, id);
  if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch all tasks of this project to get task IDs
  const tasks = await db.task.findMany({
    where: { projectId: id },
    select: { id: true, taskNumber: true, title: true },
  });
  const taskIds = tasks.map((t) => t.id);

  // Fetch logs for project and its tasks
  const logs = await db.activityLog.findMany({
    where: {
      OR: [
        { entityType: 'project', entityId: id },
        { entityType: 'task', entityId: { in: taskIds } },
        { entityType: 'milestone', meta: { contains: id } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch actor details
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId)));
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, role: true, designation: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const formattedLogs = logs.map((log) => {
    let parsedMeta: any = null;
    try {
      if (log.meta) parsedMeta = JSON.parse(log.meta);
    } catch (e) {}

    return {
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      actor: actorMap.get(log.actorId) || { name: 'System', role: 'SYSTEM' },
      meta: parsedMeta,
      createdAt: log.createdAt,
    };
  });

  return NextResponse.json({ history: formattedLogs });
}
