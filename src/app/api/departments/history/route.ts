import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');

  let whereClause: any = {};
  if (employeeId) whereClause.employeeId = employeeId;

  const history = await db.departmentHistory.findMany({
    where: whereClause,
    include: {
      employee: { select: { id: true, name: true, email: true, designation: true } },
      changedBy: { select: { id: true, name: true, email: true, designation: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ history });
}
