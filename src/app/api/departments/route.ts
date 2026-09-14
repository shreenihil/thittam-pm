import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');
  const activeOnly = searchParams.get('activeOnly') === 'true';

  let whereClause: any = {};
  if (statusParam) {
    whereClause.status = statusParam;
  } else if (activeOnly) {
    whereClause.status = 'ACTIVE';
  }

  const departments = await db.department.findMany({
    where: whereClause,
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          designation: true,
          teamId: true,
          isActive: true,
        },
      },
      teams: {
        include: {
          lead: {
            select: { id: true, name: true, email: true, designation: true },
          },
          members: {
            select: { id: true, name: true, email: true, designation: true, role: true },
          },
        },
      },
      _count: {
        select: { projects: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formattedDepts = departments.map((d) => {
    const activeUsers = d.users.filter((u) => u.isActive);
    const hods = activeUsers.filter((u) => u.role === 'HOD');
    const staff = activeUsers.filter((u) => u.role !== 'HOD');
    return {
      id: d.id,
      name: d.name,
      description: d.description || null,
      isSystem: Boolean(d.isSystem),
      isBuiltIn: Boolean(d.isBuiltIn),
      status: d.status || 'ACTIVE',
      hods,
      teams: d.teams,
      employeeCount: staff.length,
      totalUsersCount: activeUsers.length,
      projectsCount: d._count.projects,
      createdAt: d.createdAt,
    };
  });

  return NextResponse.json({ departments: formattedDepts });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, createTeamName, departmentId, teamLeadUserId } = body;

    // Handle creating a team within a department
    if (createTeamName && departmentId) {
      const targetDept = await db.department.findUnique({ where: { id: departmentId } });
      if (!targetDept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      if (targetDept.status === 'DECOMMISSIONED') {
        return NextResponse.json({ error: 'Cannot create teams in a decommissioned department' }, { status: 400 });
      }

      const team = await db.team.create({
        data: {
          name: createTeamName.trim(),
          departmentId,
          leadId: teamLeadUserId || null,
        },
      });

      if (teamLeadUserId) {
        await db.user.update({
          where: { id: teamLeadUserId },
          data: { teamId: team.id, role: 'TEAM_LEAD' },
        });
      }

      return NextResponse.json({ success: true, team });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const existing = await db.department.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Department with this name already exists' }, { status: 400 });
    }

    const department = await db.department.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        isBuiltIn: false,
        isSystem: false,
        status: 'ACTIVE',
      },
    });

    await db.activityLog.create({
      data: {
        entityType: 'department',
        entityId: department.id,
        action: 'created',
        actorId: session.id,
        meta: JSON.stringify({ name: department.name }),
      },
    });

    return NextResponse.json({ success: true, department });
  } catch (error: any) {
    console.error('Create department error:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'HOD')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      departmentId,
      action,
      assignHodUserId,
      addEmployeeUserId,
      createTeamName,
      teamLeadUserId,
      assignUserToTeamId,
      targetUserId,
    } = body;

    // 1. Create a Team (Admin or Department HOD)
    if (createTeamName && departmentId) {
      if (session.role === 'HOD' && session.departmentId !== departmentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const targetDept = await db.department.findUnique({ where: { id: departmentId } });
      if (!targetDept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      if (targetDept.status === 'DECOMMISSIONED') {
        return NextResponse.json({ error: 'Cannot create teams in a decommissioned department' }, { status: 400 });
      }

      const newTeam = await db.team.create({
        data: {
          name: createTeamName.trim(),
          departmentId,
          leadId: teamLeadUserId || null,
        },
      });

      if (teamLeadUserId) {
        await db.user.update({
          where: { id: teamLeadUserId },
          data: { teamId: newTeam.id, role: 'TEAM_LEAD' },
        });
      }

      return NextResponse.json({ success: true, team: newTeam });
    }

    // 2. Assign user to a Team
    if (assignUserToTeamId && targetUserId) {
      const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      if (session.role === 'HOD' && targetUser.departmentId !== session.departmentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await db.user.update({
        where: { id: targetUserId },
        data: { teamId: assignUserToTeamId },
      });

      return NextResponse.json({ success: true });
    }

    // Admin-only department level operations
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!departmentId) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    const department = await db.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // 3. Decommission Department (Admin Only)
    if (action === 'DECOMMISSION') {
      if (department.isSystem) {
        return NextResponse.json(
          { error: 'Forbidden: System departments (Management) are protected and cannot be decommissioned' },
          { status: 403 }
        );
      }

      // Check for active users assigned to this department
      const activeUsersCount = await db.user.count({
        where: {
          departmentId: department.id,
          isActive: true,
        },
      });

      if (activeUsersCount > 0) {
        return NextResponse.json(
          { error: `Reassign or transfer ${activeUsersCount} user(s) out of this department before decommissioning` },
          { status: 400 }
        );
      }

      const updated = await db.department.update({
        where: { id: department.id },
        data: { status: 'DECOMMISSIONED' },
      });

      await db.activityLog.create({
        data: {
          entityType: 'department',
          entityId: department.id,
          action: 'decommissioned',
          actorId: session.id,
          meta: JSON.stringify({ name: department.name }),
        },
      });

      return NextResponse.json({
        success: true,
        department: updated,
        message: `Department ${department.name} decommissioned successfully`,
      });
    }

    // 4. Reactivate Department (Admin Only)
    if (action === 'REACTIVATE') {
      const updated = await db.department.update({
        where: { id: department.id },
        data: { status: 'ACTIVE' },
      });

      await db.activityLog.create({
        data: {
          entityType: 'department',
          entityId: department.id,
          action: 'reactivated',
          actorId: session.id,
          meta: JSON.stringify({ name: department.name }),
        },
      });

      return NextResponse.json({
        success: true,
        department: updated,
        message: `Department ${department.name} reactivated successfully`,
      });
    }

    // Check if department is decommissioned for assignments
    if (department.status === 'DECOMMISSIONED') {
      return NextResponse.json(
        { error: 'Cannot assign users or HODs to a decommissioned department. Please reactivate it first.' },
        { status: 400 }
      );
    }

    // 5. Assign HOD
    if (assignHodUserId) {
      const hodUser = await db.user.findUnique({ where: { id: assignHodUserId } });
      if (!hodUser) return NextResponse.json({ error: 'HOD user not found' }, { status: 404 });

      await db.user.update({
        where: { id: assignHodUserId },
        data: {
          departmentId: departmentId,
          role: 'HOD',
        },
      });

      await db.activityLog.create({
        data: {
          entityType: 'department',
          entityId: departmentId,
          action: 'assigned_hod',
          actorId: session.id,
          meta: JSON.stringify({ hodName: hodUser.name, deptName: department.name }),
        },
      });
    }

    // 6. Directly Add Employee (Wrapped in atomic transaction)
    if (addEmployeeUserId) {
      await db.$transaction(async (tx) => {
        const empUser = await tx.user.findUnique({
          where: { id: addEmployeeUserId },
          include: { department: true },
        });

        if (!empUser) throw new Error('Employee user not found');

        const fromDeptName = empUser.department?.name || 'Unassigned';

        await tx.user.update({
          where: { id: addEmployeeUserId },
          data: { departmentId: departmentId, teamId: null },
        });

        await tx.departmentHistory.create({
          data: {
            employeeId: addEmployeeUserId,
            fromDepartmentName: fromDeptName,
            toDepartmentName: department.name,
            changedById: session.id,
            reason: 'Direct Admin Assignment',
          },
        });

        // Cancel any pending department requests for this employee
        await tx.departmentRequest.updateMany({
          where: {
            employeeId: addEmployeeUserId,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            adminNote: `Automatically resolved: Direct assignment by Admin to ${department.name}`,
            resolvedAt: new Date(),
          },
        });

        const hods = await tx.user.findMany({
          where: { role: 'HOD', departmentId: departmentId },
        });

        for (const hod of hods) {
          await tx.notification.create({
            data: {
              userId: hod.id,
              type: 'department_assigned',
              message: `Admin assigned a new employee (${empUser.name} — ${empUser.designation || 'Team Member'}) directly to your department (${department.name}).`,
              link: `/users`,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            entityType: 'department',
            entityId: departmentId,
            action: 'assigned_employee_directly',
            actorId: session.id,
            meta: JSON.stringify({ empName: empUser.name, deptName: department.name }),
          },
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update department assignments error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update department assignments' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('id');

    if (!departmentId) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    const department = await db.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (department.isSystem) {
      return NextResponse.json(
        { error: 'Forbidden: System departments (Management) are protected and cannot be decommissioned' },
        { status: 403 }
      );
    }

    // Check for active users assigned to this department
    const activeUsersCount = await db.user.count({
      where: {
        departmentId: department.id,
        isActive: true,
      },
    });

    if (activeUsersCount > 0) {
      return NextResponse.json(
        { error: `Reassign or transfer ${activeUsersCount} user(s) out of this department before decommissioning` },
        { status: 400 }
      );
    }

    // Perform soft-decommission
    const updated = await db.department.update({
      where: { id: department.id },
      data: { status: 'DECOMMISSIONED' },
    });

    await db.activityLog.create({
      data: {
        entityType: 'department',
        entityId: department.id,
        action: 'decommissioned',
        actorId: session.id,
        meta: JSON.stringify({ name: department.name }),
      },
    });

    return NextResponse.json({
      success: true,
      department: updated,
      message: `Department ${department.name} decommissioned successfully`,
    });
  } catch (error: any) {
    console.error('Decommission department error:', error);
    return NextResponse.json({ error: error.message || 'Failed to decommission department' }, { status: 500 });
  }
}
