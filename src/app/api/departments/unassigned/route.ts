import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const unassignedEmployees = await db.user.findMany({
    where: {
      departmentId: null,
      role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEAD'] },
      isActive: true,
    },
    include: {
      departmentRequestsForMe: {
        where: { status: 'PENDING' },
        include: { toDepartment: true, requestedBy: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    unassignedEmployees: unassignedEmployees.map((u) => {
      const pendingReq = u.departmentRequestsForMe?.[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        designation: u.designation,
        weeklyCapacityHours: u.weeklyCapacityHours,
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
