'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { useSocket } from '@/components/providers/SocketProvider';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  UserCheck,
  Send,
  AlertTriangle,
  Users2,
  Layers,
} from 'lucide-react';

import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { RequestFlowStepper } from '@/components/support/RequestFlowStepper';

export default function SupportRequestsPage() {
  const { subscribe } = useSocket();
  const [activeTab, setActiveTab] = useState<'team_lead' | 'review' | 'escalated' | 'dept_transfers' | 'response' | 'sent'>('review');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [sent, setSent] = useState<any[]>([]);
  const [userResponse, setUserResponse] = useState<any[]>([]);
  const [awaitingTeamLeadReview, setAwaitingTeamLeadReview] = useState<any[]>([]);
  const [awaitingHodReview, setAwaitingHodReview] = useState<any[]>([]);
  const [escalatedToAdmin, setEscalatedToAdmin] = useState<any[]>([]);
  const [deptTransfers, setDeptTransfers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptUsers, setDeptUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for Modals
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionType, setActionType] = useState<string>('');
  const [actionNote, setActionNote] = useState<string>('');
  const [assignUserId, setAssignUserId] = useState<string>('');

  // Create Support Request Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [kind, setKind] = useState<'PEOPLE_HELP' | 'ISSUE_ESCALATION'>('PEOPLE_HELP');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('NORMAL');
  const [isDirectAdmin, setIsDirectAdmin] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  useEffect(() => {
    fetchInitialData();

    const unsubCreated = subscribe('support:created', () => {
      fetchSupportRequests();
    });
    const unsubUpdated = subscribe('support:updated', () => {
      fetchSupportRequests();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [meRes, srRes, dtRes, uRes, dRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/support-requests'),
        fetch('/api/departments/requests'),
        fetch('/api/users'),
        fetch('/api/departments'),
      ]);

      const meData = await meRes.json();
      const srData = await srRes.json();
      const dtData = await dtRes.json();
      const uData = await uRes.json();
      const dData = await dRes.json();

      if (meData.user) {
        setCurrentUser(meData.user);
        if (meData.user.role === 'TEAM_LEAD') {
          setActiveTab('team_lead');
        } else if (meData.user.role === 'EMPLOYEE' || meData.user.role === 'INTERN') {
          setActiveTab('response');
        }
      }
      if (srData.sent) setSent(srData.sent);
      if (srData.userResponse) setUserResponse(srData.userResponse);
      if (srData.awaitingTeamLeadReview) setAwaitingTeamLeadReview(srData.awaitingTeamLeadReview);
      if (srData.awaitingHodReview) setAwaitingHodReview(srData.awaitingHodReview);
      if (srData.escalatedToAdmin) setEscalatedToAdmin(srData.escalatedToAdmin);
      if (dtData.requests) setDeptTransfers(dtData.requests);
      if (uData.users) setDeptUsers(uData.users);
      if (dData.departments) setDepartments(dData.departments);
    } catch (err) {
      console.error('Fetch initial data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupportRequests = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [srRes, dtRes] = await Promise.all([
        fetch('/api/support-requests'),
        fetch('/api/departments/requests'),
      ]);
      const data = await srRes.json();
      const dtData = await dtRes.json();

      if (data.sent) setSent(data.sent);
      if (data.userResponse) setUserResponse(data.userResponse);
      if (data.awaitingTeamLeadReview) setAwaitingTeamLeadReview(data.awaitingTeamLeadReview);
      if (data.awaitingHodReview) setAwaitingHodReview(data.awaitingHodReview);
      if (data.escalatedToAdmin) setEscalatedToAdmin(data.escalatedToAdmin);
      if (dtData.requests) setDeptTransfers(dtData.requests);
    } catch (err) {
      console.error('Fetch support requests error:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleCreateSupportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId || !reason.trim()) return;

    setIsSubmittingCreate(true);
    try {
      const res = await fetch('/api/support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          targetDepartmentId: targetDeptId,
          targetUserId: targetUserId || null,
          reason: reason.trim(),
          urgency,
          isDirectToAdmin: isDirectAdmin || currentUser?.role === 'HOD',
        }),
      });

      if (res.ok) {
        setTargetDeptId('');
        setTargetUserId('');
        setReason('');
        setUrgency('NORMAL');
        setIsDirectAdmin(false);
        setIsCreateModalOpen(false);
        fetchSupportRequests();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create support request.');
      }
    } catch (err) {
      console.error('Create support request error:', err);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !actionType) return;

    try {
      const res = await fetch('/api/support-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedReq.id,
          action: actionType,
          note: actionNote,
          assignUserId: assignUserId || null,
        }),
      });

      if (res.ok) {
        setSelectedReq(null);
        setActionType('');
        setActionNote('');
        setAssignUserId('');
        fetchSupportRequests();
      }
    } catch (err) {
      console.error('Execute action error:', err);
    }
  };

  const handleResolveDeptTransfer = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch('/api/departments/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });

      if (res.ok) {
        fetchSupportRequests();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to resolve transfer request.');
      }
    } catch (err) {
      console.error('Resolve dept transfer error:', err);
    }
  };

  const isHodOrAdmin = currentUser?.role === 'HOD' || currentUser?.role === 'ADMIN';
  const isTeamLead = currentUser?.role === 'TEAM_LEAD';
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Support & Escalation Requests"
        subtitle="Dedicated triage for peer help, Team Lead & HOD escalations, and employee transfer approvals"
        onPrimaryAction={() => {
          setTargetDeptId(currentUser?.departmentId || (departments[0]?.id || ''));
          setIsCreateModalOpen(true);
        }}
        primaryActionLabel={
          currentUser?.role === 'HOD'
            ? 'Request Help / Reach Admin'
            : currentUser?.role === 'ADMIN'
            ? 'Create Support Request'
            : 'Create Support / Escalation Request'
        }
      />

      {/* Tabs */}
      <div className="bg-[#0c0d0f] hairline-b px-6">
        <div className="flex gap-6 text-xs font-medium text-gray-400 overflow-x-auto">
          {isTeamLead && (
            <button
              onClick={() => setActiveTab('team_lead')}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'team_lead'
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              <Users2 size={14} className="text-indigo-400" />
              <span>Level 1: Team Lead Review ({awaitingTeamLeadReview.length})</span>
            </button>
          )}

          {isHodOrAdmin && (
            <button
              onClick={() => setActiveTab('review')}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'review'
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              <HelpCircle size={14} className="text-blue-400" />
              <span>Level 2: HOD Review ({awaitingHodReview.length})</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('escalated')}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'escalated'
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              <ShieldAlert size={14} className="text-amber-400" />
              <span>Level 3: Admin Escalation ({escalatedToAdmin.length})</span>
            </button>
          )}

          {isHodOrAdmin && (
            <button
              onClick={() => setActiveTab('dept_transfers')}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'dept_transfers'
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              <Clock size={14} className="text-emerald-400" />
              <span>Level 4: Dept Transfers ({deptTransfers.filter(r => r.status === 'PENDING').length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('response')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'response'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            <UserCheck size={14} className="text-purple-400" />
            <span>Invitations & Response ({userResponse.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sent'
                ? 'border-[#5e6ad2] text-white font-semibold'
                : 'border-transparent hover:text-gray-200'
            }`}
          >
            <Send size={14} />
            <span>My Sent Requests ({sent.length})</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab: Awaiting Team Lead Review */}
            {activeTab === 'team_lead' && (
              <>
                {awaitingTeamLeadReview.length === 0 ? (
                  <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-200">No Team Requests Awaiting Review</h3>
                    <p className="text-xs text-gray-500">All team member requests and escalations have been processed.</p>
                  </div>
                ) : (
                  awaitingTeamLeadReview.map((r) => (
                    <div key={r.id} className="p-5 bg-[#101114] hairline-border rounded-xl space-y-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase ${
                              r.kind === 'ISSUE_ESCALATION'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {r.kind === 'ISSUE_ESCALATION' ? 'Issue Escalation' : 'People Help'}
                            </span>

                            {r.project && (
                              <Link
                                href={`/projects/${r.project.id}`}
                                className="font-mono text-xs text-[#5e6ad2] font-semibold hover:underline"
                              >
                                {r.project.projectNumber} — {r.project.title}
                              </Link>
                            )}

                            <span className="px-2 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase font-bold">
                              {r.urgency} Urgency
                            </span>
                          </div>
                          <p className="text-xs text-gray-200 leading-relaxed font-medium">{r.reason}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('TEAM_LEAD_FORWARD_USER');
                            }}
                            className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Assign Colleague
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('TEAM_LEAD_FORWARD_HOD');
                            }}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <ArrowUpRight size={14} /> Escalate to HOD
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('TEAM_LEAD_RESOLVE');
                            }}
                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Resolve Directly
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <RequestFlowStepper request={r} compact={true} />
                      </div>

                      <div className="pt-3 hairline-t flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">Requested by:</span>
                          <AvatarChip name={r.requestedBy?.name} designation={r.requestedBy?.designation} size="sm" />
                          <span className="text-gray-500 ml-3">Target Dept:</span>
                          <span className="text-gray-300 font-semibold">{r.targetDepartment?.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab 1: Awaiting HOD Review */}
            {activeTab === 'review' && (
              <>
                {awaitingHodReview.length === 0 ? (
                  <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-200">No Requests Awaiting Review</h3>
                    <p className="text-xs text-gray-500">All department support requests have been reviewed.</p>
                  </div>
                ) : (
                  awaitingHodReview.map((r) => (
                    <div key={r.id} className="p-5 bg-[#101114] hairline-border rounded-xl space-y-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase ${
                              r.kind === 'ISSUE_ESCALATION'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {r.kind === 'ISSUE_ESCALATION' ? 'Issue Escalation' : 'People Help'}
                            </span>

                            {r.project && (
                              <Link
                                href={`/projects/${r.project.id}`}
                                className="font-mono text-xs text-[#5e6ad2] font-semibold hover:underline"
                              >
                                {r.project.projectNumber} — {r.project.title}
                              </Link>
                            )}

                            <span className="px-2 py-0.5 text-[10px] rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase font-bold">
                              {r.urgency} Urgency
                            </span>
                          </div>
                          <p className="text-xs text-gray-200 leading-relaxed font-medium">{r.reason}</p>

                          {r.teamLeadNote && (
                            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded mt-1">
                              <strong>Team Lead Note:</strong> {r.teamLeadNote}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('HOD_FORWARD');
                            }}
                            className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Approve & Forward
                          </button>
                          {currentUser?.role !== 'ADMIN' && (
                            <button
                              onClick={() => {
                                setSelectedReq(r);
                                setActionType('HOD_ESCALATE');
                              }}
                              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                            >
                              <ArrowUpRight size={14} /> Escalate to Admin
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('HOD_REJECT');
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <RequestFlowStepper request={r} compact={true} />
                      </div>

                      <div className="pt-3 hairline-t flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">Requested by:</span>
                          <AvatarChip name={r.requestedBy?.name} designation={r.requestedBy?.designation} size="sm" />
                          <span className="text-gray-500 ml-3">Target Dept:</span>
                          <span className="text-gray-300 font-semibold">{r.targetDepartment?.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab 2: Escalated to Admin */}
            {activeTab === 'escalated' && (
              <>
                {escalatedToAdmin.length === 0 ? (
                  <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-200">No Escalated Requests</h3>
                    <p className="text-xs text-gray-500">No support requests currently escalated to Admin.</p>
                  </div>
                ) : (
                  escalatedToAdmin.map((r) => (
                    <div key={r.id} className="p-5 bg-[#101114] border border-amber-500/30 rounded-xl space-y-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-400 font-bold uppercase flex items-center gap-1">
                              <ShieldAlert size={10} /> Escalated to Admin
                            </span>
                            {r.project && (
                              <Link href={`/projects/${r.project.id}`} className="font-mono text-xs text-[#5e6ad2] font-semibold hover:underline">
                                {r.project.projectNumber} — {r.project.title}
                              </Link>
                            )}
                          </div>
                          <p className="text-xs text-gray-200 leading-relaxed font-medium">{r.reason}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('ADMIN_FORWARD');
                            }}
                            className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Assign & Forward User
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('ADMIN_REJECT');
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <RequestFlowStepper request={r} compact={true} />
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab: Department Transfer & Claim Requests (Isolated List) */}
            {activeTab === 'dept_transfers' && (
              <div className="space-y-4">
                {deptTransfers.length === 0 ? (
                  <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-200">No Department Transfer Requests</h3>
                    <p className="text-xs text-gray-500">There are no pending or past department claim/transfer requests.</p>
                  </div>
                ) : (
                  deptTransfers.map((r) => (
                    <div key={r.id} className="p-5 bg-[#101114] hairline-border rounded-xl space-y-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {r.requestType.replace('_', ' ')}
                            </span>
                            <span className="text-sm font-semibold text-gray-100">{r.employee?.name}</span>
                            <span className="text-xs text-gray-400 font-mono">({r.employee?.email})</span>
                          </div>

                          <p className="text-xs text-gray-300">
                            Requested to join <strong className="text-emerald-400">{r.toDepartment?.name}</strong> from{' '}
                            <span className="text-gray-400">{r.fromDepartment?.name || 'Unassigned Pool'}</span>
                          </p>

                          {r.reason && (
                            <p className="text-xs text-gray-400 italic bg-white/5 p-2 rounded mt-1">
                              &quot;{r.reason}&quot;
                            </p>
                          )}
                        </div>

                        {/* Actions for Admin */}
                        {r.status === 'PENDING' ? (
                          isAdmin ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResolveDeptTransfer(r.id, 'APPROVE')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 size={14} /> Approve Transfer
                              </button>
                              <button
                                onClick={() => handleResolveDeptTransfer(r.id, 'REJECT')}
                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                              >
                                <XCircle size={14} /> Reject Request
                              </button>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                              Pending Admin Approval
                            </span>
                          )
                        ) : (
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {r.status}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 hairline-t flex items-center justify-between text-[11px] text-gray-400">
                        <span>Requested by HOD: <strong className="text-gray-200">{r.requestedBy?.name}</strong></span>
                        <span className="font-mono">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Awaiting My Response (Targeted User) */}
            {activeTab === 'response' && (
              <>
                {userResponse.length === 0 ? (
                  <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
                    <UserCheck size={32} className="text-gray-600 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-200">No Pending Invitations</h3>
                    <p className="text-xs text-gray-500">You have no support requests awaiting your acceptance.</p>
                  </div>
                ) : (
                  userResponse.map((r) => (
                    <div key={r.id} className="p-5 bg-[#101114] hairline-border rounded-xl space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          {r.project && (
                            <Link href={`/projects/${r.project.id}`} className="font-mono text-xs text-[#5e6ad2] font-semibold hover:underline">
                              {r.project.projectNumber} — {r.project.title}
                            </Link>
                          )}
                          <p className="text-xs text-gray-200 leading-relaxed font-medium">{r.reason}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('USER_ACCEPT');
                            }}
                            className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Accept & Join Team
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(r);
                              setActionType('USER_DECLINE');
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                          >
                            <XCircle size={14} /> Decline
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <RequestFlowStepper request={r} compact={true} />
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab 4: My Sent Requests */}
            {activeTab === 'sent' && (
              <div className="space-y-3">
                {sent.map((r) => (
                  <div key={r.id} className="p-4 bg-[#101114] hairline-border rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase ${
                          r.kind === 'ISSUE_ESCALATION'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {r.kind === 'ISSUE_ESCALATION' ? 'Issue' : 'People Help'}
                        </span>
                        {r.project && (
                          <Link href={`/projects/${r.project.id}`} className="font-mono font-semibold text-[#5e6ad2]">
                            {r.project.projectNumber} — {r.project.title}
                          </Link>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/10 text-gray-300">
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-gray-300">{r.reason}</p>

                    <div className="pt-2">
                      <RequestFlowStepper request={r} compact={true} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Modal (Forward / Escalate / Reject / Accept / Decline / Team Lead Actions) */}
      {selectedReq && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">
              {actionType.replace(/_/g, ' ')}
            </h2>

            <form onSubmit={handleExecuteAction} className="space-y-4 text-xs">
              {(actionType === 'HOD_FORWARD' || actionType === 'ADMIN_FORWARD' || actionType === 'TEAM_LEAD_FORWARD_USER') && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Select Person to Assign Support *</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  >
                    <option value="">Select Team Member...</option>
                    {deptUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.designation || u.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(actionType.includes('REJECT') || actionType.includes('ESCALATE') || actionType.includes('RESOLVE') || actionType.includes('FORWARD_HOD')) && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Review Note / Justification *</label>
                  <textarea
                    required
                    rows={3}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Provide reason or guidance note for this decision..."
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReq(null);
                    setActionType('');
                  }}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium"
                >
                  Confirm Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Support Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <HelpCircle size={16} className="text-[#5e6ad2]" />
                {kind === 'ISSUE_ESCALATION' ? 'Raise Issue / Obstacle Escalation' : 'Request Colleague / Department Help'}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <XCircle size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSupportRequest} className="space-y-4 text-xs">
              {/* Kind Toggle */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Request Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind('PEOPLE_HELP')}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                      kind === 'PEOPLE_HELP'
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Users2 size={14} className="text-indigo-400" />
                    <div>
                      <span className="block font-semibold">Peer / People Help</span>
                      <span className="text-[10px] opacity-75">Assistance on a task/project</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKind('ISSUE_ESCALATION')}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                      kind === 'ISSUE_ESCALATION'
                        ? 'bg-red-500/20 border-red-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <AlertTriangle size={14} className="text-red-400" />
                    <div>
                      <span className="block font-semibold">Issue Escalation</span>
                      <span className="text-[10px] opacity-75">Blocker requiring leadership</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Target Department *</label>
                <select
                  required
                  value={targetDeptId}
                  onChange={(e) => {
                    setTargetDeptId(e.target.value);
                    setTargetUserId('');
                  }}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="">Select Department...</option>
                  {departments
                    .filter((d) => d.status !== 'DECOMMISSIONED')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* If same department and PEOPLE_HELP, allow choosing specific colleague */}
              {kind === 'PEOPLE_HELP' && targetDeptId && targetDeptId === currentUser?.departmentId && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Specific Colleague (Optional)</label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  >
                    <option value="">Route to Team Lead / HOD for triage</option>
                    {deptUsers.filter(u => u.departmentId === targetDeptId && u.id !== currentUser?.id).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.designation || u.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentUser?.role === 'HOD' && (
                <label className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDirectAdmin}
                    onChange={(e) => setIsDirectAdmin(e.target.checked)}
                    className="rounded border-gray-700 bg-gray-900 text-amber-500"
                  />
                  <span className="text-amber-300 font-semibold text-[11px]">
                    Directly Escalated to Admin for urgent support/help
                  </span>
                </label>
              )}

              <div>
                <label className="text-gray-300 font-medium block mb-1">Urgency Level *</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="NORMAL">Normal Urgency</option>
                  <option value="HIGH">High Urgency</option>
                  <option value="URGENT">Critical / Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Support Details & Reason *</label>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the domain assistance, resources, or guidance needed..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
