import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { SECURITY_HEADERS } from '@/lib/security';

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      {
        status: 401,
        headers: {
          ...SECURITY_HEADERS,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
        },
      }
    );
  }
  return NextResponse.json(
    { user: session },
    {
      headers: {
        ...SECURITY_HEADERS,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    }
  );
}
