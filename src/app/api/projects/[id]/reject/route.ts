import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { canApproveProject, canApproveProjectFirstStage } from '@/lib/permissions';
import { emitToDepartment, emitToAdmins, emitToProject, emitToUser } from '@/lib/socket-server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const { rejectionReason } = await req.json();

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isHodOrAdmin = canApproveProject(session, project.departmentId);
    let isTeamLeadAllowed = false;
    if (session.role === 'TEAM_LEAD') {
      isTeamLeadAllowed = await canApproveProjectFirstStage(session, project.createdById);
    }

    if (!isHodOrAdmin && !isTeamLeadAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      },
    });

    const notif = await db.notification.create({
      data: {
        userId: project.createdById,
        type: 'ticket_rejected',
        message: `Your project ticket "${project.title}" was rejected by ${session.name} (${session.role}): ${rejectionReason}`,
        link: `/projects/${id}`,
      },
    });
    emitToUser(project.createdById, 'notification:new', notif);

    await db.activityLog.create({
      data: {
        entityType: 'project',
        entityId: id,
        action: 'rejected',
        actorId: session.id,
        meta: JSON.stringify({ reason: rejectionReason }),
      },
    });

    emitToDepartment(project.departmentId, 'approval_queue:updated', { projectId: id, status: 'REJECTED' });
    emitToAdmins('approval_queue:updated', { projectId: id, status: 'REJECTED' });
    emitToProject(id, 'project:updated', { project: updated });

    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('Reject ticket error:', error);
    return NextResponse.json({ error: 'Failed to reject project ticket' }, { status: 500 });
  }
}
