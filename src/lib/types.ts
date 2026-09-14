export type Role =
  | 'ADMIN'
  | 'HR'
  | 'HOD'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'INTERN'
  | 'CONTRACTOR'
  | 'CLIENT'
  | 'VIEWER';

export type ProjectStatus =
  | 'PENDING_APPROVAL'
  | 'IN_PROGRESS'
  | 'SUPPORT_REQUIRED'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'SUPPORT_REQUIRED'
  | 'ON_HOLD'
  | 'DONE'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SupportStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type DepartmentRequestType = 'CLAIM_UNASSIGNED' | 'TRANSFER';
export type DepartmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DepartmentRequestItem {
  id: string;
  requestType: DepartmentRequestType;
  employeeId: string;
  employee: ProjectMemberUser;
  fromDepartmentId?: string | null;
  fromDepartment?: { id: string; name: string } | null;
  toDepartmentId: string;
  toDepartment: { id: string; name: string };
  requestedById: string;
  requestedBy: ProjectMemberUser;
  status: DepartmentRequestStatus;
  reason?: string | null;
  adminNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface DepartmentHistoryItem {
  id: string;
  employeeId: string;
  fromDepartmentName?: string | null;
  toDepartmentName: string;
  changedById: string;
  changedBy: ProjectMemberUser;
  reason?: string | null;
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: Role;
  designation?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  mustResetPassword: boolean;
  weeklyCapacityHours: number;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  isBuiltIn?: boolean;
  status?: 'ACTIVE' | 'DECOMMISSIONED';
  createdAt: string;
}

export interface TeamItem {
  id: string;
  name: string;
  departmentId: string;
  leadId?: string | null;
  lead?: ProjectMemberUser | null;
  members?: ProjectMemberUser[];
  createdAt: string;
}


export interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
  designation?: string | null;
  role: Role;
  teamId?: string | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: ProjectMemberUser;
  isLead: boolean;
  addedVia: string;
  addedAt: string;
}

export interface TaskDependencyItem {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTask?: {
    id: string;
    taskNumber: string;
    title: string;
    status: TaskStatus;
  };
}

export interface TaskItem {
  id: string;
  taskNumber: string;
  projectId: string;
  projectNumber?: string;
  projectTitle?: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  assignee?: ProjectMemberUser | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  subtasks?: SubtaskItem[];
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  blockedBy?: TaskDependencyItem[];
  createdAt: string;
}

export interface SubtaskItem {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  order: number;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  authorId: string;
  author: ProjectMemberUser;
  body: string;
  type?: 'GENERAL' | 'CHANGE' | 'INFO';
  taggedUsers?: Array<{ id: string; name: string; designation?: string | null; role?: string }>;
  createdAt: string;
}

export interface AttachmentItem {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedBy: ProjectMemberUser;
  createdAt: string;
}

export interface TimelineEntryItem {
  id: string;
  projectId: string;
  taskId?: string | null;
  task?: { id: string; taskNumber: string; title: string } | null;
  userId: string;
  user: ProjectMemberUser;
  entryDate: string;
  note: string;
  hoursSpent?: number | null;
  createdAt: string;
}

export interface SupportRequestItem {
  id: string;
  projectId: string;
  project: { id: string; projectNumber: string; title: string };
  requestedById: string;
  requestedBy: ProjectMemberUser;
  requestedOfId?: string | null;
  requestedOf?: ProjectMemberUser | null;
  targetDepartmentId?: string;
  targetDepartment?: { id: string; name: string };
  targetUserId?: string | null;
  targetUser?: ProjectMemberUser | null;
  reason: string;
  status: SupportStatus;
  urgency?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface MilestoneItem {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  dueDate: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  projectNumber: string;
  title: string;
  description: string;
  departmentId: string;
  department?: Department | null;
  teamId?: string | null;
  team?: TeamItem | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  approvalStage?: string | null;
  version: number;
  pointOfContactId?: string | null;
  pointOfContact?: ProjectMemberUser | null;
  createdById: string;
  createdBy?: ProjectMemberUser;
  assignedDate?: string | null;
  dueDate?: string | null;
  timeOfAllocation?: string | null;
  members?: ProjectMember[];
  tasks?: TaskItem[];
  milestones?: MilestoneItem[];
  labels?: Array<{ id: string; name: string; color: string }>;
  timelineEntries?: TimelineEntryItem[];
  supportRequests?: SupportRequestItem[];
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actor?: ProjectMemberUser;
  meta?: any;
  createdAt: string;
}
