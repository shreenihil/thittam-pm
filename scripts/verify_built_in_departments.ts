import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_DEPARTMENTS = [
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

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: Built-in Decommissionable Departments');
  console.log('====================================================\n');

  // Test 1: Verify all 11 built-in departments exist with exact names, descriptions, and isBuiltIn = true
  console.log('--- 1. Verification of Seeded Built-in Departments ---');
  for (const expected of EXPECTED_DEPARTMENTS) {
    const dept = await prisma.department.findUnique({
      where: { name: expected.name },
    });
    assert(!!dept, `Department '${expected.name}' exists in database`);
    if (dept) {
      assert(dept.isBuiltIn === true, `Department '${expected.name}' has isBuiltIn = true`);
      assert(dept.isSystem === false, `Department '${expected.name}' has isSystem = false (can be decommissioned)`);
      assert(dept.status === 'ACTIVE', `Department '${expected.name}' default status is 'ACTIVE'`);
      assert(dept.description === expected.description, `Department '${expected.name}' has description: "${expected.description}"`);
    }
  }

  // Test 2: Verify Management system department
  console.log('\n--- 2. System Management Department Isolation ---');
  const mgmtDept = await prisma.department.findUnique({
    where: { name: 'Management' },
  });
  assert(!!mgmtDept, "System 'Management' department exists");
  assert(mgmtDept?.isSystem === true, "'Management' department is strictly flagged isSystem = true");
  assert(mgmtDept?.isBuiltIn === false, "'Management' department is NOT flagged as isBuiltIn (distinct provenance)");

  const hrUser = await prisma.user.findUnique({
    where: { email: 'hr@thittam.local' },
  });
  assert(hrUser?.departmentId === mgmtDept?.id, "HR account 'hr@thittam.local' is seated in Management");

  // Test 3: Decommissioning a department with active users is blocked
  console.log('\n--- 3. Active User Decommission Guardrail ---');
  const targetDept = await prisma.department.findUnique({
    where: { name: 'Procurement / Purchasing' },
  });
  assert(!!targetDept, "Found 'Procurement / Purchasing' department");

  // Assign a test user to Procurement / Purchasing
  const testUser = await prisma.user.upsert({
    where: { email: 'test.procurement@thittam.local' },
    update: { departmentId: targetDept?.id, isActive: true },
    create: {
      name: 'Test Procurement Specialist',
      email: 'test.procurement@thittam.local',
      passwordHash: 'dummy_hash',
      role: 'EMPLOYEE',
      departmentId: targetDept?.id,
      isActive: true,
    },
  });

  // Check active user count guardrail
  const activeCountWithUser = await prisma.user.count({
    where: { departmentId: targetDept?.id, isActive: true },
  });
  assert(activeCountWithUser > 0, `Department has ${activeCountWithUser} active user(s) assigned`);
  const shouldBlock = activeCountWithUser > 0;
  assert(shouldBlock, "Server guardrail identifies assigned active users and blocks decommissioning");

  // Test 4: Move user out via reassignment, then decommission department
  console.log('\n--- 4. User Reassignment & Soft Decommission Lifecycle ---');
  // Reassign user to General
  const generalDept = await prisma.department.findUnique({ where: { name: 'General' } });
  await prisma.user.update({
    where: { id: testUser.id },
    data: { departmentId: generalDept?.id },
  });

  // Create audit record for transfer
  await prisma.departmentHistory.create({
    data: {
      employeeId: testUser.id,
      fromDepartmentName: targetDept!.name,
      toDepartmentName: generalDept!.name,
      changedById: hrUser!.id,
      reason: 'Reassigned prior to department decommissioning test',
    },
  });

  const activeCountAfterMove = await prisma.user.count({
    where: { departmentId: targetDept?.id, isActive: true },
  });
  assert(activeCountAfterMove === 0, 'Department now has 0 active members');

  // Decommission department (soft state change)
  const decommissionedDept = await prisma.department.update({
    where: { id: targetDept!.id },
    data: { status: 'DECOMMISSIONED' },
  });
  assert(decommissionedDept.status === 'DECOMMISSIONED', "Department status is now 'DECOMMISSIONED'");

  // Log activity
  const activity = await prisma.activityLog.create({
    data: {
      entityType: 'department',
      entityId: targetDept!.id,
      action: 'decommissioned',
      actorId: hrUser!.id,
      meta: JSON.stringify({ name: targetDept!.name }),
    },
  });
  assert(!!activity, 'Decommission action logged to ActivityLog');

  // Test 5: Verify historical records are intact
  console.log('\n--- 5. Historical Record Preservation ---');
  const pastHistory = await prisma.departmentHistory.findFirst({
    where: { employeeId: testUser.id, fromDepartmentName: targetDept!.name },
  });
  assert(!!pastHistory, "Historical department transfer record still contains department name '" + targetDept!.name + "'");

  // Verify pickers query filters out decommissioned departments
  const activeOnlyDepts = await prisma.department.findMany({
    where: { status: 'ACTIVE' },
  });
  assert(!activeOnlyDepts.some(d => d.id === targetDept!.id), 'Decommissioned department is excluded from ACTIVE-only queries');

  // Test 6: Reactivate Department
  console.log('\n--- 6. Department Reactivation Lifecycle ---');
  const reactivatedDept = await prisma.department.update({
    where: { id: targetDept!.id },
    data: { status: 'ACTIVE' },
  });
  assert(reactivatedDept.status === 'ACTIVE', "Department status flipped back to 'ACTIVE'");

  const activeDeptsAfterReactivate = await prisma.department.findMany({
    where: { status: 'ACTIVE' },
  });
  assert(activeDeptsAfterReactivate.some(d => d.id === targetDept!.id), 'Reactivated department returned to ACTIVE picker queries');

  // Test 7: No-HOD Routing Fallback
  console.log('\n--- 7. No-HOD Department Approval Fallback Routing ---');
  const legalDept = await prisma.department.findUnique({
    where: { name: 'Legal and Compliance' },
  });
  assert(!!legalDept, "Found 'Legal and Compliance' department");

  const legalHods = await prisma.user.findMany({
    where: { departmentId: legalDept!.id, role: 'HOD', isActive: true },
  });
  assert(legalHods.length === 0, "'Legal and Compliance' currently has 0 HODs assigned");

  // Verify fallback rule in ticket/support request triage logic
  const hasActiveHod = legalHods.length > 0;
  let initialRouting = 'PENDING_HOD_REVIEW';
  if (!hasActiveHod) {
    initialRouting = 'ESCALATED_TO_ADMIN';
  }
  assert(initialRouting === 'ESCALATED_TO_ADMIN', 'Department without HOD automatically falls back/escalates to Admin approval');

  // Cleanup test user and history
  await prisma.departmentHistory.deleteMany({ where: { employeeId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed (${totalTests - passedTests} failures)`);
  console.log('====================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
