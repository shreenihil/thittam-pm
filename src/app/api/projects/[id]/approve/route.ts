import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { canApproveProject, canApproveProjectFirstStage } from '@/lib/permissions';
import { emitToDepartment, emitToAdmins, emitToProject, emitToUser } from '@/lib/socket-server';

import { applyRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 30, windowMs: 60 * 1000, keyPrefix: 'projects_approve' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { leadUserId, memberUserIds, approvalNote, priority } = body;

    const project = await db.project.findUnique({
      where: { id },
      include: { department: true, team: true },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const now = new Date();

    // Stage 1: TEAM_LEAD endorsement
    if (session.role === 'TEAM_LEAD') {
      const canStage1 = await canApproveProjectFirstStage(session, project.createdById);
      if (!canStage1) {
        return NextResponse.json({ error: 'Forbidden: You can only review tickets from your own team' }, { status: 403 });
      }

      const updatedProject = await db.project.update({
        where: { id },
        data: {
          approvalStage: 'HOD',
          teamLeadApprovedById: session.id,
          teamLeadApprovedAt: now,
          teamLeadApprovalNote: approvalNote || null,
        },
      });

      // Notify HODs
      const hods = await db.user.findMany({
        where: { role: 'HOD', departmentId: project.departmentId },
      });
      for (const hod of hods) {
        const notif = await db.notification.create({
          data: {
            userId: hod.id,
            type: 'ticket_pending',
            message: `Project ticket "${project.title}" was endorsed by Team Lead ${session.name} and is ready for final approval.`,
            link: `/approval-queue`,
          },
        });
        emitToUser(hod.id, 'notification:new', notif);
      }

      await db.activityLog.create({
        data: {
          entityType: 'project',
          entityId: id,
          action: 'team_lead_endorsed',
          actorId: session.id,
          meta: JSON.stringify({ note: approvalNote }),
        },
      });

      emitToDepartment(project.departmentId, 'approval_queue:updated', { projectId: id, stage: 'HOD' });
      emitToAdmins('approval_queue:updated', { projectId: id, stage: 'HOD' });
      emitToProject(id, 'project:updated', { project: updatedProject });

      return NextResponse.json({ success: true, project: updatedProject, stage: 'HOD' });
    }

    // Final Approval: HOD or ADMIN
    if (!canApproveProject(session, project.departmentId)) {
      return NextResponse.json({ error: 'Forbidden: Cannot approve tickets in this department' }, { status: 403 });
    }

    if (!leadUserId) {
      return NextResponse.json({ error: 'Assigning a Project Lead is required upon approval' }, { status: 400 });
    }

    const leadUser = await db.user.findUnique({ where: { id: leadUserId } });
    if (!leadUser || leadUser.role === 'VIEWER') {
      return NextResponse.json({ error: 'Read-only viewers cannot be assigned as Project Lead' }, { status: 400 });
    }

    // Server-stamped timeOfAllocation - NEVER settable via user input
    const updatedProject = await db.project.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        approvalStage: 'APPROVED',
        approvedById: session.id,
        approvalNote: approvalNote || null,
        ...(priority ? { priority: String(priority).toUpperCase() } : {}),
        assignedDate: now,
        timeOfAllocation: now,
      },
    });

    // Assign Project Lead
    await db.projectMember.create({
      data: {
        projectId: id,
        userId: leadUserId,
        isLead: true,
        addedVia: 'assigned',
      },
    });

    // Assign Initial Team Members (exclude read-only viewers)
    if (Array.isArray(memberUserIds)) {
      for (const mId of memberUserIds) {
        if (mId !== leadUserId) {
          const mUser = await db.user.findUnique({ where: { id: mId } });
          if (mUser && mUser.role !== 'VIEWER') {
            await db.projectMember.create({
              data: {
                projectId: id,
                userId: mId,
                isLead: false,
                addedVia: 'assigned',
              },
            });
          }
        }
      }
    }

    // Notify Project Creator
    const notif = await db.notification.create({
      data: {
        userId: project.createdById,
        type: 'ticket_approved',
        message: `Your project ticket "${project.title}" has been approved!`,
        link: `/projects/${id}`,
      },
    });
    emitToUser(project.createdById, 'notification:new', notif);

    await db.activityLog.create({
      data: {
        entityType: 'project',
        entityId: id,
        action: 'approved',
        actorId: session.id,
        meta: JSON.stringify({ timeOfAllocation: now }),
      },
    });

    emitToDepartment(project.departmentId, 'approval_queue:updated', { projectId: id, stage: 'APPROVED' });
    emitToAdmins('approval_queue:updated', { projectId: id, stage: 'APPROVED' });
    emitToProject(id, 'project:updated', { project: updatedProject });

    return NextResponse.json({ success: true, project: updatedProject, stage: 'APPROVED' });
  } catch (error: any) {
    console.error('Approve ticket error:', error);
    return NextResponse.json({ error: 'Failed to approve project ticket' }, { status: 500 });
  }
}
