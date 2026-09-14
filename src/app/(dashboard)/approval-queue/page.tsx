'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { CheckCircle2, XCircle, Calendar, UserCheck, ShieldCheck } from 'lucide-react';
import { WorkflowPipeline } from '@/components/projects/WorkflowPipeline';
import { TableRowSkeleton } from '@/components/ui/Skeleton';

export default function ApprovalQueuePage() {
  const [pendingProjects, setPendingProjects] = useState<any[]>([]);
  const [deptUsers, setDeptUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Approval Form State (HOD / Admin final approval)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [leadUserId, setLeadUserId] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalPriority, setApprovalPriority] = useState<string>('MEDIUM');

  // Team Lead Endorsement Modal State
  const [endorseProjectId, setEndorseProjectId] = useState<string | null>(null);
  const [endorseNote, setEndorseNote] = useState('');
  const [isSubmittingEndorse, setIsSubmittingEndorse] = useState(false);

  // Rejection Form State
  const [rejectionProjectId, setRejectionProjectId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [projRes, userRes, meRes] = await Promise.all([
        fetch('/api/projects?status=PENDING_APPROVAL'),
        fetch('/api/users?internalOnly=true'),
        fetch('/api/auth/me'),
      ]);
      const projData = await projRes.json();
      const userData = await userRes.json();
      const meData = await meRes.json();
      if (projData.projects) setPendingProjects(projData.projects);
      if (userData.users) setDeptUsers(userData.users);
      if (meData.user) setCurrentUser(meData.user);
    } catch (err) {
      console.error('Fetch approval queue data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingTickets = async () => {
    try {
      const res = await fetch('/api/projects?status=PENDING_APPROVAL');
      const data = await res.json();
      if (data.projects) setPendingProjects(data.projects);
    } catch (err) {
      console.error('Fetch pending error:', err);
    }
  };

  const openApproveModal = (p: any) => {
    setSelectedProjectId(p.id);
    setApprovalPriority(p.priority || 'MEDIUM');
    setLeadUserId('');
    setApprovalNote('');
  };

  const handleEndorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endorseProjectId) return;

    setIsSubmittingEndorse(true);
    try {
      const res = await fetch(`/api/projects/${endorseProjectId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNote: endorseNote }),
      });

      if (res.ok) {
        setEndorseProjectId(null);
        setEndorseNote('');
        fetchPendingTickets();
      }
    } catch (err) {
      console.error('Endorse error:', err);
    } finally {
      setIsSubmittingEndorse(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !leadUserId) return;

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadUserId, approvalNote, priority: approvalPriority }),
      });

      if (res.ok) {
        setSelectedProjectId(null);
        setLeadUserId('');
        setApprovalNote('');
        fetchPendingTickets();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionProjectId || !rejectionReason.trim()) return;

    try {
      const res = await fetch(`/api/projects/${rejectionProjectId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      if (res.ok) {
        setRejectionProjectId(null);
        setRejectionReason('');
        fetchPendingTickets();
      }
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  const isTeamLead = currentUser?.role === 'TEAM_LEAD';

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Approval Queue"
        subtitle={
          isTeamLead
            ? 'Review and endorse project tickets submitted by your team members'
            : 'Review and sign-off on department project tickets'
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : pendingProjects.length === 0 ? (
          <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto opacity-80" />
            <h3 className="text-sm font-semibold text-gray-200">Approval Queue is Clear</h3>
            <p className="text-xs text-gray-500">No pending project tickets requiring approval.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProjects.map((p) => {
              const isEndorsedByTeamLead = p.approvalStage === 'HOD' && Boolean(p.teamLeadApprovedById);

              return (
                <div
                  key={p.id}
                  className="p-5 bg-[#101114] hairline-border rounded-xl space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#5e6ad2]">
                          {p.projectNumber}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-100">{p.title}</h3>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-white/10 text-gray-300">
                          {p.department?.name}
                        </span>
                        {p.priority && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                              p.priority === 'URGENT'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : p.priority === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : p.priority === 'MEDIUM'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {p.priority}
                          </span>
                        )}
                        {p.approvalStage === 'TEAM_LEAD' && (
                          <span className="px-2 py-0.5 text-[10px] rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Stage 1: Team Lead Review
                          </span>
                        )}
                        {isEndorsedByTeamLead && (
                          <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck size={11} /> Team Lead Endorsed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isTeamLead ? (
                        <button
                          onClick={() => setEndorseProjectId(p.id)}
                          className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <UserCheck size={14} /> Endorse to HOD
                        </button>
                      ) : (
                        <button
                          onClick={() => openApproveModal(p)}
                          className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 size={14} /> Approve & Assign
                        </button>
                      )}
                      <button
                        onClick={() => setRejectionProjectId(p.id)}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <WorkflowPipeline project={p} compact={true} />
                  </div>

                  <div className="pt-3 hairline-t flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Requested By:</span>
                      <AvatarChip
                        name={p.createdBy?.name}
                        designation={p.createdBy?.designation}
                        size="sm"
                      />
                    </div>
                    {p.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> Proposed Due Date: {new Date(p.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Lead Endorse Modal */}
      {endorseProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Endorse Ticket to HOD</h2>
            <p className="text-xs text-gray-400">
              Endorsing this ticket passes it to the department HOD for final sign-off and lead allocation.
            </p>

            <form onSubmit={handleEndorse} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Recommendation / Note (Optional)</label>
                <input
                  type="text"
                  value={endorseNote}
                  onChange={(e) => setEndorseNote(e.target.value)}
                  placeholder="e.g. Scope reviewed with team member. Ready for HOD sign-off."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEndorseProjectId(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEndorse}
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingEndorse ? 'Endorsing...' : 'Endorse to HOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Ticket Modal (HOD / Admin) */}
      {selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Approve Project & Assign Lead</h2>
            <p className="text-xs text-gray-400">
              Approval will automatically stamp <code className="text-amber-300">timeOfAllocation</code> with current server time and set status to In Progress.
            </p>

            <form onSubmit={handleApprove} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Select Project Lead *</label>
                <select
                  required
                  value={leadUserId}
                  onChange={(e) => setLeadUserId(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="">Select Project Lead...</option>
                  {deptUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.designation || u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Project Priority</label>
                <select
                  value={approvalPriority}
                  onChange={(e) => setApprovalPriority(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Approval Note (Optional)</label>
                <input
                  type="text"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="e.g. High priority Q4 deliverable..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium"
                >
                  Approve Ticket Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Ticket Modal */}
      {rejectionProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Reject Project Ticket</h2>

            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this project ticket cannot be approved..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectionProjectId(null)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded font-medium"
                >
                  Reject Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
