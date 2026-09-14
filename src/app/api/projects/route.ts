import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { applyRateLimit } from '@/lib/rateLimit';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const departmentId = searchParams.get('departmentId');

  let whereClause: any = {};

  if (session.role === 'HOD') {
    whereClause.OR = [
      { departmentId: session.departmentId },
      { members: { some: { userId: session.id } } },
    ];
  } else if (session.role === 'TEAM_LEAD') {
    whereClause.OR = [
      { departmentId: session.departmentId },
      { createdById: session.id },
      { pointOfContactId: session.id },
      { members: { some: { userId: session.id } } },
    ];
  } else if (session.role === 'EMPLOYEE' || session.role === 'INTERN' || session.role === 'HR' || session.role === 'CONTRACTOR' || session.role === 'CLIENT') {
    whereClause.OR = [
      { createdById: session.id },
      { pointOfContactId: session.id },
      { members: { some: { userId: session.id } } },
    ];
  }

  if (status) {
    whereClause.status = status;
  }
  if (priority && VALID_PRIORITIES.includes(priority.toUpperCase())) {
    whereClause.priority = priority.toUpperCase();
  }
  if (departmentId && (session.role === 'ADMIN' || session.role === 'VIEWER')) {
    whereClause.departmentId = departmentId;
  }

  const projects = await db.project.findMany({
    where: whereClause,
    include: {
      department: true,
      team: true,
      createdBy: true,
      pointOfContact: true,
      members: {
        include: {
          user: true,
        },
      },
      tasks: true,
      _count: {
        select: { tasks: true, supportRequests: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  try {
    const rateLimit = applyRateLimit(req, { maxHits: 60, windowMs: 60 * 1000, keyPrefix: 'projects_post' });
    if (!rateLimit.isAllowed) return rateLimit.response!;

    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, description, priority, departmentId, teamId, dueDate, pointOfContactId, leadUserId, memberUserIds } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Project Title is required' }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Project Description is required' }, { status: 400 });
    }

    const validatedPriority = priority && VALID_PRIORITIES.includes(String(priority).toUpperCase())
      ? String(priority).toUpperCase()
      : 'MEDIUM';

    // Determine target department
    let targetDeptId = departmentId || session.departmentId;
    if (!targetDeptId) {
      const firstDept = await db.department.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!firstDept) {
        return NextResponse.json({ error: 'No active department found. Please create or reactivate a department first.' }, { status: 400 });
      }
      targetDeptId = firstDept.id;
    }

    const dept = await db.department.findUnique({ where: { id: targetDeptId } });
    if (!dept) {
      return NextResponse.json({ error: 'Selected department does not exist' }, { status: 400 });
    }
    if (dept.status === 'DECOMMISSIONED') {
      return NextResponse.json({ error: 'Cannot create project in a decommissioned department. Please select an active department.' }, { status: 400 });
    }

    // Check if target department has an active HOD
    const targetDeptHods = await db.user.findMany({
      where: { role: 'HOD', departmentId: targetDeptId, isActive: true },
    });
    const hasActiveHod = targetDeptHods.length > 0;

    // Collision-proof sequential project number generation with retry loop
    const deptCode = dept.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'PRJ';

    const existingProjects = await db.project.findMany({
      where: { departmentId: targetDeptId },
      select: { projectNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let maxSeq = existingProjects.length;
    for (const p of existingProjects) {
      const match = p.projectNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    const isAdminOrHod = session.role === 'ADMIN' || session.role === 'HOD';
    const isDirectAssignment = isAdminOrHod && Boolean(leadUserId);
    const isLive = isAdminOrHod || isDirectAssignment;

    const now = new Date();
    const initialStatus = isLive ? 'IN_PROGRESS' : 'PENDING_APPROVAL';
    const timeOfAllocation = isLive ? now : null;

    // Check if creator has a Team Lead for stage 1 approval
    let approvalStage = 'APPROVED';
    if (!isLive) {
      if (session.teamId && session.role !== 'TEAM_LEAD') {
        const team = await db.team.findUnique({ where: { id: session.teamId } });
        if (team?.leadId && team.leadId !== session.id) {
          approvalStage = 'TEAM_LEAD';
        } else {
          approvalStage = 'HOD';
        }
      } else {
        approvalStage = 'HOD';
      }
    }

    let project: any = null;
    let attempts = 0;
    while (!project && attempts < 5) {
      attempts++;
      const currentSeq = maxSeq + attempts;
      const projectNumber = `${deptCode}-${String(currentSeq).padStart(4, '0')}`;

      try {
        project = await db.project.create({
          data: {
            projectNumber,
            title: title.trim(),
            description: description.trim(),
            priority: validatedPriority,
            departmentId: targetDeptId,
            teamId: teamId || session.teamId || null,
            status: initialStatus,
            approvalStage,
            createdById: session.id,
            pointOfContactId: pointOfContactId || leadUserId || session.id,
            dueDate: dueDate ? new Date(dueDate) : null,
            assignedDate: isLive ? now : null,
            timeOfAllocation: timeOfAllocation,
          },
          include: {
            department: true,
            createdBy: true,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempts < 5) {
          // Unique constraint collision under high concurrency: retry with next sequence number
          continue;
        }
        throw err;
      }
    }

    if (!project) {
      throw new Error('Failed to generate a unique project identifier. Please retry.');
    }

    // If Admin/HOD directly assigned a lead or team members
    if (isAdminOrHod) {
      if (leadUserId) {
        await db.projectMember.create({
          data: {
            projectId: project.id,
            userId: leadUserId,
            isLead: true,
            addedVia: 'assigned',
          },
        });
      }

      if (Array.isArray(memberUserIds)) {
        for (const mId of memberUserIds) {
          if (mId !== leadUserId) {
            await db.projectMember.create({
              data: {
                projectId: project.id,
                userId: mId,
                isLead: false,
                addedVia: 'assigned',
              },
            });
          }
        }
      }
    } else {
      // Notify appropriate approvers
      if (approvalStage === 'TEAM_LEAD' && session.teamId) {
        const team = await db.team.findUnique({ where: { id: session.teamId } });
        if (team?.leadId) {
          await db.notification.create({
            data: {
              userId: team.leadId,
              type: 'ticket_pending',
              message: `New project ticket "${title}" (Priority: ${validatedPriority}) submitted by team member ${session.name} requires your review.`,
              link: `/approval-queue`,
            },
          });
        }
      }

      // Notify HODs and Admins (with fallback description if department has no active HOD)
      const notifyUsers = await db.user.findMany({
        where: {
          OR: [{ role: 'ADMIN' }, ...(hasActiveHod ? [{ role: 'HOD', departmentId: targetDeptId }] : [])],
          isActive: true,
        },
      });

      const fallbackNotice = !hasActiveHod ? ` (routed directly to Admin - no active HOD in ${dept.name})` : '';

      for (const u of notifyUsers) {
        await db.notification.create({
          data: {
            userId: u.id,
            type: 'ticket_pending',
            message: `New project ticket "${title}" (Priority: ${validatedPriority}) submitted by ${session.name}${fallbackNotice} is in approval queue.`,
            link: `/approval-queue`,
          },
        });
      }
    }

    await db.activityLog.create({
      data: {
        entityType: 'project',
        entityId: project.id,
        action: isLive ? 'created_auto_approved' : 'created_ticket',
        actorId: session.id,
        meta: JSON.stringify({ title: project.title, priority: validatedPriority, status: project.status, approvalStage, timeOfAllocation }),
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error('Create project API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
  }
}

