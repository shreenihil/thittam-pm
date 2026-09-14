import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Delegations given by me
  const given = await db.approvalDelegation.findMany({
    where: { delegatorId: session.id },
    include: {
      delegate: { select: { id: true, name: true, role: true, designation: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Delegations received by me
  const received = await db.approvalDelegation.findMany({
    where: { delegateId: session.id, isActive: true },
    include: {
      delegator: { select: { id: true, name: true, role: true, designation: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ given, received });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role !== 'HOD' && session.role !== 'TEAM_LEAD' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Team Leads, HODs, or Admins can delegate approval powers' }, { status: 403 });
    }

    const { delegateId, startDate, endDate, reason } = await req.json();
    if (!delegateId) {
      return NextResponse.json({ error: 'Delegate user ID is required' }, { status: 400 });
    }

    const delegateUser = await db.user.findUnique({ where: { id: delegateId } });
    if (!delegateUser) {
      return NextResponse.json({ error: 'Delegate user not found' }, { status: 400 });
    }

    const delegation = await db.approvalDelegation.create({
      data: {
        delegatorId: session.id,
        delegateId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        reason: reason?.trim() || null,
        isActive: true,
      },
      include: {
        delegate: true,
      },
    });

    await db.notification.create({
      data: {
        userId: delegateId,
        type: 'assigned',
        message: `${session.name} (${session.role}) delegated their approval authority to you.`,
        link: `/profile`,
      },
    });

    return NextResponse.json({ success: true, delegation });
  } catch (err: any) {
    console.error('Create delegation error:', err);
    return NextResponse.json({ error: 'Failed to create delegation' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get('id');
    if (!delegationId) return NextResponse.json({ error: 'Delegation ID is required' }, { status: 400 });

    const delegation = await db.approvalDelegation.findUnique({ where: { id: delegationId } });
    if (!delegation || (delegation.delegatorId !== session.id && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.approvalDelegation.update({
      where: { id: delegationId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Delegation revoked' });
  } catch (err: any) {
    console.error('Delete delegation error:', err);
    return NextResponse.json({ error: 'Failed to revoke delegation' }, { status: 500 });
  }
}
