import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden: Viewers cannot upload attachments' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const taskId = formData.get('taskId') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    let targetProjectId = projectId;
    if (taskId && !targetProjectId) {
      const task = await db.task.findUnique({ where: { id: taskId } });
      if (task) targetProjectId = task.projectId;
    }

    if (targetProjectId) {
      const access = await checkProjectAccess(session, targetProjectId);
      if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFileName);

    fs.writeFileSync(filePath, fileBuffer);

    const attachment = await db.attachment.create({
      data: {
        projectId: targetProjectId || null,
        taskId: taskId || null,
        fileName: file.name,
        filePath: uniqueFileName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedById: session.id,
      },
      include: {
        uploadedBy: true,
      },
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
