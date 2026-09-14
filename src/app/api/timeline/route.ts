import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import { emitToProject } from '@/lib/socket-server';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  let whereClause: any = {};
  if (projectId) whereClause.projectId = projectId;

  if (session.role === 'EMPLOYEE' || session.role === 'INTERN') {
    whereClause.OR = [
      { userId: session.id },
      { project: { members: { some: { userId: session.id } } } },
    ];
  } else if (session.role === 'HOD' || session.role === 'TEAM_LEAD') {
    whereClause.project = { departmentId: session.departmentId };
  }

  const entries = await db.timelineEntry.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          designation: true,
        },
      },
      project: {
        select: {
          id: true,
          projectNumber: true,
          title: true,
        },
      },
      task: {
        select: {
          id: true,
          taskNumber: true,
          title: true,
        },
      },
    },
    orderBy: { entryDate: 'desc' },
  });

  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, taskId, note, hoursSpent, entryDate } = body;

    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    let targetProjectId = projectId;

    if (!targetProjectId && taskId) {
      const task = await db.task.findUnique({ where: { id: taskId } });
      if (task) targetProjectId = task.projectId;
    }

    if (!targetProjectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 });
    }

    const access = await checkProjectAccess(session, targetProjectId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const entry = await db.timelineEntry.create({
      data: {
        projectId: targetProjectId,
        taskId: taskId || null,
        userId: session.id,
        note: note.trim(),
        hoursSpent: hoursSpent ? Number(hoursSpent) : null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            designation: true,
          },
        },
        project: true,
        task: true,
      },
    });

    // Real-Time Socket Emission
    emitToProject(targetProjectId, 'timeline:added', {
      entry,
      projectId: targetProjectId,
      actor: { id: session.id, name: session.name, role: session.role },
    });
    emitToProject(targetProjectId, 'workload:updated', { projectId: targetProjectId });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error('Create timeline entry error:', error);
    return NextResponse.json({ error: 'Failed to create timeline entry' }, { status: 500 });
  }
}
