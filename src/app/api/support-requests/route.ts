import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { canCreateSupportRequest } from '@/lib/permissions';
import { emitToUser, emitToTeam, emitToDepartment, emitToAdmins, emitToProject } from '@/lib/socket-server';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Sent by current user
  const sent = await db.supportRequest.findMany({
    where: { requestedById: session.id },
    include: {
      project: true,
      requestedBy: true,
      targetDepartment: true,
      targetUser: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Awaiting my response (targeted peer)
  const userResponse = await db.supportRequest.findMany({
    where: {
      targetUserId: session.id,
      status: 'FORWARDED_TO_USER',
    },
    include: {
      project: true,
      requestedBy: true,
      targetDepartment: true,
      targetUser: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 3. Awaiting Team Lead review
  let awaitingTeamLeadReview: any[] = [];
  if (session.role === 'TEAM_LEAD' || session.role === 'HOD' || session.role === 'ADMIN') {
    let teamWhere: any = { status: 'PENDING_TEAM_LEAD_REVIEW' };
    if (session.role === 'TEAM_LEAD' && session.teamId) {
      teamWhere.requestedBy = { teamId: session.teamId };
    }
    awaitingTeamLeadReview = await db.supportRequest.findMany({
      where: teamWhere,
      include: {
        project: true,
        requestedBy: true,
        targetDepartment: true,
        targetUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. Awaiting HOD review (targeting HOD's department)
  let awaitingHodReview: any[] = [];
  if (session.role === 'HOD' || session.role === 'ADMIN') {
    let hodDeptWhere: any = { status: 'PENDING_HOD_REVIEW' };
    if (session.role === 'HOD' && session.departmentId) {
      hodDeptWhere.targetDepartmentId = session.departmentId;
    }
    awaitingHodReview = await db.supportRequest.findMany({
      where: hodDeptWhere,
      include: {
        project: true,
        requestedBy: true,
        targetDepartment: true,
        targetUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 5. Escalated to Admin
  let escalatedToAdmin: any[] = [];
  if (session.role === 'ADMIN') {
    escalatedToAdmin = await db.supportRequest.findMany({
      where: { status: 'ESCALATED_TO_ADMIN' },
      include: {
        project: true,
        requestedBy: true,
        targetDepartment: true,
        targetUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return NextResponse.json({
    sent,
    userResponse,
    awaitingTeamLeadReview,
    awaitingHodReview,
    escalatedToAdmin,
  });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!canCreateSupportRequest(session)) {
      return NextResponse.json({ error: 'Forbidden: External accounts cannot submit support requests' }, { status: 403 });
    }

    const {
      projectId,
      kind = 'PEOPLE_HELP',
      targetDepartmentId,
      targetUserId,
      reason,
      urgency = 'NORMAL',
      isDirectToAdmin,
    } = await req.json();

    if (!targetDepartmentId || !reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Target department and reason are required' },
        { status: 400 }
      );
    }

    const targetDept = await db.department.findUnique({ where: { id: targetDepartmentId } });
    if (!targetDept) {
      return NextResponse.json({ error: 'Target department not found' }, { status: 404 });
    }
    if (targetDept.status === 'DECOMMISSIONED') {
      return NextResponse.json({ error: 'Cannot submit support request to a decommissioned department' }, { status: 400 });
    }

    if (targetUserId) {
      const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return NextResponse.json({ error: 'Selected colleague not found' }, { status: 400 });
      }
    }

    // Check if target department has an active HOD
    const targetHods = await db.user.findMany({
      where: { role: 'HOD', departmentId: targetDepartmentId, isActive: true },
    });
    const hasActiveHod = targetHods.length > 0;

    // Determine initial status based on hierarchy and kind:
    // If user has a Team Lead and the request is within their department -> route to Team Lead first.
    // If cross-department PEOPLE_HELP -> routes directly to target department HOD (or escalated to Admin if no HOD).
    let initialStatus = 'PENDING_HOD_REVIEW';

    const isWithinOwnDept = session.departmentId === targetDepartmentId;
    const isEmployeeOrIntern = session.role === 'EMPLOYEE' || session.role === 'INTERN';

    if (isDirectToAdmin || (session.role === 'HOD' && isDirectToAdmin)) {
      initialStatus = 'ESCALATED_TO_ADMIN';
    } else if (isEmployeeOrIntern && session.teamId && isWithinOwnDept) {
      // Check if team has a team lead
      const team = await db.team.findUnique({ where: { id: session.teamId } });
      if (team && team.leadId && team.leadId !== session.id) {
        initialStatus = 'PENDING_TEAM_LEAD_REVIEW';
      }
    }

    // Fallback: If no active HOD exists in target department, escalate straight to Admin
    if (initialStatus === 'PENDING_HOD_REVIEW' && !hasActiveHod) {
      initialStatus = 'ESCALATED_TO_ADMIN';
    }

    const request = await db.supportRequest.create({
      data: {
        projectId: projectId || null,
        kind: kind === 'ISSUE_ESCALATION' ? 'ISSUE_ESCALATION' : 'PEOPLE_HELP',
        requestedById: session.id,
        targetDepartmentId,
        targetTeamId: session.teamId || null,
        targetUserId: targetUserId || null,
        reason: reason.trim(),
        urgency: urgency || 'NORMAL',
        status: initialStatus,
      },
      include: {
        project: true,
        requestedBy: true,
        targetDepartment: true,
        targetUser: true,
      },
    });

    const kindLabel = kind === 'ISSUE_ESCALATION' ? 'Issue Escalation' : 'People Support Request';

    // Dispatch notifications based on initialStatus
    if (initialStatus === 'PENDING_TEAM_LEAD_REVIEW' && session.teamId) {
      const team = await db.team.findUnique({ where: { id: session.teamId } });
      if (team && team.leadId) {
        const notif = await db.notification.create({
          data: {
            userId: team.leadId,
            type: 'support_request_pending',
            message: `New ${kindLabel} from team member ${session.name}: "${reason.trim().slice(0, 80)}"`,
            link: `/support-requests`,
          },
        });
        emitToUser(team.leadId, 'notification:new', notif);
        emitToTeam(session.teamId, 'support_request:created', { request });
      }
    } else if (initialStatus === 'PENDING_HOD_REVIEW') {
      for (const h of targetHods) {
        const notif = await db.notification.create({
          data: {
            userId: h.id,
            type: 'support_request_pending',
            message: `New ${kindLabel} from ${session.name}: "${reason.trim().slice(0, 80)}"`,
            link: `/support-requests`,
          },
        });
        emitToUser(h.id, 'notification:new', notif);
      }
      emitToDepartment(targetDepartmentId, 'support_request:created', { request });
    } else if (initialStatus === 'ESCALATED_TO_ADMIN') {
      const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true } });
      const dept = await db.department.findUnique({ where: { id: targetDepartmentId } });
      const noHodNote = !hasActiveHod ? ` (routed directly to Admin - no active HOD in ${dept?.name || 'department'})` : '';
      for (const admin of admins) {
        const notif = await db.notification.create({
          data: {
            userId: admin.id,
            type: 'support_request_pending',
            message: `New ${kindLabel} from ${session.name}${noHodNote}: "${reason.trim().slice(0, 80)}"`,
            link: `/support-requests`,
          },
        });
        emitToUser(admin.id, 'notification:new', notif);
      }
      emitToAdmins('support_request:created', { request });
    }

    await db.activityLog.create({
      data: {
        entityType: 'support_request',
        entityId: request.id,
        action: `created_${initialStatus.toLowerCase()}`,
        actorId: session.id,
        meta: JSON.stringify({ projectId, kind, targetDepartmentId, urgency }),
      },
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    console.error('Create support request error:', error);
    return NextResponse.json({ error: 'Failed to submit support request' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { requestId, action, note, assignUserId } = body;

    const supportReq = await db.supportRequest.findUnique({
      where: { id: requestId },
      include: { project: true, targetDepartment: true, requestedBy: true },
    });

    if (!supportReq) return NextResponse.json({ error: 'Support request not found' }, { status: 404 });

    const now = new Date();
    const projectTitle = supportReq.project?.projectNumber ? `project ${supportReq.project.projectNumber}` : 'general request';

    // 1. Team Lead Review Actions
    if (action === 'TEAM_LEAD_RESOLVE') {
      if (session.role !== 'TEAM_LEAD' && session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Team Lead role required' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          reviewedByTeamLeadId: session.id,
          teamLeadNote: note || null,
          resolvedAt: now,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `Your issue escalation for ${projectTitle} was resolved by Team Lead ${session.name}: "${note || 'Resolved'}"`,
          link: `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'TEAM_LEAD_FORWARD_HOD') {
      if (session.role !== 'TEAM_LEAD' && session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Team Lead role required' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'PENDING_HOD_REVIEW',
          reviewedByTeamLeadId: session.id,
          teamLeadNote: note || null,
        },
      });

      // Notify HODs
      const hods = await db.user.findMany({ where: { role: 'HOD', departmentId: supportReq.targetDepartmentId } });
      for (const h of hods) {
        const notif = await db.notification.create({
          data: {
            userId: h.id,
            type: 'support_request_pending',
            message: `Team Lead ${session.name} forwarded a support request for ${projectTitle} to HOD review.`,
            link: `/support-requests`,
          },
        });
        emitToUser(h.id, 'notification:new', notif);
      }
      emitToDepartment(supportReq.targetDepartmentId, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'TEAM_LEAD_FORWARD_USER') {
      if (session.role !== 'TEAM_LEAD' && session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Team Lead role required' }, { status: 403 });
      }

      const finalUserId = assignUserId || supportReq.targetUserId;
      if (!finalUserId) {
        return NextResponse.json({ error: 'Please select a team member to assign for support' }, { status: 400 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'FORWARDED_TO_USER',
          targetUserId: finalUserId,
          reviewedByTeamLeadId: session.id,
          teamLeadNote: note || null,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: finalUserId,
          type: 'support_request_pending',
          message: `Team Lead ${session.name} assigned a support request for ${projectTitle} to you.`,
          link: `/support-requests`,
        },
      });
      emitToUser(finalUserId, 'notification:new', notif);
      emitToUser(finalUserId, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    // 2. HOD Review Actions
    if (action === 'HOD_FORWARD') {
      if (session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Only HOD or Admin can forward support requests' }, { status: 403 });
      }

      const finalUserId = assignUserId || supportReq.targetUserId;
      if (!finalUserId) {
        return NextResponse.json({ error: 'Please select a team member to assign for support' }, { status: 400 });
      }

      const assignedUser = await db.user.findUnique({ where: { id: finalUserId } });
      if (!assignedUser) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'FORWARDED_TO_USER',
          targetUserId: finalUserId,
          reviewedByHodId: session.id,
          hodNote: note || null,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: finalUserId,
          type: 'support_request_pending',
          message: `Department HOD forwarded a support request for ${projectTitle} to you.`,
          link: `/support-requests`,
        },
      });
      emitToUser(finalUserId, 'notification:new', notif);
      emitToUser(finalUserId, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'HOD_RESOLVE') {
      if (session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: HOD or Admin required' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          reviewedByHodId: session.id,
          hodNote: note || null,
          resolvedAt: now,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `Your issue escalation for ${projectTitle} was resolved by HOD ${session.name}: "${note || 'Resolved'}"`,
          link: `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'HOD_ESCALATE') {
      if (session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Only HOD or Admin can escalate support requests' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'ESCALATED_TO_ADMIN',
          reviewedByHodId: session.id,
          hodNote: note || null,
        },
      });

      const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
      for (const a of admins) {
        const notif = await db.notification.create({
          data: {
            userId: a.id,
            type: 'support_request_pending',
            message: `Support request for ${projectTitle} was escalated to Admin review.`,
            link: `/support-requests`,
          },
        });
        emitToUser(a.id, 'notification:new', notif);
      }
      emitToAdmins('support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'HOD_REJECT' || action === 'ADMIN_REJECT') {
      if (session.role !== 'HOD' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!note || !note.trim()) {
        return NextResponse.json({ error: 'A rejection note is required' }, { status: 400 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          hodNote: action === 'HOD_REJECT' ? note : supportReq.hodNote,
          adminNote: action === 'ADMIN_REJECT' ? note : supportReq.adminNote,
          resolvedAt: now,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `Your support request for ${projectTitle} was rejected: ${note}`,
          link: supportReq.projectId ? `/projects/${supportReq.projectId}` : `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    // 3. Admin Review Actions
    if (action === 'ADMIN_RESOLVE') {
      if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          escalatedToAdminId: session.id,
          adminNote: note || null,
          resolvedAt: now,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `Your support request for ${projectTitle} was resolved by Admin: "${note || 'Resolved'}"`,
          link: `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'ADMIN_FORWARD') {
      if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const finalUserId = assignUserId || supportReq.targetUserId;
      if (!finalUserId) {
        return NextResponse.json({ error: 'Please select a target user' }, { status: 400 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'FORWARDED_TO_USER',
          targetUserId: finalUserId,
          escalatedToAdminId: session.id,
          adminNote: note || null,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: finalUserId,
          type: 'support_request_pending',
          message: `Admin assigned a support request for ${projectTitle} to you.`,
          link: `/support-requests`,
        },
      });
      emitToUser(finalUserId, 'notification:new', notif);
      emitToUser(finalUserId, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    // 4. Target Peer Actions (ACCEPT / DECLINE)
    if (action === 'USER_ACCEPT') {
      if (supportReq.targetUserId !== session.id && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          resolvedAt: now,
        },
      });

      if (supportReq.projectId) {
        await db.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: supportReq.projectId,
              userId: session.id,
            },
          },
          update: {},
          create: {
            projectId: supportReq.projectId,
            userId: session.id,
            isLead: false,
            addedVia: 'support_request',
          },
        });
        emitToProject(supportReq.projectId, 'project:updated', { projectId: supportReq.projectId });
      }

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `${session.name} accepted your support request for ${projectTitle}!`,
          link: supportReq.projectId ? `/projects/${supportReq.projectId}` : `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'USER_DECLINE') {
      if (supportReq.targetUserId !== session.id && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updated = await db.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'DECLINED',
          resolvedAt: now,
        },
      });

      const notif = await db.notification.create({
        data: {
          userId: supportReq.requestedById,
          type: 'support_request_resolved',
          message: `${session.name} declined the support request for ${projectTitle}.`,
          link: supportReq.projectId ? `/projects/${supportReq.projectId}` : `/support-requests`,
        },
      });
      emitToUser(supportReq.requestedById, 'notification:new', notif);
      emitToUser(supportReq.requestedById, 'support_request:updated', { request: updated });

      return NextResponse.json({ success: true, request: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Update support request error:', error);
    return NextResponse.json({ error: 'Failed to process support request' }, { status: 500 });
  }
}
