import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim() || '';

  if (!query || query.length < 2) {
    return NextResponse.json({ projects: [], tasks: [] });
  }

  // Internal Roles Search
  let projectWhere: any = {
    OR: [
      { title: { contains: query } },
      { projectNumber: { contains: query } },
      { description: { contains: query } },
    ],
  };

  let taskWhere: any = {
    OR: [
      { title: { contains: query } },
      { taskNumber: { contains: query } },
      { description: { contains: query } },
    ],
  };

  if (session.role === 'HOD' || session.role === 'TEAM_LEAD') {
    projectWhere.departmentId = session.departmentId;
    taskWhere.project = { departmentId: session.departmentId };
  } else if (session.role === 'EMPLOYEE' || session.role === 'INTERN' || session.role === 'HR' || session.role === 'CONTRACTOR' || session.role === 'CLIENT') {
    projectWhere.OR = [
      { createdById: session.id },
      { pointOfContactId: session.id },
      { members: { some: { userId: session.id } } },
    ];
    taskWhere.OR = [
      { assigneeId: session.id },
      { project: { members: { some: { userId: session.id } } } },
    ];
  }

  const projects = await db.project.findMany({
    where: projectWhere,
    take: 10,
    select: {
      id: true,
      projectNumber: true,
      title: true,
      status: true,
    },
  });

  const tasks = await db.task.findMany({
    where: taskWhere,
    take: 10,
    select: {
      id: true,
      taskNumber: true,
      title: true,
      status: true,
      projectId: true,
      project: { select: { projectNumber: true } },
    },
  });

  return NextResponse.json({ projects, tasks });
}
