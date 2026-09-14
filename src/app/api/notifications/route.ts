import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await db.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const unreadCount = await db.notification.count({
    where: { userId: session.id, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notificationId, markAll } = await req.json();

  if (markAll) {
    await db.notification.updateMany({
      where: { userId: session.id, isRead: false },
      data: { isRead: true },
    });
  } else if (notificationId) {
    await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ success: true });
}
