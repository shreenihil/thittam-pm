import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { canViewWorkload } from '@/lib/permissions';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canViewWorkload(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let userWhere: any = {
    isActive: true,
  };

  if (session.role === 'HOD') {
    userWhere.departmentId = session.departmentId;
  } else if (session.role === 'TEAM_LEAD') {
    if (session.teamId) {
      userWhere.teamId = session.teamId;
    } else {
      userWhere.id = session.id;
    }
  }

  const users = await db.user.findMany({
    where: userWhere,
    include: {
      department: true,
      team: true,
      taskAssignments: {
        where: {
          status: { in: ['TODO', 'IN_PROGRESS', 'SUPPORT_REQUIRED', 'ON_HOLD'] },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const workload = users.map((u) => {
    const activeTasksCount = u.taskAssignments.length;
    const totalEstimatedHours = u.taskAssignments.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0
    );

    const capacityRatio = totalEstimatedHours / (u.weeklyCapacityHours || 40);
    let availabilityStatus: 'available' | 'near_capacity' | 'overloaded' = 'available';

    if (capacityRatio >= 1.0) {
      availabilityStatus = 'overloaded';
    } else if (capacityRatio >= 0.8) {
      availabilityStatus = 'near_capacity';
    }

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      designation: u.designation || 'Team Member',
      departmentName: u.department?.name || 'Unassigned',
      teamName: u.team?.name || null,
      weeklyCapacityHours: u.weeklyCapacityHours || 40,
      activeTasksCount,
      totalEstimatedHours,
      availabilityStatus,
      capacityRatio: Math.min(Math.round(capacityRatio * 100), 150),
    };
  });

  return NextResponse.json({ workload });
}
