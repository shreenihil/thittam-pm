'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { Plus, UserCheck, UserX, KeyRound, X, ArrowRightLeft, History, Building, Pencil } from 'lucide-react';

import { TableRowSkeleton } from '@/components/ui/Skeleton';

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [unassignedPool, setUnassignedPool] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned'>('all');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Modal State
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editRole, setEditRole] = useState('EMPLOYEE');
  const [editCapacity, setEditCapacity] = useState('40');
  const [editDeptId, setEditDeptId] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Transfer Request Modal State
  const [transferUser, setTransferUser] = useState<any>(null);
  const [transferTargetDeptId, setTransferTargetDeptId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // History Modal State
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const HR_ALLOWED_ROLES = ['EMPLOYEE', 'INTERN', 'CONTRACTOR', 'CLIENT'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [meRes, uRes, poolRes, dRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/users'),
        fetch('/api/departments/unassigned'),
        fetch('/api/departments'),
      ]);
      const meData = await meRes.json();
      const uData = await uRes.json();
      const poolData = await poolRes.json();
      const dData = await dRes.json();

      if (meData.user) setCurrentUser(meData.user);
      if (uData.users) setUsers(uData.users);
      if (poolData.unassignedEmployees) setUnassignedPool(poolData.unassignedEmployees);
      if (dData.departments) setDepartments(dData.departments);
    } catch (err) {
      console.error('Fetch initial users data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const [uRes, poolRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/departments/unassigned'),
      ]);
      const uData = await uRes.json();
      const poolData = await poolRes.json();
      if (uData.users) setUsers(uData.users);
      if (poolData.unassignedEmployees) setUnassignedPool(poolData.unassignedEmployees);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          role,
          designation,
          departmentId: currentUser?.role === 'ADMIN' ? (departmentId || null) : null,
          weeklyCapacityHours: capacity,
        }),
      });

      if (res.ok) {
        setName('');
        setEmail('');
        setDesignation('');
        setRole('EMPLOYEE');
        setDepartmentId('');
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Create user error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (u: any) => {
    setEditUser(u);
    setEditName(u.name);
    setEditDesignation(u.designation || '');
    setEditRole(u.role);
    setEditCapacity(String(u.weeklyCapacityHours || 40));
    setEditDeptId(u.departmentId || '');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setIsSubmittingEdit(true);
    try {
      const payload: any = {
        userId: editUser.id,
        name: editName,
        designation: editDesignation,
        role: editRole,
        weeklyCapacityHours: editCapacity,
      };

      if (currentUser?.role === 'ADMIN') {
        payload.departmentId = editDeptId || null;
      }

      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      console.error('Update user error:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !currentActive }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change account status');
      }
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const handleOpenTransferModal = (u: any) => {
    setTransferUser(u);
    setTransferTargetDeptId(currentUser?.departmentId || '');
    setTransferReason('');
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferUser || !transferTargetDeptId) return;

    const requestType = transferUser.departmentId ? 'TRANSFER' : 'CLAIM_UNASSIGNED';

    setIsSubmittingTransfer(true);
    try {
      const res = await fetch('/api/departments/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          employeeId: transferUser.id,
          toDepartmentId: transferTargetDeptId,
          reason: transferReason,
        }),
      });

      if (res.ok) {
        setTransferUser(null);
        alert(`${requestType === 'CLAIM_UNASSIGNED' ? 'Claim request for unassigned employee' : 'Department transfer request'} submitted successfully to Admin for approval!`);
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to submit request.');
      }
    } catch (err) {
      console.error('Submit transfer error:', err);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleOpenHistoryModal = async (u: any) => {
    setHistoryUser(u);
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/departments/history?userId=${u.id}`);
      const data = await res.json();
      if (data.history) setHistoryLogs(data.history);
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const renderRoleBadge = (uRole: string) => {
    switch (uRole) {
      case 'ADMIN':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
            ADMIN
          </span>
        );
      case 'HR':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            HR
          </span>
        );
      case 'HOD':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            HOD
          </span>
        );
      case 'TEAM_LEAD':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            TEAM LEAD
          </span>
        );
      case 'INTERN':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            INTERN
          </span>
        );
      case 'CONTRACTOR':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
            CONTRACTOR
          </span>
        );
      case 'CLIENT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            CLIENT
          </span>
        );
      case 'VIEWER':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
            VIEWER
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-500/10 text-gray-300 border border-gray-500/20">
            EMPLOYEE
          </span>
        );
    }
  };

  const canAddUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'HR';
  const isPrivileged = currentUser?.role === 'ADMIN' || currentUser?.role === 'HR';
  const isAdmin = currentUser?.role === 'ADMIN';
  const activeDepartments = departments.filter((d) => d.status !== 'DECOMMISSIONED');

  return (
    <div className="flex-1 pb-12">
      <Header
        title="User Accounts & Department Pool"
        subtitle="User directory, HOD unassigned employee request pool, and department transfers"
        onPrimaryAction={canAddUser ? () => setIsModalOpen(true) : undefined}
        primaryActionLabel={canAddUser ? 'Add New User' : undefined}
      />

      {/* Tabs */}
      <div className="bg-[#0c0d0f] hairline-b px-6">
        <div className="flex gap-6 text-xs font-medium text-gray-400">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            All Users Directory ({users.length})
          </button>

          {(currentUser?.role === 'HOD' || currentUser?.role === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'unassigned'
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              <Building size={14} className="text-amber-400" />
              Unassigned Pool ({unassignedPool.length})
            </button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {/* Info Prompt */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-amber-400 shrink-0" />
            <span>
              {activeTab === 'unassigned'
                ? 'HODs can view unassigned employees or interns below and request Admin approval to claim them for their department.'
                : 'All new user accounts start with default password thittam123 and are strictly forced to set a new password on first login.'}
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto bg-[#101114] hairline-border rounded-xl shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0c0d0f] text-gray-400 hairline-b font-medium select-none">
                <th className="py-3 px-4">User & Designation</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department & Status</th>
                <th className="py-3 px-4">Capacity Cap</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-4 space-y-3">
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                  </td>
                </tr>
              ) : (
                (activeTab === 'unassigned' ? unassignedPool : users).map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <AvatarChip name={u.name} designation={u.designation} size="md" />
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-300">{u.email}</td>
                  <td className="py-3 px-4">{renderRoleBadge(u.role)}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200">{u.departmentName || '—'}</span>
                        {u.departmentId ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                            Assigned
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                            Unassigned
                          </span>
                        )}
                      </div>
                      {u.hasPendingTransfer && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded w-fit" title={`Requested for ${u.pendingTransferInfo?.toDepartmentName} by ${u.pendingTransferInfo?.requestedByName}`}>
                          <span>⏳ Transfer Requested ({u.pendingTransferInfo?.toDepartmentName})</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300 font-mono">{u.weeklyCapacityHours} hrs/wk</td>
                  <td className="py-3 px-4">
                    {u.isActive ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit User Profile (Admin can edit all; HR can edit allowed roles) */}
                      {(currentUser?.role === 'ADMIN' || (currentUser?.role === 'HR' && HR_ALLOWED_ROLES.includes(u.role))) && (
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          title="Edit User Profile"
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      )}

                      {/* Department Transfer Button for HODs or Admin (Exclude system depts & HR) */}
                      {(currentUser?.role === 'HOD' || currentUser?.role === 'ADMIN') && u.role !== 'HR' && (
                        <button
                          onClick={() => handleOpenTransferModal(u)}
                          disabled={u.hasPendingTransfer}
                          title={u.hasPendingTransfer ? `Transfer already requested for ${u.pendingTransferInfo?.toDepartmentName}` : 'Request Department Transfer / Claim'}
                          className={`p-1.5 rounded transition-colors ${
                            u.hasPendingTransfer
                              ? 'text-gray-600 bg-white/5 cursor-not-allowed'
                              : 'text-gray-400 hover:text-indigo-400 hover:bg-white/5'
                          }`}
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      )}

                      {/* Audit History Button */}
                      <button
                        onClick={() => handleOpenHistoryModal(u)}
                        title="View Department Audit History"
                        className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors"
                      >
                        <History size={14} />
                      </button>

                      {/* Activate / Deactivate (Admin can toggle all; HR can toggle only allowed roles) */}
                      {(currentUser?.role === 'ADMIN' || (currentUser?.role === 'HR' && HR_ALLOWED_ROLES.includes(u.role))) && (
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className={`px-2.5 py-1 text-xs rounded transition-colors ${
                            u.isActive
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100">Create New User Account</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fayaz Khan"
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Email (Company or Personal) *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex@thittam.local or personal@example.com"
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Designation Label *</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Video Editor / Graphic Designer / Product Consultant"
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 block mb-1">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="INTERN">Intern</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="CLIENT">Client</option>
                    {currentUser?.role === 'ADMIN' && (
                      <>
                        <option value="TEAM_LEAD">Team Lead</option>
                        <option value="HOD">Head of Department (HOD)</option>
                        <option value="HR">HR Administrator</option>
                        <option value="ADMIN">Admin</option>
                        <option value="VIEWER">Viewer (Read-Only)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 block mb-1">Weekly Capacity</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="40"
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  />
                </div>
              </div>

              {currentUser?.role === 'ADMIN' ? (
                <div>
                  <label className="text-gray-300 block mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  >
                    <option value="">Unassigned (No Department / External)</option>
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.isSystem ? '(System)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-white/5 border border-white/10 rounded text-[11px] text-gray-400">
                  <span className="text-gray-300 font-medium">Department Placement:</span> Accounts created by HR enter the <strong className="text-amber-300">Unassigned Pool</strong> for HOD claim and Admin approval.
                </div>
              )}

              <div className="p-3 bg-white/5 border border-white/10 rounded text-[11px] text-gray-400">
                Default password will be set to <code className="text-amber-300 font-bold">thittam123</code>. The user will be forced to change password on first login.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <Pencil size={15} className="text-indigo-400" />
                Edit User Profile
              </h2>
              <button onClick={() => setEditUser(null)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Email Address (Read-only)</label>
                <input
                  type="email"
                  disabled
                  value={editUser.email}
                  className="w-full bg-white/5 hairline-border text-gray-400 px-3 py-2 rounded cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Designation Label *</label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 block mb-1">Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="INTERN">Intern</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="CLIENT">Client</option>
                    {currentUser?.role === 'ADMIN' && (
                      <>
                        <option value="TEAM_LEAD">Team Lead</option>
                        <option value="HOD">Head of Department (HOD)</option>
                        <option value="HR">HR Administrator</option>
                        <option value="ADMIN">Admin</option>
                        <option value="VIEWER">Viewer (Read-Only)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 block mb-1">Weekly Capacity</label>
                  <input
                    type="number"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    placeholder="40"
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  />
                </div>
              </div>

              {currentUser?.role === 'ADMIN' && (
                <div>
                  <label className="text-gray-300 block mb-1">Department</label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  >
                    <option value="">Unassigned (No Department / External)</option>
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.isSystem ? '(System)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Request Modal */}
      {transferUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-indigo-400" />
                Request Department Transfer
              </h2>
              <button onClick={() => setTransferUser(null)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-3 text-xs">
              <div className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                <p className="text-gray-300">
                  <span className="text-gray-400">Employee:</span> <strong className="text-white">{transferUser.name}</strong> ({transferUser.email})
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-400">Current Dept:</span>{' '}
                  <span className="text-indigo-300 font-medium">{transferUser.departmentName || 'Unassigned'}</span>
                </p>
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Target Department *</label>
                <select
                  required
                  value={transferTargetDeptId}
                  onChange={(e) => setTransferTargetDeptId(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                >
                  <option value="">Select target department...</option>
                  {activeDepartments
                    .filter((d) => !d.isSystem)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Transfer Reason / Business Justification</label>
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Explain why this employee is requested for department transfer..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded resize-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300">
                Notice: All transfer requests require explicit Admin approval before the employee is moved.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferUser(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingTransfer ? 'Submitting...' : 'Submit Transfer Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department History Audit Modal */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                  <History size={16} className="text-cyan-400" />
                  Department Audit History
                </h2>
                <p className="text-xs text-gray-400">Transfer logs for {historyUser.name}</p>
              </div>
              <button onClick={() => setHistoryUser(null)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-xs text-gray-400">Loading audit history...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No department transfer records found for this employee.
                </div>
              ) : (
                historyLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-[#0c0d0f] hairline-border rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-gray-300">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="text-gray-400">{log.fromDepartmentName || 'Unassigned'}</span>
                        <ArrowRightLeft size={12} className="text-indigo-400" />
                        <span className="text-emerald-400 font-semibold">{log.toDepartmentName}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(log.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 hairline-t">
                      <span>Requested by: <strong className="text-gray-300">{log.requestedByName}</strong></span>
                      <span>Approved by: <strong className="text-gray-300">{log.approvedByName || 'Admin'}</strong></span>
                    </div>

                    {log.reason && (
                      <p className="text-[11px] text-gray-400 italic bg-white/5 p-1.5 rounded mt-1">
                        &quot;{log.reason}&quot;
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryUser(null)}
                className="px-4 py-1.5 bg-white/5 text-gray-300 rounded font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
