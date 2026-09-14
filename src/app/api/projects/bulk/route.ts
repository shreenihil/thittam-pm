import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitToProject, emitToDepartment, emitToAdmins } from '@/lib/socket-server';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role !== 'ADMIN' && session.role !== 'HOD') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges for bulk operations' }, { status: 403 });
    }

    const { projectIds, action, value, reason } = await req.json();

    if (!Array.isArray(projectIds) || projectIds.length === 0 || !action || !value) {
      return NextResponse.json({ error: 'projectIds, action, and value are required' }, { status: 400 });
    }

    const updatedProjects: any[] = [];

    for (const id of projectIds) {
      const project = await db.project.findUnique({ where: { id } });
      if (!project) continue;

      // Check permission per project
      const isAdmin = session.role === 'ADMIN';
      const isHodOfDept = session.role === 'HOD' && session.departmentId === project.departmentId;

      if (!isAdmin && !isHodOfDept) continue;

      if (action === 'STATUS_CHANGE') {
        const updated = await db.project.update({
          where: { id },
          data: {
            status: value,
            version: { increment: 1 },
            ...(reason ? { supportRequiredNote: reason } : {}),
          },
        });

        await db.activityLog.create({
          data: {
            entityType: 'project',
            entityId: id,
            action: 'bulk_status_changed',
            actorId: session.id,
            meta: JSON.stringify({ from: project.status, to: value, reason }),
          },
        });

        emitToProject(id, 'project:updated', { project: updated });
        emitToDepartment(project.departmentId, 'project:updated', { project: updated });
        updatedProjects.push(updated);
      } else if (action === 'ASSIGN_DEPT' && isAdmin) {
        const updated = await db.project.update({
          where: { id },
          data: {
            departmentId: value,
            version: { increment: 1 },
          },
        });

        await db.activityLog.create({
          data: {
            entityType: 'project',
            entityId: id,
            action: 'bulk_dept_assigned',
            actorId: session.id,
            meta: JSON.stringify({ from: project.departmentId, to: value }),
          },
        });

        emitToProject(id, 'project:updated', { project: updated });
        updatedProjects.push(updated);
      } else if (action === 'ASSIGN_LEAD') {
        const leadUser = await db.user.findUnique({ where: { id: value } });
        if (leadUser) {
          await db.projectMember.updateMany({
            where: { projectId: id },
            data: { isLead: false },
          });

          await db.projectMember.upsert({
            where: { projectId_userId: { projectId: id, userId: value } },
            update: { isLead: true },
            create: {
              projectId: id,
              userId: value,
              isLead: true,
              addedVia: 'assigned',
            },
          });

          const updated = await db.project.update({
            where: { id },
            data: {
              pointOfContactId: value,
              version: { increment: 1 },
            },
          });

          emitToProject(id, 'project:updated', { project: updated });
          updatedProjects.push(updated);
        }
      }
    }

    emitToAdmins('project:bulk_updated', { count: updatedProjects.length });

    return NextResponse.json({
      success: true,
      updatedCount: updatedProjects.length,
      projects: updatedProjects,
    });
  } catch (err: any) {
    console.error('Bulk project update error:', err);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}
