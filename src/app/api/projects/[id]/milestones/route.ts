import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import { emitToProject } from '@/lib/socket-server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const access = await checkProjectAccess(session, id);
  if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const milestones = await db.milestone.findMany({
    where: { projectId: id },
    orderBy: { dueDate: 'asc' },
  });

  return NextResponse.json({ milestones });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const access = await checkProjectAccess(session, id);
    if (!access.hasAccess || session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden: Cannot create milestones' }, { status: 403 });
    }

    const { title, description, dueDate } = await req.json();
    if (!title || !dueDate) {
      return NextResponse.json({ error: 'Title and due date are required' }, { status: 400 });
    }

    const milestone = await db.milestone.create({
      data: {
        projectId: id,
        title: title.trim(),
        description: description ? description.trim() : null,
        dueDate: new Date(dueDate),
      },
    });

    await db.activityLog.create({
      data: {
        entityType: 'milestone',
        entityId: milestone.id,
        action: 'created',
        actorId: session.id,
        meta: JSON.stringify({ projectId: id, title }),
      },
    });

    emitToProject(id, 'milestone:created', { milestone, projectId: id });

    return NextResponse.json({ success: true, milestone });
  } catch (err: any) {
    console.error('Create milestone error:', err);
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const access = await checkProjectAccess(session, id);
    if (!access.hasAccess || session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { milestoneId, isCompleted, title, description, dueDate } = await req.json();
    if (!milestoneId) {
      return NextResponse.json({ error: 'Milestone ID required' }, { status: 400 });
    }

    const milestone = await db.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(isCompleted !== undefined ? { isCompleted } : {}),
        ...(title ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      },
    });

    emitToProject(id, 'milestone:updated', { milestone, projectId: id });

    return NextResponse.json({ success: true, milestone });
  } catch (err: any) {
    console.error('Update milestone error:', err);
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const access = await checkProjectAccess(session, id);
    if (!access.hasAccess || session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const milestoneId = searchParams.get('milestoneId');
    if (!milestoneId) return NextResponse.json({ error: 'Milestone ID required' }, { status: 400 });

    await db.milestone.delete({ where: { id: milestoneId } });

    emitToProject(id, 'milestone:deleted', { milestoneId, projectId: id });

    return NextResponse.json({ success: true, message: 'Milestone deleted' });
  } catch (err: any) {
    console.error('Delete milestone error:', err);
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}
