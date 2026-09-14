import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const attachment = await db.attachment.findUnique({ where: { id } });
    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    if (attachment.projectId) {
      const access = await checkProjectAccess(session, attachment.projectId);
      if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fullPath = path.join(UPLOAD_DIR, attachment.filePath);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File on disk not found' }, { status: 404 });
    }

    const fileStream = fs.readFileSync(fullPath);

    return new NextResponse(fileStream, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Attachment download error:', error);
    return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 });
  }
}
