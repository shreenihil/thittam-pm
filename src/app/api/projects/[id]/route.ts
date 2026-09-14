import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess, canDeleteProject } from '@/lib/permissions';
import { emitToProject, emitToDepartment, emitToAdmins, emitToUser } from '@/lib/socket-server';
import { applyRateLimit } from '@/lib/rateLimit';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const access = await checkProjectAccess(session, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Internal users get full project details
  const project = await db.project.findUnique({
    where: { id },
    include: {
      department: true,
      team: true,
      createdBy: true,
      pointOfContact: true,
      milestones: {
        orderBy: { dueDate: 'asc' },
      },
      labels: {
        include: { label: true },
      },
      members: {
        include: {
          user: true,
        },
      },
      tasks: {
        include: {
          assignee: true,
          labels: { include: { label: true } },
          subtasks: { orderBy: { order: 'asc' } },
          blockedBy: {
            include: {
              dependsOnTask: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      timelineEntries: {
        include: {
          user: true,
          task: true,
        },
        orderBy: { entryDate: 'desc' },
      },
      supportRequests: {
        include: {
          requestedBy: true,
          targetUser: true,
          targetDepartment: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      comments: {
        include: {
          author: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        include: {
          uploadedBy: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json({
    project: {
      ...project,
      labels: project.labels.map((l) => l.label),
    },
    isLead: access.isLead,
    isClient: false,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 120, windowMs: 60 * 1000, keyPrefix: 'projects_patch' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const access = await checkProjectAccess(session, id);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      version,
      supportRequiredNote,
      rejectionReason,
      leadUserId,
      memberUserIds,
      labelIds,
    } = body;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        members: true,
        labels: true,
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Optimistic Concurrency Protection: Reject write if submitted version doesn't match current DB version
    if (version !== undefined && version !== null && version !== project.version) {
      return NextResponse.json(
        {
          error: 'This project was updated by someone else. Please reload to see the latest changes.',
          code: 'CONCURRENCY_CONFLICT',
          currentRecord: {
            title: project.title,
            status: project.status,
            priority: project.priority,
            dueDate: project.dueDate,
            version: project.version,
          },
        },
        { status: 409 }
      );
    }

    // Validate status change permissions
    if (status && status !== project.status) {
      if (status === 'CANCELLED') {
        const canDecomm =
          session.role === 'ADMIN' ||
          (session.role === 'HOD' && session.departmentId === project.departmentId) ||
          access.isLead;
        if (!canDecomm) {
          return NextResponse.json(
            { error: 'Only Department HOD or Admin can decommission/cancel this project' },
            { status: 403 }
          );
        }
      } else if (status === 'COMPLETED') {
        const canComplete =
          session.role === 'ADMIN' ||
          (session.role === 'HOD' && session.departmentId === project.departmentId) ||
          access.isLead;
        if (!canComplete) {
          return NextResponse.json(
            { error: 'Only Admin or Department HOD can mark this project as over/completed' },
            { status: 403 }
          );
        }
      } else if (session.role === 'EMPLOYEE' && !access.isLead && status !== 'SUPPORT_REQUIRED') {
        return NextResponse.json(
          { error: 'Employees can only set status to Support Required' },
          { status: 403 }
        );
      }

      if (['ON_HOLD', 'CANCELLED', 'SUPPORT_REQUIRED'].includes(status) && !supportRequiredNote && !rejectionReason) {
        return NextResponse.json(
          { error: `A reason note is required when changing status to ${status}` },
          { status: 400 }
        );
      }
    }

    // Validate priority
    let validatedPriority: string | undefined = undefined;
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(String(priority).toUpperCase())) {
        return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 });
      }
      validatedPriority = String(priority).toUpperCase();
    }

    // Update labels if provided
    if (Array.isArray(labelIds)) {
      await db.projectLabel.deleteMany({ where: { projectId: id } });
      for (const lId of labelIds) {
        await db.projectLabel.create({
          data: { projectId: id, labelId: lId },
        });
      }
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(validatedPriority !== undefined ? { priority: validatedPriority } : {}),
        ...(supportRequiredNote !== undefined ? { supportRequiredNote } : {}),
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
        version: { increment: 1 },
      },
    });

    // If marked as COMPLETED / OVER, log timeline entry & notify members
    if (status === 'COMPLETED' && project.status !== 'COMPLETED') {
      await db.timelineEntry.create({
        data: {
          projectId: id,
          userId: session.id,
          note: `Project marked as Over / Completed by ${session.name} (${session.role}).`,
        },
      });

      const members = await db.projectMember.findMany({ where: { projectId: id } });
      for (const m of members) {
        if (m.userId !== session.id) {
          const notif = await db.notification.create({
            data: {
              userId: m.userId,
              type: 'status_changed',
              message: `Project ${project.projectNumber} ("${project.title}") has been marked as Completed / Over by ${session.name}.`,
              link: `/projects/${id}`,
            },
          });
          emitToUser(m.userId, 'notification:new', notif);
        }
      }
    }

    // If cancelled / decommissioned, add timeline entry & notify members
    if (status === 'CANCELLED' && project.status !== 'CANCELLED') {
      const reasonText = supportRequiredNote || rejectionReason || 'No reason provided';
      await db.timelineEntry.create({
        data: {
          projectId: id,
          userId: session.id,
          note: `Project Decommissioned / Cancelled by ${session.name} (${session.role}). Reason: ${reasonText}`,
        },
      });

      const members = await db.projectMember.findMany({ where: { projectId: id } });
      for (const m of members) {
        if (m.userId !== session.id) {
          const notif = await db.notification.create({
            data: {
              userId: m.userId,
              type: 'status_changed',
              message: `Project ${project.projectNumber} ("${project.title}") has been decommissioned by ${session.name}.`,
              link: `/projects/${id}`,
            },
          });
          emitToUser(m.userId, 'notification:new', notif);
        }
      }
    }

    // Update members if leadUserId or memberUserIds provided (Admin or HOD)
    if ((session.role === 'ADMIN' || session.role === 'HOD') && (leadUserId !== undefined || memberUserIds !== undefined)) {
      if (leadUserId) {
        const leadUser = await db.user.findUnique({ where: { id: leadUserId } });
        if (!leadUser || leadUser.role === 'VIEWER') {
          return NextResponse.json({ error: 'Read-only viewers cannot be assigned as Project Lead' }, { status: 400 });
        }

        await db.projectMember.updateMany({
          where: { projectId: id },
          data: { isLead: false },
        });

        await db.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId: leadUserId } },
          update: { isLead: true },
          create: {
            projectId: id,
            userId: leadUserId,
            isLead: true,
            addedVia: 'assigned',
          },
        });
      }

      if (Array.isArray(memberUserIds)) {
        // Find existing members
        const existingMembers = await db.projectMember.findMany({ where: { projectId: id } });
        const existingIds = existingMembers.map((m) => m.userId);

        // Add newly selected members
        for (const mId of memberUserIds) {
          const mUser = await db.user.findUnique({ where: { id: mId } });
          if (mUser && mUser.role !== 'VIEWER') {
            await db.projectMember.upsert({
              where: { projectId_userId: { projectId: id, userId: mId } },
              update: {},
              create: {
                projectId: id,
                userId: mId,
                isLead: mId === leadUserId,
                addedVia: 'assigned',
              },
            });

            // Notify newly added member
            if (!existingIds.includes(mId) && mId !== session.id) {
              const notif = await db.notification.create({
                data: {
                  userId: mId,
                  type: 'assigned',
                  message: `You were added as a team member to project ${project.projectNumber} ("${project.title}") by ${session.name}.`,
                  link: `/projects/${id}`,
                },
              });
              emitToUser(mId, 'notification:new', notif);
            }
          }
        }
      }
    }

    // Entity Change History diff log in ActivityLog
    await db.activityLog.create({
      data: {
        entityType: 'project',
        entityId: id,
        action: 'updated',
        actorId: session.id,
        meta: JSON.stringify({
          before: {
            title: project.title,
            status: project.status,
            priority: project.priority,
            dueDate: project.dueDate,
            version: project.version,
          },
          after: {
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
            dueDate: updated.dueDate,
            version: updated.version,
          },
          changedFields: {
            status: status && status !== project.status ? { from: project.status, to: updated.status } : undefined,
            priority: validatedPriority && validatedPriority !== project.priority ? { from: project.priority, to: updated.priority } : undefined,
            title: title && title !== project.title ? { from: project.title, to: updated.title } : undefined,
            dueDate: dueDate !== undefined ? { from: project.dueDate, to: updated.dueDate } : undefined,
          },
        }),
      },
    });

    // Real-Time Socket Emission
    emitToProject(id, 'project:updated', {
      project: updated,
      actor: { id: session.id, name: session.name, role: session.role },
    });
    emitToDepartment(project.departmentId, 'project:updated', { project: updated });
    emitToAdmins('project:updated', { project: updated });

    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 30, windowMs: 60 * 1000, keyPrefix: 'projects_delete' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const project = await db.project.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check delete permission: Admin or HOD of the project's department
    if (!canDeleteProject(session, project.departmentId)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin and Department HOD can delete projects' },
        { status: 403 }
      );
    }

    const taskIds = project.tasks.map((t) => t.id);

    // Run clean cascade deletion within transaction
    await db.$transaction(async (tx) => {
      // 1. Delete task dependencies and sub-items
      if (taskIds.length > 0) {
        await tx.taskDependency.deleteMany({
          where: {
            OR: [
              { taskId: { in: taskIds } },
              { dependsOnTaskId: { in: taskIds } },
            ],
          },
        });
        await tx.subtask.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskLabel.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.attachment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.timelineEntry.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { projectId: id } });
      }

      // 2. Delete project level attachments, comments, timeline, milestones, labels, support requests, members
      await tx.attachment.deleteMany({ where: { projectId: id } });
      await tx.comment.deleteMany({ where: { projectId: id } });
      await tx.timelineEntry.deleteMany({ where: { projectId: id } });
      await tx.milestone.deleteMany({ where: { projectId: id } });
      await tx.projectLabel.deleteMany({ where: { projectId: id } });
      await tx.supportRequest.deleteMany({ where: { projectId: id } });
      await tx.projectMember.deleteMany({ where: { projectId: id } });

      // 3. Delete the project itself
      await tx.project.delete({ where: { id } });

      // 4. Log deletion in activity log
      await tx.activityLog.create({
        data: {
          entityType: 'project',
          entityId: id,
          action: 'deleted',
          actorId: session.id,
          meta: JSON.stringify({
            projectNumber: project.projectNumber,
            title: project.title,
            deletedBy: session.name,
            deletedByRole: session.role,
          }),
        },
      });
    });

    // Real-Time Socket Emission
    emitToProject(id, 'project:deleted', { projectId: id, projectNumber: project.projectNumber });
    emitToDepartment(project.departmentId, 'project:deleted', { projectId: id, projectNumber: project.projectNumber });
    emitToAdmins('project:deleted', { projectId: id, projectNumber: project.projectNumber });

    return NextResponse.json({
      success: true,
      message: `Project ${project.projectNumber} ("${project.title}") deleted successfully`,
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
  }
}
