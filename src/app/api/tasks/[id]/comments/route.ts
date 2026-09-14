import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkProjectAccess } from '@/lib/permissions';
import { emitToProject, emitToUser } from '@/lib/socket-server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawId = params.id;
    const bodyData = await req.json();
    const { body, projectId, taggedUserIds = [], commentType = 'GENERAL' } = bodyData;

    if (!body || !body.trim()) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
    }

    if (session.role === 'VIEWER') {
      return NextResponse.json({ error: 'Forbidden: Viewers cannot post comments' }, { status: 403 });
    }

    let taskId = rawId !== 'project' ? rawId : null;
    let targetProjectId = projectId;
    let taskTitle = '';
    let projectTitle = '';

    if (taskId) {
      const task = await db.task.findUnique({
        where: { id: taskId },
        include: { project: { select: { id: true, title: true, projectNumber: true } } },
      });
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      targetProjectId = task.projectId;
      taskTitle = `${task.taskNumber} (${task.title})`;
      projectTitle = `${task.project.projectNumber} (${task.project.title})`;

      const access = await checkProjectAccess(session, targetProjectId);
      if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      // Project-level comment
      if (!targetProjectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
      }

      const project = await db.project.findUnique({
        where: { id: targetProjectId },
        select: { id: true, title: true, projectNumber: true },
      });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      projectTitle = `${project.projectNumber} (${project.title})`;

      const access = await checkProjectAccess(session, targetProjectId);
      if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch tagged user details
    const validTaggedUserIds = Array.isArray(taggedUserIds)
      ? Array.from(new Set(taggedUserIds.filter((id: string) => typeof id === 'string' && id.trim() !== '')))
      : [];

    let taggedUsers: Array<{ id: string; name: string; designation: string | null; role: string }> = [];
    if (validTaggedUserIds.length > 0) {
      taggedUsers = await db.user.findMany({
        where: { id: { in: validTaggedUserIds } },
        select: { id: true, name: true, designation: true, role: true },
      });
    }

    // Package metadata prefix if commentType is not default GENERAL or tagged users exist
    let storedBody = body.trim();
    if (commentType !== 'GENERAL' || taggedUsers.length > 0) {
      const meta = {
        type: commentType,
        taggedUsers: taggedUsers.map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          designation: u.designation,
        })),
      };
      storedBody = `<!--meta:${JSON.stringify(meta)}-->\n${storedBody}`;
    }

    const comment = await db.comment.create({
      data: {
        taskId: taskId || null,
        projectId: targetProjectId || null,
        authorId: session.id,
        body: storedBody,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            designation: true,
          },
        },
      },
    });

    const targetContextName = taskId ? `task "${taskTitle}"` : `project "${projectTitle}"`;
    const cleanPreview = body.trim().slice(0, 60) + (body.trim().length > 60 ? '...' : '');

    // 1. Direct targeted notifications for tagged users
    const notifiedUserIds = new Set<string>();
    notifiedUserIds.add(session.id); // don't notify self

    for (const taggedUser of taggedUsers) {
      if (taggedUser.id !== session.id) {
        notifiedUserIds.add(taggedUser.id);
        let tagMsg = `💬 ${session.name} tagged you on ${targetContextName}: "${cleanPreview}"`;
        if (commentType === 'CHANGE') {
          tagMsg = `🔄 [Project Change] ${session.name} tagged you regarding ${targetContextName}: "${cleanPreview}"`;
        } else if (commentType === 'INFO') {
          tagMsg = `ℹ️ [Project Info] ${session.name} tagged you with info on ${targetContextName}: "${cleanPreview}"`;
        }

        const notif = await db.notification.create({
          data: {
            userId: taggedUser.id,
            type: 'comment_added',
            message: tagMsg,
            link: `/projects/${targetProjectId}`,
          },
        });
        emitToUser(taggedUser.id, 'notification:new', notif);
      }
    }

    // 2. Notify other project members (respecting comment mute preference)
    const members = await db.projectMember.findMany({
      where: { projectId: targetProjectId },
      include: { user: { include: { notificationPreference: true } } },
    });

    for (const m of members) {
      if (!notifiedUserIds.has(m.userId)) {
        notifiedUserIds.add(m.userId);
        const isMuted = m.user?.notificationPreference?.muteComments;
        if (!isMuted) {
          let memberMsg = `${session.name} commented on ${targetContextName}: "${cleanPreview}"`;
          if (commentType === 'CHANGE') {
            memberMsg = `🔄 [Project Change] ${session.name} posted an update on ${targetContextName}: "${cleanPreview}"`;
          } else if (commentType === 'INFO') {
            memberMsg = `ℹ️ [Project Info] ${session.name} shared info on ${targetContextName}: "${cleanPreview}"`;
          }

          const notif = await db.notification.create({
            data: {
              userId: m.userId,
              type: 'comment_added',
              message: memberMsg,
              link: `/projects/${targetProjectId}`,
            },
          });
          emitToUser(m.userId, 'notification:new', notif);
        }
      }
    }

    // Real-Time Socket Emission to Project Room
    emitToProject(targetProjectId, 'comment:added', {
      comment,
      taskId: taskId || null,
      projectId: targetProjectId,
      actor: { id: session.id, name: session.name, role: session.role },
    });

    return NextResponse.json({ success: true, comment });
  } catch (error: any) {
    console.error('Post comment error:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
