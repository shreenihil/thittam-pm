'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import {
  Building,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  ArrowRightLeft,
  X,
  UserCheck,
  Trash2,
  RefreshCw,
  Shield,
  Tag,
} from 'lucide-react';

import { TableRowSkeleton } from '@/components/ui/Skeleton';

export default function DepartmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'depts' | 'unassigned' | 'requests'>('depts');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [unassignedPool, setUnassignedPool] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Department Form
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptError, setDeptError] = useState('');
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Decommission & Reactivate Department State
  const [decommissionDept, setDecommissionDept] = useState<any>(null);
  const [isDeletingDept, setIsDeletingDept] = useState(false);
  const [reactivatingDeptId, setReactivatingDeptId] = useState<string | null>(null);

  // Assign HOD Modal
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [hodUserId, setHodUserId] = useState('');

  // Directly Add Employee Modal
  const [addEmpDeptId, setAddEmpDeptId] = useState<string | null>(null);
  const [addEmpUserId, setAddEmpUserId] = useState('');

  // HOD Claim Request Modal
  const [claimEmp, setClaimEmp] = useState<any>(null);
  const [claimReason, setClaimReason] = useState('');

  // Admin Request Resolution Modal
  const [resolveReq, setResolveReq] = useState<any>(null);
  const [resolveAction, setResolveAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [meRes, dRes, poolRes, reqRes, uRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/departments'),
        fetch('/api/departments/unassigned'),
        fetch('/api/departments/requests'),
        fetch('/api/users'),
      ]);

      const meData = await meRes.json();
      const dData = await dRes.json();
      const poolData = await poolRes.json();
      const reqData = await reqRes.json();
      const uData = await uRes.json();

      if (meData.user) {
        if (meData.user.role !== 'ADMIN' && meData.user.role !== 'HOD') {
          router.push('/dashboard');
          return;
        }
        setCurrentUser(meData.user);
        if (meData.user.role === 'HOD') setActiveTab('unassigned');
      }
      if (dData.departments) setDepartments(dData.departments);
      if (poolData.unassignedEmployees) setUnassignedPool(poolData.unassignedEmployees);
      if (reqData.requests) setRequests(reqData.requests);
      if (uData.users) setAllUsers(uData.users);
    } catch (err) {
      console.error('Fetch initial departments data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.departments) setDepartments(data.departments);
    } catch (err) {
      console.error('Fetch departments error:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const fetchUnassigned = async () => {
    try {
      const res = await fetch('/api/departments/unassigned');
      const data = await res.json();
      if (data.unassignedEmployees) setUnassignedPool(data.unassignedEmployees);
    } catch (err) {
      console.error('Fetch unassigned error:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/departments/requests');
      const data = await res.json();
      if (data.requests) setRequests(data.requests);
    } catch (err) {
      console.error('Fetch requests error:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setAllUsers(data.users);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError('');
    if (!deptName.trim()) return;

    setIsSubmittingDept(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptName, description: deptDesc }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDeptError(data.error || 'Failed to create department');
        return;
      }

      setDeptName('');
      setDeptDesc('');
      setIsDeptModalOpen(false);
      fetchDepartments();
    } catch (err) {
      setDeptError('An unexpected error occurred');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleAssignHod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !hodUserId) return;

    try {
      const res = await fetch('/api/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          assignHodUserId: hodUserId,
        }),
      });

      if (res.ok) {
        setSelectedDeptId(null);
        setHodUserId('');
        fetchDepartments();
      }
    } catch (err) {
      console.error('Assign HOD error:', err);
    }
  };

  const handleDirectAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmpDeptId || !addEmpUserId) return;

    try {
      const res = await fetch('/api/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: addEmpDeptId,
          addEmployeeUserId: addEmpUserId,
        }),
      });

      if (res.ok) {
        setAddEmpDeptId(null);
        setAddEmpUserId('');
        fetchDepartments();
        fetchUnassigned();
        fetchUsers();
      }
    } catch (err) {
      console.error('Direct add employee error:', err);
    }
  };

  const handleClaimUnassigned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimEmp || !currentUser?.departmentId) return;

    try {
      const res = await fetch('/api/departments/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: claimEmp.id,
          toDepartmentId: currentUser.departmentId,
          requestType: 'CLAIM_UNASSIGNED',
          reason: claimReason,
        }),
      });

      if (res.ok) {
        setClaimEmp(null);
        setClaimReason('');
        fetchRequests();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit claim request');
      }
    } catch (err) {
      console.error('Claim request error:', err);
    }
  };

  const handleResolveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveReq) return;

    try {
      const res = await fetch('/api/departments/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: resolveReq.id,
          action: resolveAction,
          adminNote,
        }),
      });

      if (res.ok) {
        setResolveReq(null);
        setAdminNote('');
        fetchRequests();
        fetchDepartments();
        fetchUnassigned();
        fetchUsers();
      }
    } catch (err) {
      console.error('Resolve request error:', err);
    }
  };

  const handleDecommissionDepartment = async () => {
    if (!decommissionDept) return;
    setIsDeletingDept(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: decommissionDept.id,
          action: 'DECOMMISSION',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDecommissionDept(null);
        fetchDepartments();
        fetchUnassigned();
        fetchUsers();
      } else {
        alert(data.error || 'Failed to decommission department');
      }
    } catch (err) {
      console.error('Decommission error:', err);
      alert('Failed to decommission department');
    } finally {
      setIsDeletingDept(false);
    }
  };

  const handleReactivateDepartment = async (dept: any) => {
    setReactivatingDeptId(dept.id);
    try {
      const res = await fetch('/api/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: dept.id,
          action: 'REACTIVATE',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchDepartments();
        fetchUnassigned();
        fetchUsers();
      } else {
        alert(data.error || 'Failed to reactivate department');
      }
    } catch (err) {
      console.error('Reactivate error:', err);
      alert('Failed to reactivate department');
    } finally {
      setReactivatingDeptId(null);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Department & Assignment Management"
        subtitle="Manage organization departments, HOD assignments, unassigned employee claims, and transfer approvals"
        onPrimaryAction={isAdmin ? () => setIsDeptModalOpen(true) : undefined}
        primaryActionLabel={isAdmin ? 'Create Department' : undefined}
      />

      {/* Navigation Tabs */}
      <div className="bg-[#0c0d0f] hairline-b px-6">
        <div className="flex gap-6 text-xs font-medium text-gray-400">
          <button
            onClick={() => setActiveTab('depts')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'depts'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            <Building size={14} /> Departments ({departments.length})
          </button>

          <button
            onClick={() => setActiveTab('unassigned')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'unassigned'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            <Users size={14} className="text-amber-400" /> Unassigned Pool ({unassignedPool.length})
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            <ArrowRightLeft size={14} /> Department Requests ({requests.length})
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : (
          <>
            {/* Tab 1: Departments List */}
            {activeTab === 'depts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {departments.map((dept) => {
              const isDecommissioned = dept.status === 'DECOMMISSIONED';
              return (
                <div
                  key={dept.id}
                  className={`p-5 rounded-xl space-y-4 shadow-sm transition-all ${
                    isDecommissioned
                      ? 'bg-[#0e0f12] border border-red-500/20 opacity-80'
                      : 'bg-[#101114] hairline-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                          <Building size={16} className={isDecommissioned ? 'text-gray-500' : 'text-[#5e6ad2]'} />
                          {dept.name}
                        </h3>

                        {/* Provenance and Lifecycle Badges */}
                        {dept.isSystem && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Shield size={10} /> System (Protected)
                          </span>
                        )}
                        {dept.isBuiltIn && !dept.isSystem && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <Tag size={10} /> Built-in
                          </span>
                        )}
                        {isDecommissioned && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                            <AlertCircle size={10} /> Decommissioned
                          </span>
                        )}
                      </div>

                      {dept.description && (
                        <p className="text-xs text-gray-400 leading-relaxed">{dept.description}</p>
                      )}
                    </div>

                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-white/10 text-gray-300 shrink-0">
                      {dept.employeeCount} Members
                    </span>
                  </div>

                  {isDecommissioned && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-300 flex items-center gap-2">
                      <AlertCircle size={13} className="shrink-0 text-red-400" />
                      <span>This department is decommissioned and hidden from user and project assignment pickers.</span>
                    </div>
                  )}

                  <div className="pt-3 hairline-t space-y-2 text-xs">
                    <span className="text-[11px] font-medium text-gray-400 block">Assigned HOD(s):</span>
                    {dept.hods && dept.hods.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {dept.hods.map((h: any) => (
                          <AvatarChip key={h.id} name={h.name} designation={h.designation} size="sm" isLead={true} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic text-[11px]">No HOD assigned yet.</p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="pt-3 hairline-t flex flex-wrap items-center justify-between gap-2">
                      {!isDecommissioned ? (
                        <>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedDeptId(dept.id)}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <UserPlus size={14} /> Assign HOD
                            </button>

                            <button
                              onClick={() => setAddEmpDeptId(dept.id)}
                              className="px-3 py-1.5 bg-[#5e6ad2]/20 hover:bg-[#5e6ad2]/30 text-[#5e6ad2] border border-[#5e6ad2]/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <Plus size={14} /> Direct Add Employee
                            </button>
                          </div>

                          {dept.isSystem ? (
                            <span className="px-2.5 py-1 text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                              System Department (Protected)
                            </span>
                          ) : (
                            <button
                              onClick={() => setDecommissionDept(dept)}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                              title="Decommission Department"
                            >
                              <Trash2 size={14} /> Decommission
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-gray-500 italic">Inactive / Soft-archived</span>
                          <button
                            onClick={() => handleReactivateDepartment(dept)}
                            disabled={reactivatingDeptId === dept.id}
                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw size={13} className={reactivatingDeptId === dept.id ? 'animate-spin' : ''} />
                            {reactivatingDeptId === dept.id ? 'Reactivating...' : 'Reactivate Department'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Unassigned Employees Pool */}
        {activeTab === 'unassigned' && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <h4 className="font-semibold">Unassigned Employee Pool</h4>
                <p className="text-[11px] text-amber-400/80">
                  Employees added without a department enter this pool. HODs can submit a Claim Request to assign them to their department (subject to Admin approval).
                </p>
              </div>
            </div>

            {unassignedPool.length === 0 ? (
              <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                <h3 className="text-sm font-semibold text-gray-200">Unassigned Pool is Empty</h3>
                <p className="text-xs text-gray-500">All registered employees are assigned to a department.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unassignedPool.map((emp) => (
                  <div key={emp.id} className="p-4 bg-[#101114] hairline-border rounded-xl flex items-center justify-between">
                    <AvatarChip name={emp.name} designation={emp.designation || emp.role} size="md" />

                    {currentUser?.role === 'HOD' && (
                      <button
                        onClick={() => setClaimEmp(emp)}
                        className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Claim for My Department
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Department Requests Approval Queue */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                <ArrowRightLeft size={32} className="text-gray-600 mx-auto" />
                <h3 className="text-sm font-semibold text-gray-200">No Department Requests</h3>
                <p className="text-xs text-gray-500">No pending or past department assignment requests found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-white/10 text-gray-300">
                            {r.requestType.replace('_', ' ')}
                          </span>
                          <span className="font-semibold text-gray-100">{r.employee?.name}</span>
                          <span className="text-gray-400">({r.employee?.designation})</span>
                        </div>
                        <p className="text-gray-300">
                          Transfer from <strong className="text-amber-400">{r.fromDepartment?.name || 'Unassigned'}</strong> to <strong className="text-emerald-400">{r.toDepartment?.name}</strong>
                        </p>
                        {r.reason && <p className="text-gray-400 italic">"{r.reason}"</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {r.status === 'PENDING' && isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setResolveReq(r);
                                setResolveAction('APPROVE');
                              }}
                              className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setResolveReq(r);
                                setResolveAction('REJECT');
                              }}
                              className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.status !== 'PENDING' && (
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded ${
                            r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {r.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 hairline-t flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>Requested by HOD: {r.requestedBy?.name}</span>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Create Department Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100">Create New Department</h2>
              <button onClick={() => setIsDeptModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            {deptError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {deptError}
              </div>
            )}

            <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Engineering / Product Operations"
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Department Description</label>
                <textarea
                  rows={3}
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Brief description of department scope..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDept}
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingDept ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign HOD Modal */}
      {selectedDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Assign Head of Department (HOD)</h2>
            <form onSubmit={handleAssignHod} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Select HOD User *</label>
                <select
                  required
                  value={hodUserId}
                  onChange={(e) => setHodUserId(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                >
                  <option value="">Select User to promote/assign as HOD...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.designation || u.role} ({u.departmentName || 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDeptId(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium">
                  Assign HOD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Add Employee Modal (Section 1 Auto HOD Notification) */}
      {addEmpDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Directly Add Employee to Department</h2>
            <p className="text-xs text-gray-400">
              Direct addition will automatically send an in-app notification to the HOD(s) of this department.
            </p>

            <form onSubmit={handleDirectAddEmployee} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Select Employee *</label>
                <select
                  required
                  value={addEmpUserId}
                  onChange={(e) => setAddEmpUserId(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                >
                  <option value="">Select Employee...</option>
                  {allUsers
                    .filter((u) => u.role !== 'ADMIN' && u.role !== 'HOD')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.designation || u.role} ({u.departmentName || 'Unassigned'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddEmpDeptId(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium">
                  Add & Notify HODs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Unassigned Employee Modal */}
      {claimEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Claim Unassigned Employee</h2>
            <p className="text-xs text-gray-400">
              Request to assign <strong className="text-gray-200">{claimEmp.name}</strong> to your department. Requires Admin approval.
            </p>

            <form onSubmit={handleClaimUnassigned} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Reason / Justification</label>
                <textarea
                  rows={2}
                  value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value)}
                  placeholder="Explain department need for this employee..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClaimEmp(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium">
                  Submit Claim Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Resolve Request Modal */}
      {resolveReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">
              {resolveAction === 'APPROVE' ? 'Approve' : 'Reject'} Department Request
            </h2>

            <form onSubmit={handleResolveRequest} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Admin Note (Optional)</label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Enter note for requesting HOD..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveReq(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-white rounded font-medium ${
                    resolveAction === 'APPROVE' ? 'bg-[#5e6ad2]' : 'bg-red-500'
                  }`}
                >
                  Confirm {resolveAction}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decommission Department Confirmation Modal */}
      {decommissionDept && (() => {
        const activeCount = decommissionDept.totalUsersCount ?? decommissionDept.employeeCount ?? 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle size={24} className="shrink-0" />
                <h2 className="text-sm font-semibold text-gray-100">Decommission Department</h2>
              </div>
              
              <p className="text-xs text-gray-300 leading-relaxed">
                Are you sure you want to decommission <strong className="text-white">{decommissionDept.name}</strong>?
              </p>

              {activeCount > 0 ? (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-300 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5 text-red-400">
                    <AlertCircle size={14} /> Action Blocked: Active Members Assigned
                  </p>
                  <p className="text-[11px] text-red-200/90 leading-relaxed">
                    This department currently has <strong>{activeCount} active member(s)</strong>.
                    Reassign or transfer {activeCount} user(s) out of this department before decommissioning.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 space-y-1">
                  <p className="font-medium">Soft Decommission Lifecycle:</p>
                  <ul className="list-disc list-inside text-amber-400/90 text-[11px] space-y-0.5">
                    <li>Status will be set to <strong>DECOMMISSIONED</strong>.</li>
                    <li>Disappears from all user, project, and ticket assignment pickers.</li>
                    <li>Historical records and activity logs remain completely preserved.</li>
                    <li>You can reactivate this department at any time.</li>
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="cancel-decommission-btn"
                  type="button"
                  onClick={() => setDecommissionDept(null)}
                  className="px-3 py-1.5 bg-[#181a20] text-gray-300 rounded text-xs font-medium hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  id="confirm-decommission-btn"
                  type="button"
                  onClick={handleDecommissionDepartment}
                  disabled={isDeletingDept || activeCount > 0}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow cursor-pointer disabled:cursor-not-allowed"
                >
                  {isDeletingDept
                    ? 'Decommissioning...'
                    : activeCount > 0
                    ? 'Transfer Members First'
                    : 'Confirm Decommission'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
