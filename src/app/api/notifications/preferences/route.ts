import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pref = await db.notificationPreference.upsert({
    where: { userId: session.id },
    update: {},
    create: {
      userId: session.id,
      muteComments: false,
      muteStatusChanges: false,
      muteAssignments: false,
      muteApprovals: false,
      muteSupportRequests: false,
    },
  });

  return NextResponse.json({ preferences: pref });
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      muteComments,
      muteStatusChanges,
      muteAssignments,
      muteApprovals,
      muteSupportRequests,
    } = body;

    const updated = await db.notificationPreference.upsert({
      where: { userId: session.id },
      update: {
        ...(muteComments !== undefined ? { muteComments } : {}),
        ...(muteStatusChanges !== undefined ? { muteStatusChanges } : {}),
        ...(muteAssignments !== undefined ? { muteAssignments } : {}),
        ...(muteApprovals !== undefined ? { muteApprovals } : {}),
        ...(muteSupportRequests !== undefined ? { muteSupportRequests } : {}),
      },
      create: {
        userId: session.id,
        muteComments: muteComments || false,
        muteStatusChanges: muteStatusChanges || false,
        muteAssignments: muteAssignments || false,
        muteApprovals: muteApprovals || false,
        muteSupportRequests: muteSupportRequests || false,
      },
    });

    return NextResponse.json({ success: true, preferences: updated });
  } catch (err: any) {
    console.error('Update preferences error:', err);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
