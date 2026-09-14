import { UserSession } from './types';
import { db } from './db';

export async function checkProjectAccess(
  session: UserSession,
  projectId: string
): Promise<{ hasAccess: boolean; isLead: boolean; isClient: boolean }> {
  if (session.role === 'ADMIN' || session.role === 'VIEWER') {
    return { hasAccess: true, isLead: session.role === 'ADMIN', isClient: false };
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });

  if (!project) return { hasAccess: false, isLead: false, isClient: false };

  if (session.role === 'HOD') {
    const isSameDept = project.departmentId === session.departmentId;
    const member = project.members.find((m) => m.userId === session.id);
    return {
      hasAccess: isSameDept || !!member,
      isLead: member?.isLead ?? isSameDept,
      isClient: false,
    };
  }

  if (session.role === 'TEAM_LEAD') {
    const isSameDept = project.departmentId === session.departmentId;
    const member = project.members.find((m) => m.userId === session.id);
    const isCreator = project.createdById === session.id;
    const isPoc = project.pointOfContactId === session.id;
    return {
      hasAccess: isSameDept || !!member || isCreator || isPoc,
      isLead: member?.isLead ?? false,
      isClient: false,
    };
  }

  // EMPLOYEE, INTERN, HR, CONTRACTOR, CLIENT
  const member = project.members.find((m) => m.userId === session.id);
  const isCreator = project.createdById === session.id;
  const isPoc = project.pointOfContactId === session.id;

  return {
    hasAccess: !!member || isCreator || isPoc,
    isLead: member?.isLead ?? false,
    isClient: session.role === 'CLIENT',
  };
}

export function canManageUsers(session: UserSession, targetDepartmentId?: string | null): boolean {
  if (session.role === 'ADMIN' || session.role === 'HR') return true;
  if (session.role === 'HOD' && session.departmentId && session.departmentId === targetDepartmentId) {
    return true;
  }
  return false;
}

export async function canApproveProjectAsync(session: UserSession, projectDepartmentId: string): Promise<boolean> {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;

  // Check active delegations
  const delegation = await db.approvalDelegation.findFirst({
    where: {
      delegateId: session.id,
      isActive: true,
      delegator: {
        role: { in: ['HOD', 'ADMIN'] },
        departmentId: projectDepartmentId,
      },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
  });

  return !!delegation;
}

export function canApproveProject(session: UserSession, projectDepartmentId: string): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  return false;
}

export async function canApproveProjectFirstStage(
  session: UserSession,
  projectCreatorId: string
): Promise<boolean> {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD') return true;
  if (session.role === 'TEAM_LEAD') {
    if (!session.teamId) return false;
    const creator = await db.user.findUnique({ where: { id: projectCreatorId } });
    return creator?.teamId === session.teamId;
  }

  // Check active delegations
  const delegation = await db.approvalDelegation.findFirst({
    where: {
      delegateId: session.id,
      isActive: true,
      delegator: { role: 'TEAM_LEAD' },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } },
      ],
    },
  });

  return !!delegation;
}

export function canAssignProject(session: UserSession, projectDepartmentId: string): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  return false;
}

export function canGrantClientVisibility(session: UserSession, projectDepartmentId: string): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  return false;
}

export function canManageTask(
  session: UserSession,
  projectDepartmentId: string,
  isProjectLead: boolean
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  if (session.role === 'TEAM_LEAD' && session.departmentId === projectDepartmentId) return true;
  if (isProjectLead) return true;
  return false;
}

export function canDeleteProject(
  session: UserSession,
  projectDepartmentId?: string | null
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && projectDepartmentId && session.departmentId === projectDepartmentId) {
    return true;
  }
  return false;
}

export function canMarkProjectOver(
  session: UserSession,
  projectDepartmentId?: string | null
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && projectDepartmentId && session.departmentId === projectDepartmentId) {
    return true;
  }
  return false;
}

export function canDecommissionProject(
  session: UserSession,
  projectDepartmentId: string,
  isProjectLead: boolean = false
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  if (isProjectLead) return true;
  return false;
}

export function canUpdateProjectStatus(
  session: UserSession,
  projectDepartmentId: string,
  isProjectLead: boolean = false
): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId === projectDepartmentId) return true;
  if (isProjectLead) return true;
  return false;
}

export function canRequestUnassignedEmployee(session: UserSession): boolean {
  return session.role === 'ADMIN' || session.role === 'HOD';
}

export function canViewWorkload(session: UserSession): boolean {
  return session.role === 'ADMIN' || session.role === 'HOD' || session.role === 'TEAM_LEAD';
}

export function canViewActivityLog(session: UserSession): boolean {
  return session.role === 'ADMIN' || session.role === 'HOD';
}

export function canCreateSupportRequest(session: UserSession): boolean {
  return ['ADMIN', 'HR', 'HOD', 'TEAM_LEAD', 'EMPLOYEE', 'INTERN'].includes(session.role);
}

export function canTriageSupportRequest(session: UserSession, targetDepartmentId?: string): boolean {
  if (session.role === 'ADMIN') return true;
  if (session.role === 'HOD' && session.departmentId && (!targetDepartmentId || session.departmentId === targetDepartmentId)) {
    return true;
  }
  return false;
}
