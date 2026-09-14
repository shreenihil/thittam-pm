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
    const { dependsOnTaskId } = await req.json();

    if (!dependsOnTaskId || dependsOnTaskId === taskId) {
      return NextResponse.json({ error: 'Invalid dependency task selection' }, { status: 400 });
    }

    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const access = await checkProjectAccess(session, task.projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const dependency = await db.taskDependency.create({
      data: {
        taskId,
        dependsOnTaskId,
      },
      include: {
        dependsOnTask: true,
      },
    });

    return NextResponse.json({ success: true, dependency });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to add task dependency' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });

    const { dependencyId } = await req.json();

    await db.taskDependency.delete({
      where: { id: dependencyId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to remove dependency' }, { status: 500 });
  }
}
