import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const Role = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  HOD: 'HOD',
  TEAM_LEAD: 'TEAM_LEAD',
  EMPLOYEE: 'EMPLOYEE',
  INTERN: 'INTERN',
  CONTRACTOR: 'CONTRACTOR',
  CLIENT: 'CLIENT',
  VIEWER: 'VIEWER',
} as const;

const ProjectStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  IN_PROGRESS: 'IN_PROGRESS',
  SUPPORT_REQUIRED: 'SUPPORT_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
} as const;

const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  SUPPORT_REQUIRED: 'SUPPORT_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;

async function main() {
  console.log('Seeding Thittam database...');

  const defaultPasswordHash = await bcrypt.hash('thittam123', 10);

  // 1. Generic Sample Department (Existing for demo users)
  const deptGeneral = await prisma.department.upsert({
    where: { name: 'General' },
    update: { description: 'Primary cross-functional operations and delivery department', isSystem: false, isBuiltIn: false, status: 'ACTIVE' },
    create: {
      name: 'General',
      description: 'Primary cross-functional operations and delivery department',
      isSystem: false,
      isBuiltIn: false,
      status: 'ACTIVE',
    },
  });

  // 1.1 System Management Department (for HR role accounts & Executive system access)
  const deptManagement = await prisma.department.upsert({
    where: { name: 'Management' },
    update: { description: 'Executive & Administrative Management Department', isSystem: true, isBuiltIn: false, status: 'ACTIVE' },
    create: {
      name: 'Management',
      description: 'Executive & Administrative Management Department',
      isSystem: true,
      isBuiltIn: false,
      status: 'ACTIVE',
    },
  });

  // 1.2 Seed the 11 Built-in Decommissionable Departments
  const builtInDepartments = [
    { name: 'Executive / Administration', description: 'C-Suite, Leadership, Strategy' },
    { name: 'Operations / Production', description: 'Supply Chain, Logistics, Core Service Delivery' },
    { name: 'Finance and Accounting', description: 'Payroll, Tax, Forecasting' },
    { name: 'Human Resources (HR)', description: 'Talent Acquisition, Compliance, Culture' },
    { name: 'Marketing', description: 'Brand, SEO, PR, Advertising' },
    { name: 'Sales', description: 'Lead Conversion, Account Management, Revenue' },
    { name: 'Information Technology (IT)', description: 'Network Security, Infrastructure, Internal Support' },
    { name: 'Research & Development (R&D) / Product', description: 'Innovation, Engineering, Product Management' },
    { name: 'Customer Support / Success', description: 'Help Desk, Retention, Client Onboarding' },
    { name: 'Legal and Compliance', description: 'Contracts, IP, Regulatory Adherence' },
    { name: 'Procurement / Purchasing', description: 'Vendor Management, Sourcing' },
  ];

  for (const d of builtInDepartments) {
    await prisma.department.upsert({
      where: { name: d.name },
      update: {
        description: d.description,
        isBuiltIn: true,
        status: 'ACTIVE',
        isSystem: false,
      },
      create: {
        name: d.name,
        description: d.description,
        isBuiltIn: true,
        status: 'ACTIVE',
        isSystem: false,
      },
    });
  }

  // 1.2 Sample Team within General Department
  const teamCore = await prisma.team.upsert({
    where: { id: 'team_core_operations' },
    update: { name: 'Core Operations', departmentId: deptGeneral.id },
    create: {
      id: 'team_core_operations',
      name: 'Core Operations',
      departmentId: deptGeneral.id,
    },
  });

  // 2. Seed All Demo Role Accounts (mustResetPassword: false for instant testing)
  // Role 1: ADMIN (System Administrator)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'System Admin',
      email: 'admin@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.ADMIN,
      designation: 'System Administrator',
      departmentId: null,
      weeklyCapacityHours: 40,
    },
  });

  // Role 2: HR (Human Resources Lead)
  const hr = await prisma.user.upsert({
    where: { email: 'hr@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true, departmentId: deptManagement.id },
    create: {
      name: 'Priya Nair',
      email: 'hr@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.HR,
      designation: 'HR Lead & People Operations',
      departmentId: deptManagement.id,
      weeklyCapacityHours: 40,
    },
  });

  // Role 3: HOD (Department Head)
  const hod = await prisma.user.upsert({
    where: { email: 'hod@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Anita Roy',
      email: 'hod@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.HOD,
      designation: 'Department Head',
      departmentId: deptGeneral.id,
      weeklyCapacityHours: 40,
    },
  });

  // Role 4: TEAM_LEAD (Permanent department-scoped Team Lead)
  const teamLead = await prisma.user.upsert({
    where: { email: 'teamlead@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Rohan Sharma',
      email: 'teamlead@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.TEAM_LEAD,
      designation: 'Lead Producer',
      departmentId: deptGeneral.id,
      teamId: teamCore.id,
      weeklyCapacityHours: 40,
    },
  });

  // Connect team lead to team
  await prisma.team.update({
    where: { id: teamCore.id },
    data: { leadId: teamLead.id },
  });

  // Role 5: EMPLOYEE (Team Member)
  const employee = await prisma.user.upsert({
    where: { email: 'employee@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Sarah Daniels',
      email: 'employee@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.EMPLOYEE,
      designation: 'Senior Specialist',
      departmentId: deptGeneral.id,
      teamId: teamCore.id,
      weeklyCapacityHours: 40,
    },
  });

  // Role 6: INTERN (Department Intern)
  const intern = await prisma.user.upsert({
    where: { email: 'intern@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Vijay Verma',
      email: 'intern@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.INTERN,
      designation: 'Operations Intern',
      departmentId: deptGeneral.id,
      weeklyCapacityHours: 40,
    },
  });

  // Role 7: CONTRACTOR (External Contractor)
  const contractor = await prisma.user.upsert({
    where: { email: 'contractor@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Alex Rivera',
      email: 'contractor@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.CONTRACTOR,
      designation: 'Technical Contractor',
      departmentId: null,
      weeklyCapacityHours: 30,
    },
  });

  // Role 8: CLIENT (Client Stakeholder)
  const client = await prisma.user.upsert({
    where: { email: 'client@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'David Vance',
      email: 'client@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.CLIENT,
      designation: 'Client Stakeholder',
      departmentId: null,
      weeklyCapacityHours: 0,
    },
  });

  // Role 9: VIEWER (Internal Stakeholder / Executive Observer)
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@thittam.local' },
    update: { passwordHash: defaultPasswordHash, mustResetPassword: false, failedLoginAttempts: 0, lockoutUntil: null, isActive: true },
    create: {
      name: 'Executive Viewer',
      email: 'viewer@thittam.local',
      passwordHash: defaultPasswordHash,
      mustResetPassword: false,
      role: Role.VIEWER,
      designation: 'Stakeholder / Observer',
      departmentId: deptGeneral.id,
      weeklyCapacityHours: 0,
    },
  });

  // Seed default notification preferences
  const allUsers = [admin, hr, hod, teamLead, employee, intern, contractor, client, viewer];
  for (const u of allUsers) {
    await prisma.notificationPreference.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        muteComments: false,
        muteStatusChanges: false,
        muteAssignments: false,
        muteApprovals: false,
        muteSupportRequests: false,
      },
    });
  }

  // Seed standard labels
  const labelClientFacing = await prisma.label.upsert({
    where: { name: 'Client-facing' },
    update: {},
    create: { name: 'Client-facing', color: '#10b981' },
  });

  const labelUrgent = await prisma.label.upsert({
    where: { name: 'Urgent' },
    update: {},
    create: { name: 'Urgent', color: '#ef4444' },
  });

  const labelBlockedExternal = await prisma.label.upsert({
    where: { name: 'Blocked-external' },
    update: {},
    create: { name: 'Blocked-external', color: '#f59e0b' },
  });

  const labelInfrastructure = await prisma.label.upsert({
    where: { name: 'Infrastructure' },
    update: {},
    create: { name: 'Infrastructure', color: '#6366f1' },
  });

  const labelDesign = await prisma.label.upsert({
    where: { name: 'Design' },
    update: {},
    create: { name: 'Design', color: '#ec4899' },
  });

  console.log('Seeded users for internal company roles: Admin, HOD, Team Lead, Employee, Intern, Viewer.');

  // 3. Sample Projects
  // Project 1: Live In-Progress project with team members
  const proj1 = await prisma.project.upsert({
    where: { projectNumber: 'GEN-0001' },
    update: { version: 1 },
    create: {
      projectNumber: 'GEN-0001',
      title: 'Product Launch & Delivery Strategy',
      description: 'Comprehensive deliverable roadmap, creative assets, and Q4 launch timeline.',
      departmentId: deptGeneral.id,
      teamId: teamCore.id,
      status: ProjectStatus.IN_PROGRESS,
      approvalStage: 'APPROVED',
      version: 1,
      createdById: hod.id,
      pointOfContactId: teamLead.id,
      assignedDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-30'),
      timeOfAllocation: new Date('2026-09-01T10:00:00Z'),
      approvedById: hod.id,
    },
  });

  // Project 1 Labels
  await prisma.projectLabel.upsert({
    where: { projectId_labelId: { projectId: proj1.id, labelId: labelClientFacing.id } },
    update: {},
    create: { projectId: proj1.id, labelId: labelClientFacing.id },
  });

  // Project 1 Milestones
  await prisma.milestone.createMany({
    data: [
      {
        projectId: proj1.id,
        title: 'M1: Blueprint & Architecture Sign-off',
        description: 'Core design blueprint and technical deliverable roadmap approved.',
        dueDate: new Date('2026-09-06'),
        isCompleted: true,
      },
      {
        projectId: proj1.id,
        title: 'M2: Staging Media & Asset Review',
        description: 'Creative and media deliverables submitted to team review.',
        dueDate: new Date('2026-09-20'),
        isCompleted: false,
      },
      {
        projectId: proj1.id,
        title: 'M3: Production Launch & Handover',
        description: 'Final live deployment, documentation sign-off, and company handover.',
        dueDate: new Date('2026-09-30'),
        isCompleted: false,
      },
    ],
  });

  // Project Members
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: proj1.id, userId: teamLead.id } },
    update: {},
    create: {
      projectId: proj1.id,
      userId: teamLead.id,
      isLead: true,
      addedVia: 'assigned',
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: proj1.id, userId: employee.id } },
    update: {},
    create: {
      projectId: proj1.id,
      userId: employee.id,
      isLead: false,
      addedVia: 'assigned',
    },
  });

  // Project 2: Pending Approval project raised by Employee (in Core Operations team -> routes to Team Lead stage 1)
  const proj2 = await prisma.project.upsert({
    where: { projectNumber: 'GEN-0002' },
    update: { version: 1 },
    create: {
      projectNumber: 'GEN-0002',
      title: 'Design System & Component Library Modernization',
      description: 'Unified visual components, typography system, and cross-platform guideline documentation.',
      departmentId: deptGeneral.id,
      teamId: teamCore.id,
      status: ProjectStatus.PENDING_APPROVAL,
      approvalStage: 'TEAM_LEAD',
      version: 1,
      createdById: employee.id,
      pointOfContactId: employee.id,
      dueDate: new Date('2026-10-15'),
    },
  });

  await prisma.projectLabel.upsert({
    where: { projectId_labelId: { projectId: proj2.id, labelId: labelDesign.id } },
    update: {},
    create: { projectId: proj2.id, labelId: labelDesign.id },
  });

  // 4. Tasks for GEN-0001
  const task1 = await prisma.task.upsert({
    where: { taskNumber: 'GEN-0001-T1' },
    update: { version: 1 },
    create: {
      taskNumber: 'GEN-0001-T1',
      projectId: proj1.id,
      title: 'Deliverable Blueprint & Storyboard',
      description: 'Outline core milestones, review requirements, and schedule stakeholder alignment.',
      status: TaskStatus.DONE,
      version: 1,
      assigneeId: teamLead.id,
      startDate: new Date('2026-09-02'),
      dueDate: new Date('2026-09-06'),
      estimatedHours: 12,
    },
  });

  const task2 = await prisma.task.upsert({
    where: { taskNumber: 'GEN-0001-T2' },
    update: { version: 1 },
    create: {
      taskNumber: 'GEN-0001-T2',
      projectId: proj1.id,
      title: 'Visual Assets Production & Review',
      description: 'Create high-resolution marketing and product demo media.',
      status: TaskStatus.IN_PROGRESS,
      version: 1,
      assigneeId: employee.id,
      startDate: new Date('2026-09-07'),
      dueDate: new Date('2026-09-22'),
      estimatedHours: 24,
    },
  });

  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId: task2.id, labelId: labelDesign.id } },
    update: {},
    create: { taskId: task2.id, labelId: labelDesign.id },
  });

  // Task 3 assigned to intern
  const task3 = await prisma.task.upsert({
    where: { taskNumber: 'GEN-0001-T3' },
    update: { version: 1 },
    create: {
      taskNumber: 'GEN-0001-T3',
      projectId: proj1.id,
      title: 'Technical Infrastructure Audit & Performance Review',
      description: 'Internal security and scalability review of API endpoints and database indexes.',
      status: TaskStatus.IN_PROGRESS,
      version: 1,
      assigneeId: intern.id,
      startDate: new Date('2026-09-10'),
      dueDate: new Date('2026-09-25'),
      estimatedHours: 16,
    },
  });

  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId: task3.id, labelId: labelInfrastructure.id } },
    update: {},
    create: { taskId: task3.id, labelId: labelInfrastructure.id },
  });

  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnTaskId: { taskId: task2.id, dependsOnTaskId: task1.id } },
    update: {},
    create: {
      taskId: task2.id,
      dependsOnTaskId: task1.id,
    },
  });

  await prisma.subtask.createMany({
    data: [
      { taskId: task1.id, title: 'Draft technical specifications', isDone: true, order: 1 },
      { taskId: task1.id, title: 'Stakeholder sign-off', isDone: true, order: 2 },
    ],
  });

  await prisma.subtask.createMany({
    data: [
      { taskId: task2.id, title: 'Design system tokens export', isDone: true, order: 1 },
      { taskId: task2.id, title: 'Asset responsive rendering', isDone: false, order: 2 },
    ],
  });

  await prisma.comment.create({
    data: {
      projectId: proj1.id,
      taskId: task2.id,
      authorId: hod.id,
      body: 'Launch plan is looking sharp! Ensure the client review meeting is booked for next Tuesday.',
    },
  });

  await prisma.timelineEntry.createMany({
    data: [
      {
        projectId: proj1.id,
        taskId: task1.id,
        userId: teamLead.id,
        entryDate: new Date('2026-09-05'),
        note: 'Completed initial blueprint specifications.',
        hoursSpent: 6,
      },
      {
        projectId: proj1.id,
        taskId: task2.id,
        userId: employee.id,
        entryDate: new Date('2026-09-08'),
        note: 'Asset production 50% completed.',
        hoursSpent: 5,
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        entityType: 'project',
        entityId: proj1.id,
        action: 'created',
        actorId: hod.id,
        meta: JSON.stringify({ title: proj1.title, version: 1 }),
      },
      {
        entityType: 'project',
        entityId: proj1.id,
        action: 'approved',
        actorId: hod.id,
        meta: JSON.stringify({ timeOfAllocation: proj1.timeOfAllocation }),
      },
      {
        entityType: 'project',
        entityId: proj2.id,
        action: 'created_ticket',
        actorId: employee.id,
        meta: JSON.stringify({ title: proj2.title, version: 1 }),
      },
    ],
  });

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
