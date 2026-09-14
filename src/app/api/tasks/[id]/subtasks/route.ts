import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });

    const taskId = params.id;
    const { title } = await req.json();

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const access = await checkProjectAccess(session, task.projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const count = await db.subtask.count({ where: { taskId } });

    const subtask = await db.subtask.create({
      data: {
        taskId,
        title,
        order: count + 1,
      },
    });

    return NextResponse.json({ success: true, subtask });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });

    const { subtaskId, isDone } = await req.json();

    const subtask = await db.subtask.update({
      where: { id: subtaskId },
      data: { isDone: Boolean(isDone) },
    });

    return NextResponse.json({ success: true, subtask });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 });
  }
}
