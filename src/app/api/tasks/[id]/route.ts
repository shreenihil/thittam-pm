import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import { emitToProject, emitToUser } from '@/lib/socket-server';
import { applyRateLimit } from '@/lib/rateLimit';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: true,
      assignee: true,
      labels: { include: { label: true } },
      subtasks: { orderBy: { order: 'asc' } },
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } },
      blockedBy: { include: { dependsOnTask: true } },
    },
  });

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const access = await checkProjectAccess(session, task.projectId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    task: {
      ...task,
      labels: task.labels.map((l) => l.label),
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 120, windowMs: 60 * 1000, keyPrefix: 'tasks_patch' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden: Viewer accounts cannot edit tasks' }, { status: 403 });
    }

    const { id } = params;
    const task = await db.task.findUnique({
      where: { id },
      include: {
        project: true,
        assignee: true,
        labels: true,
      },
    });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      startDate,
      dueDate,
      estimatedHours,
      labelIds,
      version,
    } = body;

    // Optimistic Concurrency Protection: Reject write if submitted version doesn't match current DB version
    if (version !== undefined && version !== null && version !== task.version) {
      return NextResponse.json(
        {
          error: 'This task was updated by someone else. Please reload to see the latest changes.',
          code: 'CONCURRENCY_CONFLICT',
          currentRecord: {
            title: task.title,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            dueDate: task.dueDate,
            version: task.version,
          },
        },
        { status: 409 }
      );
    }

    // Internal users check project access
    const access = await checkProjectAccess(session, task.projectId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate assignee if provided
    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== task.assigneeId) {
      if (assigneeId === '') {
        // Unassign task
      } else {
        const assigneeUser = await db.user.findUnique({ where: { id: assigneeId } });
        if (!assigneeUser || !assigneeUser.isActive) {
          return NextResponse.json({ error: 'Invalid or inactive assignee user' }, { status: 400 });
        }

        if (session.role === 'TEAM_LEAD' && session.teamId) {
          const isInTeam = assigneeUser.teamId === session.teamId;
          if (!isInTeam && assigneeId !== session.id) {
            return NextResponse.json({ error: 'Team Leads can only assign tasks within their own team' }, { status: 403 });
          }
        }

        // Upsert as project member so assignee has access to project
        await db.projectMember.upsert({
          where: { projectId_userId: { projectId: task.projectId, userId: assigneeId } },
          update: {},
          create: {
            projectId: task.projectId,
            userId: assigneeId,
            isLead: false,
            addedVia: 'task_assignment',
          },
        });

        // Notify new assignee
        if (assigneeId !== session.id) {
          const notif = await db.notification.create({
            data: {
              userId: assigneeId,
              type: 'assigned',
              message: `You were assigned to task "${task.title}" (${task.taskNumber}) by ${session.name}.`,
              link: `/projects/${task.projectId}`,
            },
          });
          emitToUser(assigneeId, 'notification:new', notif);
        }
      }
    }

    // Validate priority
    let validatedPriority: string | undefined = undefined;
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(String(priority).toUpperCase())) {
        return NextResponse.json({ error: 'Invalid task priority level' }, { status: 400 });
      }
      validatedPriority = String(priority).toUpperCase();
    }

    // Update labels if provided
    if (Array.isArray(labelIds)) {
      await db.taskLabel.deleteMany({ where: { taskId: id } });
      for (const lId of labelIds) {
        await db.taskLabel.create({
          data: { taskId: id, labelId: lId },
        });
      }
    }

    const updatedTask = await db.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(validatedPriority !== undefined ? { priority: validatedPriority } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(estimatedHours !== undefined ? { estimatedHours: estimatedHours ? Number(estimatedHours) : null } : {}),
        version: { increment: 1 },
      },
      include: {
        assignee: true,
        project: true,
        labels: { include: { label: true } },
      },
    });

    // Detailed diff in ActivityLog
    await db.activityLog.create({
      data: {
        entityType: 'task',
        entityId: id,
        action: 'updated',
        actorId: session.id,
        meta: JSON.stringify({
          before: {
            title: task.title,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            dueDate: task.dueDate,
            version: task.version,
          },
          after: {
            title: updatedTask.title,
            status: updatedTask.status,
            priority: updatedTask.priority,
            assigneeId: updatedTask.assigneeId,
            dueDate: updatedTask.dueDate,
            version: updatedTask.version,
          },
          changedFields: {
            status: status && status !== task.status ? { from: task.status, to: updatedTask.status } : undefined,
            assigneeId: assigneeId !== undefined && assigneeId !== task.assigneeId ? { from: task.assigneeId, to: updatedTask.assigneeId } : undefined,
            priority: validatedPriority && validatedPriority !== task.priority ? { from: task.priority, to: updatedTask.priority } : undefined,
          },
        }),
      },
    });

    // Real-Time Socket Emissions
    emitToProject(task.projectId, 'task:updated', {
      task: { ...updatedTask, labels: updatedTask.labels.map((l) => l.label) },
      actor: { id: session.id, name: session.name, role: session.role },
    });
    emitToProject(task.projectId, 'workload:updated', { projectId: task.projectId });

    if (updatedTask.assigneeId) {
      emitToUser(updatedTask.assigneeId, 'task:updated', {
        task: { ...updatedTask, labels: updatedTask.labels.map((l) => l.label) },
      });
    }

    return NextResponse.json({
      success: true,
      task: { ...updatedTask, labels: updatedTask.labels.map((l) => l.label) },
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 60, windowMs: 60 * 1000, keyPrefix: 'tasks_delete' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const task = await db.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const access = await checkProjectAccess(session, task.projectId);
    if (!access.hasAccess || session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canDelete =
      session.role === 'ADMIN' ||
      session.role === 'HOD' ||
      access.isLead ||
      task.assigneeId === session.id;

    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden to delete this task' }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await tx.taskDependency.deleteMany({
        where: {
          OR: [{ taskId: id }, { dependsOnTaskId: id }],
        },
      });
      await tx.subtask.deleteMany({ where: { taskId: id } });
      await tx.taskLabel.deleteMany({ where: { taskId: id } });
      await tx.comment.deleteMany({ where: { taskId: id } });
      await tx.attachment.deleteMany({ where: { taskId: id } });
      await tx.timelineEntry.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });

      await tx.activityLog.create({
        data: {
          entityType: 'task',
          entityId: id,
          action: 'deleted',
          actorId: session.id,
          meta: JSON.stringify({ taskNumber: task.taskNumber, title: task.title }),
        },
      });
    });

    emitToProject(task.projectId, 'task:deleted', { taskId: id, taskNumber: task.taskNumber });
    emitToProject(task.projectId, 'workload:updated', { projectId: task.projectId });

    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
