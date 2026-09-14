import { NextResponse } from 'next/server';
import { SECURITY_HEADERS } from '@/lib/security';

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        ...SECURITY_HEADERS,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
