import { NextResponse } from 'next/server';
import { getAuthSession, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageUsers } from '@/lib/permissions';

const VALID_ROLES = ['ADMIN', 'HR', 'HOD', 'TEAM_LEAD', 'EMPLOYEE', 'INTERN', 'CONTRACTOR', 'CLIENT', 'VIEWER'];
const HR_ALLOWED_ROLES = ['EMPLOYEE', 'INTERN', 'CONTRACTOR', 'CLIENT'];

async function getManagementDepartmentId(): Promise<string> {
  let managementDept = await db.department.findUnique({ where: { name: 'Management' } });
  if (!managementDept) {
    managementDept = await db.department.create({
      data: {
        name: 'Management',
        description: 'Executive & Administrative Management Department',
        isSystem: true,
      },
    });
  } else if (!managementDept.isSystem) {
    await db.department.update({
      where: { id: managementDept.id },
      data: { isSystem: true },
    });
  }
  return managementDept.id;
}

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get('role');
  const departmentIdParam = searchParams.get('departmentId');
  const teamIdParam = searchParams.get('teamId');

  let whereClause: any = {};

  if (session.role === 'ADMIN' || session.role === 'HR' || session.role === 'VIEWER') {
    if (roleFilter) {
      whereClause.role = roleFilter;
    }
    if (departmentIdParam) {
      whereClause.departmentId = departmentIdParam;
    }
  } else if (session.role === 'HOD') {
    whereClause.departmentId = session.departmentId;
  } else {
    // TEAM_LEAD, EMPLOYEE, INTERN, CONTRACTOR, CLIENT
    whereClause.departmentId = session.departmentId;
  }

  if (teamIdParam) {
    whereClause.teamId = teamIdParam;
  }

  const users = await db.user.findMany({
    where: whereClause,
    include: {
      department: true,
      team: true,
      departmentRequestsForMe: {
        where: { status: 'PENDING' },
        include: { toDepartment: true, requestedBy: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    users: users.map((u) => {
      const pendingReq = u.departmentRequestsForMe?.[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        designation: u.designation,
        departmentId: u.departmentId,
        departmentName: u.department?.name || null,
        teamId: u.teamId,
        teamName: u.team?.name || null,
        weeklyCapacityHours: u.weeklyCapacityHours,
        isActive: u.isActive,
        mustResetPassword: u.mustResetPassword,
        createdAt: u.createdAt,
        hasPendingTransfer: !!pendingReq,
        pendingTransferInfo: pendingReq
          ? {
              requestType: pendingReq.requestType,
              toDepartmentName: pendingReq.toDepartment.name,
              requestedByName: pendingReq.requestedBy.name,
            }
          : null,
      };
    }),
  });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, email, role, designation, departmentId, teamId, weeklyCapacityHours } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    let targetDeptId: string | null = null;
    let targetTeamId: string | null = null;

    if (session.role === 'ADMIN') {
      if (role === 'HR') {
        targetDeptId = await getManagementDepartmentId();
        targetTeamId = null;
      } else {
        targetDeptId = departmentId || null;
        targetTeamId = teamId || null;
      }
    } else if (session.role === 'HR') {
      // HR Privilege Escalation Check: HR can ONLY create EMPLOYEE, INTERN, CONTRACTOR, CLIENT
      if (!HR_ALLOWED_ROLES.includes(role)) {
        return NextResponse.json(
          { error: 'Forbidden: HR can only create accounts with role EMPLOYEE, INTERN, CONTRACTOR, or CLIENT' },
          { status: 403 }
        );
      }
      // HR Department Placement Check: HR cannot direct-assign department; accounts feed into Unassigned pool
      targetDeptId = null;
      targetTeamId = null;
    } else if (session.role === 'HOD') {
      if (['ADMIN', 'HR', 'HOD'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden: HOD cannot create Admin, HR, or other HOD accounts' }, { status: 403 });
      }
      targetDeptId = session.departmentId || null;
      targetTeamId = teamId || null;
    } else {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to create user accounts' }, { status: 403 });
    }

    if (targetDeptId) {
      const targetDept = await db.department.findUnique({ where: { id: targetDeptId } });
      if (!targetDept) {
        return NextResponse.json({ error: 'Selected department does not exist' }, { status: 400 });
      }
      if (targetDept.status === 'DECOMMISSIONED') {
        return NextResponse.json({ error: 'Cannot assign user to a decommissioned department' }, { status: 400 });
      }
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const defaultPasswordHash = await hashPassword('thittam123');

    const newUser = await db.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: defaultPasswordHash,
        mustResetPassword: true,
        role,
        designation: designation ? designation.trim() : null,
        departmentId: targetDeptId,
        teamId: targetTeamId,
        weeklyCapacityHours: Number(weeklyCapacityHours) || (role === 'VIEWER' || role === 'CLIENT' ? 0 : 40),
      },
    });

    await db.activityLog.create({
      data: {
        entityType: 'user',
        entityId: newUser.id,
        action: 'created',
        actorId: session.id,
        meta: JSON.stringify({ name: newUser.name, email: newUser.email, role: newUser.role, departmentId: targetDeptId }),
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId, name, designation, weeklyCapacityHours, isActive, role, departmentId, teamId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!canManageUsers(session, targetUser.departmentId)) {
      return NextResponse.json({ error: 'Forbidden: Cannot manage this user' }, { status: 403 });
    }

    let updateData: any = {};

    if (session.role === 'HR') {
      // 1. HR cannot modify ADMIN, HR, TEAM_LEAD, or HOD accounts
      if (!HR_ALLOWED_ROLES.includes(targetUser.role)) {
        return NextResponse.json(
          { error: 'Forbidden: HR cannot edit, deactivate, or modify Admin, HR, Team Lead, or HOD accounts' },
          { status: 403 }
        );
      }

      // 2. HR cannot promote any account to ADMIN, HR, TEAM_LEAD, or HOD
      if (role !== undefined) {
        if (!HR_ALLOWED_ROLES.includes(role)) {
          return NextResponse.json(
            { error: 'Forbidden: HR can only assign EMPLOYEE, INTERN, CONTRACTOR, or CLIENT roles' },
            { status: 403 }
          );
        }
        updateData.role = role;
      }

      // 3. HR can update name, designation, weeklyCapacityHours, isActive
      if (name !== undefined) updateData.name = String(name).trim();
      if (designation !== undefined) updateData.designation = String(designation).trim();
      if (weeklyCapacityHours !== undefined) updateData.weeklyCapacityHours = Number(weeklyCapacityHours);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      // HR CANNOT update departmentId or teamId (those bypass department claim/transfer system)
    } else if (session.role === 'ADMIN') {
      if (name !== undefined) updateData.name = String(name).trim();
      if (designation !== undefined) updateData.designation = String(designation).trim();
      if (weeklyCapacityHours !== undefined) updateData.weeklyCapacityHours = Number(weeklyCapacityHours);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (role !== undefined) {
        if (!VALID_ROLES.includes(role)) {
          return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
        }
        updateData.role = role;
        if (role === 'HR') {
          updateData.departmentId = await getManagementDepartmentId();
          updateData.teamId = null;
        }
      }
      if (departmentId !== undefined && (!role || role !== 'HR')) {
        if (departmentId) {
          const targetDept = await db.department.findUnique({ where: { id: departmentId } });
          if (!targetDept) return NextResponse.json({ error: 'Selected department does not exist' }, { status: 400 });
          if (targetDept.status === 'DECOMMISSIONED') {
            return NextResponse.json({ error: 'Cannot assign user to a decommissioned department' }, { status: 400 });
          }
        }
        updateData.departmentId = departmentId || null;
      }
      if (teamId !== undefined && (!role || role !== 'HR')) {
        updateData.teamId = teamId || null;
      }
    } else if (session.role === 'HOD') {
      if (role && ['ADMIN', 'HR', 'HOD'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden: HOD cannot assign Admin, HR, or HOD roles' }, { status: 403 });
      }
      if (name !== undefined) updateData.name = String(name).trim();
      if (designation !== undefined) updateData.designation = String(designation).trim();
      if (weeklyCapacityHours !== undefined) updateData.weeklyCapacityHours = Number(weeklyCapacityHours);
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (role !== undefined && ['EMPLOYEE', 'INTERN', 'TEAM_LEAD'].includes(role)) {
        updateData.role = role;
      }
      if (teamId !== undefined) updateData.teamId = teamId || null;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    await db.activityLog.create({
      data: {
        entityType: 'user',
        entityId: updatedUser.id,
        action: 'updated',
        actorId: session.id,
        meta: JSON.stringify({ changedFields: Object.keys(updateData) }),
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}
