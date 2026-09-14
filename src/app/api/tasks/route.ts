import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import { emitToProject, emitToUser } from '@/lib/socket-server';
import { applyRateLimit } from '@/lib/rateLimit';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const assigneeId = searchParams.get('assigneeId');
  const priority = searchParams.get('priority');

  let whereClause: any = {};
  if (projectId) whereClause.projectId = projectId;
  if (assigneeId) whereClause.assigneeId = assigneeId;
  if (priority && VALID_PRIORITIES.includes(priority.toUpperCase())) {
    whereClause.priority = priority.toUpperCase();
  }

  const tasks = await db.task.findMany({
    where: whereClause,
    include: {
      assignee: true,
      project: true,
      labels: { include: { label: true } },
      subtasks: { orderBy: { order: 'asc' } },
      blockedBy: {
        include: {
          dependsOnTask: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      ...t,
      labels: t.labels.map((l) => l.label),
    })),
  });
}

export async function POST(req: Request) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 120, windowMs: 60 * 1000, keyPrefix: 'tasks_post' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden: Viewer accounts cannot create tasks' }, { status: 403 });
    }

    const body = await req.json();
    const {
      projectId,
      title,
      description,
      assigneeId,
      startDate,
      dueDate,
      estimatedHours,
      status,
      priority,
      labelIds,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'Project ID and title are required' }, { status: 400 });
    }

    const access = await checkProjectAccess(session, projectId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Validate assignee if provided
    if (assigneeId) {
      const assigneeUser = await db.user.findUnique({ where: { id: assigneeId } });
      if (!assigneeUser || !assigneeUser.isActive) {
        return NextResponse.json({ error: 'Invalid or inactive assignee user' }, { status: 400 });
      }

      // If Team Lead is assigning, ensure assignee is in their team
      if (session.role === 'TEAM_LEAD' && session.teamId) {
        const isInTeam = assigneeUser.teamId === session.teamId;
        if (!isInTeam && assigneeId !== session.id) {
          return NextResponse.json({ error: 'Team Leads can only assign tasks within their own team' }, { status: 403 });
        }
      }

      // Ensure assignee is linked to project members
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: assigneeId } },
        update: {},
        create: {
          projectId,
          userId: assigneeId,
          isLead: false,
          addedVia: 'task_assignment',
        },
      });
    }

    // Collision-proof sequential task number generation with retry loop
    const existingTasks = await db.task.findMany({
      where: { projectId },
      select: { taskNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let maxTaskSeq = existingTasks.length;
    for (const t of existingTasks) {
      const match = t.taskNumber.match(/-T(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxTaskSeq) maxTaskSeq = num;
      }
    }

    const validatedPriority = priority && VALID_PRIORITIES.includes(String(priority).toUpperCase())
      ? String(priority).toUpperCase()
      : 'MEDIUM';

    let task: any = null;
    let attempts = 0;
    while (!task && attempts < 5) {
      attempts++;
      const currentSeq = maxTaskSeq + attempts;
      const taskNumber = `${project.projectNumber}-T${currentSeq}`;

      try {
        task = await db.task.create({
          data: {
            taskNumber,
            projectId,
            title: title.trim(),
            description: description ? description.trim() : null,
            assigneeId: assigneeId || null,
            status: status || 'TODO',
            priority: validatedPriority,
            version: 1,
            startDate: startDate ? new Date(startDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            estimatedHours: estimatedHours ? Number(estimatedHours) : null,
          },
          include: {
            assignee: true,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempts < 5) {
          // Collision under high concurrency: retry with next sequence number
          continue;
        }
        throw err;
      }
    }

    if (!task) {
      throw new Error('Failed to generate a unique task identifier. Please retry.');
    }

    if (Array.isArray(labelIds)) {
      for (const lId of labelIds) {
        await db.taskLabel.create({
          data: { taskId: task.id, labelId: lId },
        });
      }
    }

    if (assigneeId) {
      const notif = await db.notification.create({
        data: {
          userId: assigneeId,
          type: 'assigned',
          message: `You were assigned task "${title}" (Priority: ${validatedPriority}) in project ${project.projectNumber}`,
          link: `/projects/${projectId}`,
        },
      });
      emitToUser(assigneeId, 'notification:new', notif);
      emitToUser(assigneeId, 'task:created', { task });
    }

    await db.activityLog.create({
      data: {
        entityType: 'task',
        entityId: task.id,
        action: 'created',
        actorId: session.id,
        meta: JSON.stringify({ taskNumber: task.taskNumber, title: task.title, priority: validatedPriority, version: 1 }),
      },
    });

    // Real-Time Socket Emissions
    emitToProject(projectId, 'task:created', {
      task,
      actor: { id: session.id, name: session.name, role: session.role },
    });
    emitToProject(projectId, 'workload:updated', { projectId });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 });
  }
}
