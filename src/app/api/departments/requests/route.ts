import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let whereClause: any = {};
  if (session.role === 'HOD') {
    whereClause.OR = [
      { requestedById: session.id },
      { toDepartmentId: session.departmentId },
      { fromDepartmentId: session.departmentId },
    ];
  }

  const requests = await db.departmentRequest.findMany({
    where: whereClause,
    include: {
      employee: { select: { id: true, name: true, email: true, role: true, designation: true } },
      fromDepartment: true,
      toDepartment: true,
      requestedBy: { select: { id: true, name: true, email: true, designation: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { employeeId, toDepartmentId, requestType, reason } = await req.json();
    // requestType: "CLAIM_UNASSIGNED" | "TRANSFER"

    if (!employeeId || !toDepartmentId || !requestType) {
      return NextResponse.json({ error: 'Employee, target department, and request type are required' }, { status: 400 });
    }

    // Authorization check: HOD can only request for their own department (or Admin anywhere)
    if (session.role === 'HOD' && session.departmentId !== toDepartmentId) {
      return NextResponse.json({ error: 'HODs can only request assignments or transfers to their own department' }, { status: 403 });
    }

    const employee = await db.user.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });

    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // System department & HR protection: System accounts cannot be claimed or transferred
    if (employee.role === 'HR' || employee.department?.isSystem) {
      return NextResponse.json(
        { error: 'Forbidden: Accounts in system departments (such as HR / Management) cannot be claimed or transferred' },
        { status: 403 }
      );
    }

    const toDept = await db.department.findUnique({ where: { id: toDepartmentId } });
    if (!toDept) return NextResponse.json({ error: 'Target department not found' }, { status: 404 });
    if (toDept.isSystem) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot request transfers into a system department' },
        { status: 403 }
      );
    }
    if (toDept.status === 'DECOMMISSIONED') {
      return NextResponse.json(
        { error: 'Cannot request assignments or transfers into a decommissioned department' },
        { status: 400 }
      );
    }

    // Validation 1: Unassigned Claim vs Transfer
    if (requestType === 'CLAIM_UNASSIGNED') {
      if (employee.departmentId) {
        return NextResponse.json(
          { error: `Employee is already assigned to ${employee.department?.name}. Please submit a Transfer Request instead.` },
          { status: 400 }
        );
      }
    } else if (requestType === 'TRANSFER') {
      if (!employee.departmentId) {
        return NextResponse.json(
          { error: 'Employee is unassigned. Please submit a Claim Request instead.' },
          { status: 400 }
        );
      }
      if (employee.departmentId === toDepartmentId) {
        return NextResponse.json({ error: 'Employee is already in this department' }, { status: 400 });
      }
    }

    // Execute claim/transfer validation and creation inside atomic transaction
    const deptReq = await db.$transaction(async (tx) => {
      // Validation 1: Check duplicate pending requests for this employee inside lock
      const existingPending = await tx.departmentRequest.findFirst({
        where: {
          employeeId,
          status: 'PENDING',
        },
      });

      if (existingPending) {
        throw new Error('There is already a pending department request for this employee');
      }

      const emp = await tx.user.findUnique({
        where: { id: employeeId },
        include: { department: true },
      });

      if (!emp) throw new Error('Employee not found');
      if (emp.role === 'HR' || emp.department?.isSystem) {
        throw new Error('Accounts in system departments cannot be claimed or transferred');
      }

      const targetDept = await tx.department.findUnique({ where: { id: toDepartmentId } });
      if (!targetDept || targetDept.isSystem) {
        throw new Error('Cannot request transfers into a system department');
      }
      if (targetDept.status === 'DECOMMISSIONED') {
        throw new Error('Cannot request assignments or transfers into a decommissioned department');
      }

      // Validation 2: Unassigned Claim vs Transfer
      if (requestType === 'CLAIM_UNASSIGNED') {
        if (emp.departmentId) {
          throw new Error(`Employee is already assigned to ${emp.department?.name}. Please submit a Transfer Request instead.`);
        }
      } else if (requestType === 'TRANSFER') {
        if (!emp.departmentId) {
          throw new Error('Employee is unassigned. Please submit a Claim Request instead.');
        }
        if (emp.departmentId === toDepartmentId) {
          throw new Error('Employee is already in this department');
        }
      }

      return await tx.departmentRequest.create({
        data: {
          requestType,
          employeeId,
          fromDepartmentId: emp.departmentId || null,
          toDepartmentId,
          requestedById: session.id,
          status: 'PENDING',
          reason: reason || null,
        },
        include: {
          employee: true,
          toDepartment: true,
        },
      });
    });

    // Notify Admins of pending department request
    const admins = await db.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'department_request_pending',
          message: `${session.name} submitted a ${requestType.replace('_', ' ').toLowerCase()} request for ${deptReq.employee.name} to join ${deptReq.toDepartment.name}.`,
          link: `/departments`,
        },
      });
    }

    await db.activityLog.create({
      data: {
        entityType: 'department_request',
        entityId: deptReq.id,
        action: 'created_request',
        actorId: session.id,
        meta: JSON.stringify({ requestType, empName: deptReq.employee.name, toDeptId: toDepartmentId }),
      },
    });

    return NextResponse.json({ success: true, request: deptReq });
  } catch (error: any) {
    console.error('Submit department request error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit department request' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin approval required' }, { status: 403 });
    }

    const { requestId, action, adminNote } = await req.json(); // action: "APPROVE" | "REJECT"

    const now = new Date();
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // Wrap entire request resolution and department update in atomic transaction
    const updated = await db.$transaction(async (tx) => {
      const deptReq = await tx.departmentRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: { include: { department: true } },
          fromDepartment: true,
          toDepartment: true,
          requestedBy: true,
        },
      });

      if (!deptReq) throw new Error('Request not found');
      if (deptReq.status !== 'PENDING') {
        throw new Error('This request has already been resolved');
      }

      const res = await tx.departmentRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          adminNote: adminNote || null,
          resolvedAt: now,
        },
      });

      // If Approved: Update employee department and write DepartmentHistory
      if (action === 'APPROVE') {
        const fromDeptName = deptReq.fromDepartment?.name || 'Unassigned';

        await tx.user.update({
          where: { id: deptReq.employeeId },
          data: { departmentId: deptReq.toDepartmentId, teamId: null },
        });

        await tx.departmentHistory.create({
          data: {
            employeeId: deptReq.employeeId,
            fromDepartmentName: fromDeptName,
            toDepartmentName: deptReq.toDepartment.name,
            changedById: session.id,
            reason: `${deptReq.requestType.replace('_', ' ')} Approved by Admin`,
          },
        });

        // Automatically resolve/reject any OTHER pending requests for this employee
        await tx.departmentRequest.updateMany({
          where: {
            employeeId: deptReq.employeeId,
            id: { not: requestId },
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
            adminNote: 'Automatically closed because another department assignment/transfer request was approved.',
            resolvedAt: now,
          },
        });
      }

      // Notify requesting HOD
      await tx.notification.create({
        data: {
          userId: deptReq.requestedById,
          type: 'department_request_resolved',
          message: `Admin ${newStatus.toLowerCase()} your request to assign ${deptReq.employee.name} to ${deptReq.toDepartment.name}.`,
          link: `/departments`,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: 'department_request',
          entityId: requestId,
          action: action === 'APPROVE' ? 'approved' : 'rejected',
          actorId: session.id,
        },
      });

      return res;
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    console.error('Resolve department request error:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve department request' }, { status: 400 });
  }
}
