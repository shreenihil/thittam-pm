import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const labels = await db.label.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ labels });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, color } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Label name is required' }, { status: 400 });
    }

    const label = await db.label.upsert({
      where: { name: name.trim() },
      update: { color: color || '#6366f1' },
      create: {
        name: name.trim(),
        color: color || '#6366f1',
      },
    });

    return NextResponse.json({ success: true, label });
  } catch (err: any) {
    console.error('Create label error:', err);
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}
