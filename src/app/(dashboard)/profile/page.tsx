'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Bell,
  UserCheck,
  Calendar,
  Trash2,
  Plus,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [isPwdLoading, setIsPwdLoading] = useState(false);

  // Notification Preferences State
  const [pref, setPref] = useState({
    muteComments: false,
    muteStatusChanges: false,
    muteAssignments: false,
    muteApprovals: false,
    muteSupportRequests: false,
  });
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [prefMessage, setPrefMessage] = useState('');

  // Delegation State
  const [delegationsGiven, setDelegationsGiven] = useState<any[]>([]);
  const [delegationsReceived, setDelegationsReceived] = useState<any[]>([]);
  const [deptUsers, setDeptUsers] = useState<any[]>([]);
  const [delegateToUserId, setDelegateToUserId] = useState('');
  const [delegationEndDate, setDelegationEndDate] = useState('');
  const [delegationReason, setDelegationReason] = useState('');
  const [isCreatingDelegation, setIsCreatingDelegation] = useState(false);
  const [delegationMessage, setDelegationMessage] = useState('');
  const [delegationError, setDelegationError] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [meRes, prefRes, delRes, uRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/notifications/preferences'),
        fetch('/api/delegations'),
        fetch('/api/users?internalOnly=true'),
      ]);

      const meData = await meRes.json();
      const prefData = await prefRes.json();
      const delData = await delRes.json();
      const uData = await uRes.json();

      if (meData.user) setCurrentUser(meData.user);
      if (prefData.preference) {
        setPref({
          muteComments: prefData.preference.muteComments ?? false,
          muteStatusChanges: prefData.preference.muteStatusChanges ?? false,
          muteAssignments: prefData.preference.muteAssignments ?? false,
          muteApprovals: prefData.preference.muteApprovals ?? false,
          muteSupportRequests: prefData.preference.muteSupportRequests ?? false,
        });
      }
      if (delData.given) setDelegationsGiven(delData.given);
      if (delData.received) setDelegationsReceived(delData.received);
      if (uData.users) setDeptUsers(uData.users);
    } catch (err) {
      console.error('Fetch profile data error:', err);
    }
  };

  const handleTogglePref = async (key: keyof typeof pref) => {
    const updated = { ...pref, [key]: !pref[key] };
    setPref(updated);
    setIsSavingPref(true);
    setPrefMessage('');
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setPrefMessage('Preferences saved.');
        setTimeout(() => setPrefMessage(''), 2500);
      }
    } catch (err) {
      console.error('Update preferences error:', err);
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateToUserId) return;

    setIsCreatingDelegation(true);
    setDelegationMessage('');
    setDelegationError('');

    try {
      const res = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegateId: delegateToUserId,
          endDate: delegationEndDate ? new Date(delegationEndDate).toISOString() : null,
          reason: delegationReason,
        }),
      });

      if (res.ok) {
        setDelegationMessage('Approval delegation active.');
        setDelegateToUserId('');
        setDelegationEndDate('');
        setDelegationReason('');
        fetchProfileData();
        setTimeout(() => setDelegationMessage(''), 3000);
      } else {
        const err = await res.json();
        setDelegationError(err.error || 'Failed to create delegation');
      }
    } catch (err) {
      setDelegationError('Error creating delegation');
    } finally {
      setIsCreatingDelegation(false);
    }
  };

  const handleRevokeDelegation = async (id: string) => {
    try {
      const res = await fetch(`/api/delegations?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProfileData();
      }
    } catch (err) {
      console.error('Revoke delegation error:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage('');
    setPwdError('');

    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPwdError('Password must be at least 6 characters long');
      return;
    }

    setIsPwdLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (res.ok) {
        setPwdMessage('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPwdError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setPwdError('An unexpected error occurred');
    } finally {
      setIsPwdLoading(false);
    }
  };

  const canDelegate = currentUser && ['ADMIN', 'HOD', 'TEAM_LEAD'].includes(currentUser.role);

  return (
    <div className="flex-1 pb-12">
      <Header title="My Account Profile & Settings" subtitle="Manage security, granular notification controls, and approval delegation" />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* User Identity Card */}
        {currentUser && (
          <div className="p-5 bg-[#101114] hairline-border rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <AvatarChip name={currentUser.name} designation={currentUser.designation} size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-100">{currentUser.name}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#5e6ad2]/20 text-[#5e6ad2] uppercase">
                    {currentUser.role.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{currentUser.email}</span>
              </div>
            </div>
            <div className="text-right text-xs text-gray-400">
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Department</span>
              <span className="font-semibold text-gray-200">{currentUser.department?.name || 'Global'}</span>
            </div>
          </div>
        )}

        {/* Section 1: Notification Preferences */}
        <div className="bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Bell size={16} className="text-[#5e6ad2]" /> Notification & Alert Preferences
            </h3>
            {prefMessage && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> {prefMessage}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Control which real-time events send alerts to your notification drawer and badge.
          </p>

          <div className="space-y-3 pt-2">
            {[
              {
                key: 'muteComments' as const,
                title: 'Mute Project & Task Comments',
                desc: 'Suppress notifications when colleagues comment on your projects or tasks.',
              },
              {
                key: 'muteStatusChanges' as const,
                title: 'Mute Status & Progress Updates',
                desc: 'Suppress alerts for project stage transitions and completion rate updates.',
              },
              {
                key: 'muteAssignments' as const,
                title: 'Mute Task Assignments',
                desc: 'Suppress alerts when you are assigned or unassigned from tasks.',
              },
              {
                key: 'muteApprovals' as const,
                title: 'Mute Ticket & Project Approvals',
                desc: 'Suppress notifications when project approval requests are submitted or resolved.',
              },
              {
                key: 'muteSupportRequests' as const,
                title: 'Mute Support & Escalation Requests',
                desc: 'Suppress alerts for team support requests and peer help requests.',
              },
            ].map((item) => (
              <div
                key={item.key}
                onClick={() => handleTogglePref(item.key)}
                className="p-3.5 bg-[#0c0d0f] hairline-border hover:border-gray-600 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-xs font-semibold text-gray-200 block">{item.title}</span>
                  <span className="text-[11px] text-gray-400">{item.desc}</span>
                </div>
                <button
                  type="button"
                  className={`text-lg transition-colors ${
                    pref[item.key] ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {pref[item.key] ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 border border-amber-500/20 uppercase">
                      Muted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 border border-emerald-500/20 uppercase">
                      Active
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Approval Delegation (For Leads / HOD / Admin) */}
        {canDelegate && (
          <div className="bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-[#5e6ad2]" /> Out-of-Office Approval Delegation
            </h3>

            <p className="text-xs text-gray-400">
              Temporarily delegate your project ticket approval authority to another team lead or colleague (e.g., during leave).
            </p>

            {delegationMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={16} />
                {delegationMessage}
              </div>
            )}

            {delegationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                {delegationError}
              </div>
            )}

            {/* Active Delegations Given */}
            {delegationsGiven.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Active Delegations Granted by You
                </span>
                <div className="space-y-2">
                  {delegationsGiven.map((d: any) => (
                    <div
                      key={d.id}
                      className="p-3 bg-[#0c0d0f] border border-[#5e6ad2]/30 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Delegated to:</span>
                          <span className="font-semibold text-gray-200">{d.delegate?.name || d.delegateToUser?.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">({d.delegate?.email || d.delegateToUser?.email})</span>
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-2">
                          <span>Until: {d.endDate ? new Date(d.endDate).toLocaleDateString() : 'Indefinite'}</span>
                          {d.reason && <span>• &quot;{d.reason}&quot;</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeDelegation(d.id)}
                        className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} /> Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delegations Received */}
            {delegationsReceived.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Delegations Granted to You
                </span>
                <div className="space-y-2">
                  {delegationsReceived.map((d: any) => (
                    <div
                      key={d.id}
                      className="p-3 bg-[#0c0d0f] border border-emerald-500/30 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Delegated from:</span>
                        <span className="font-semibold text-emerald-400">{d.delegator?.name || d.delegatorUser?.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">({d.delegator?.email || d.delegatorUser?.email})</span>
                      </div>
                      <span className="text-[11px] text-gray-400 block">
                        Valid until: {d.endDate ? new Date(d.endDate).toLocaleDateString() : 'Indefinite'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grant New Delegation Form */}
            <form onSubmit={handleCreateDelegation} className="space-y-3 pt-2 text-xs">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Grant New Approval Delegation
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Delegate Authority To *</label>
                  <select
                    required
                    value={delegateToUserId}
                    onChange={(e) => setDelegateToUserId(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  >
                    <option value="">Select Team Member...</option>
                    {deptUsers
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.designation || u.role} ({u.department?.name || 'General'})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-medium block mb-1">Delegation End Date (Optional)</label>
                  <input
                    type="date"
                    value={delegationEndDate}
                    onChange={(e) => setDelegationEndDate(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Annual leave coverage"
                  value={delegationReason}
                  onChange={(e) => setDelegationReason(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isCreatingDelegation || !delegateToUserId}
                  className="px-4 py-2 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus size={14} /> Grant Delegation
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Section 3: Password Security */}
        <div className="bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <KeyRound size={16} className="text-[#5e6ad2]" /> Change Password
          </h3>

          {pwdMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={16} />
              {pwdMessage}
            </div>
          )}

          {pwdError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {pwdError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="text-gray-300 font-medium block mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>

            <div>
              <label className="text-gray-300 font-medium block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>

            <button
              type="submit"
              disabled={isPwdLoading}
              className="px-4 py-2 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isPwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
