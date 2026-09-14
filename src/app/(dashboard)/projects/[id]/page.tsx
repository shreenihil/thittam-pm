'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { TagBadge } from '@/components/ui/TagBadge';
import { TaskGanttView } from '@/components/projects/TaskGanttView';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { MilestonesPanel } from '@/components/projects/MilestonesPanel';
import { HistoryTab } from '@/components/projects/HistoryTab';
import { ExportProgressModal } from '@/components/projects/ExportProgressModal';
import { WorkflowPipeline } from '@/components/projects/WorkflowPipeline';
import { ProjectPresenceBadge, useSocket } from '@/components/providers/SocketProvider';
import { CommentThread } from '@/components/comments/CommentThread';
import {
  FolderKanban,
  CheckSquare,
  Clock,
  HelpCircle,
  Users,
  Paperclip,
  MessageSquare,
  Plus,
  Calendar,
  TrendingUp,
  X,
  UserCheck,
  Trash2,
  History,
  Download,
  CheckCircle2,
  AlertTriangle,
  Tag,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';

import { DashboardSkeleton } from '@/components/ui/Skeleton';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { joinProject, leaveProject, subscribe } = useSocket();
  const [project, setProject] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // New Task Form
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskEstHours, setTaskEstHours] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');

  // Daily Timeline Log Form
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineHours, setTimelineHours] = useState('');

  // Support Request Form
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [supportReason, setSupportReason] = useState('');
  const [supportUrgency, setSupportUrgency] = useState('NORMAL');
  const [deptUsers, setDeptUsers] = useState<any[]>([]);

  // Comment Thread State
  const [commentBody, setCommentBody] = useState('');

  // Decommission & Status Modal States
  const [isDecommissionModalOpen, setIsDecommissionModalOpen] = useState(false);
  const [decommissionReason, setDecommissionReason] = useState('');
  const [isSubmittingDecommission, setIsSubmittingDecommission] = useState(false);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Team & Members Management Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchProjectDetail(true);
    fetchDepartmentsAndUsers();

    joinProject(params.id);

    const unsubProject = subscribe('project:updated', (data: any) => {
      if (data?.projectId === params.id || data?.id === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubProjectDeleted = subscribe('project:deleted', (data: any) => {
      if (data?.projectId === params.id) {
        alert('This project was deleted.');
        router.replace('/projects');
      }
    });

    const unsubTaskCreated = subscribe('task:created', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubTaskUpdated = subscribe('task:updated', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubTaskDeleted = subscribe('task:deleted', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubTimeline = subscribe('timeline:added', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubComment = subscribe('comment:added', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    const unsubMilestone = subscribe('milestone:updated', (data: any) => {
      if (data?.projectId === params.id) {
        fetchProjectDetail();
      }
    });

    return () => {
      leaveProject(params.id);
      unsubProject();
      unsubProjectDeleted();
      unsubTaskCreated();
      unsubTaskUpdated();
      unsubTaskDeleted();
      unsubTimeline();
      unsubComment();
      unsubMilestone();
    };
  }, [params.id, router]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) setCurrentUser(data.user);
    } catch (err) {
      console.error('Fetch me error:', err);
    }
  };

  const fetchProjectDetail = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
        const lead = data.project.members?.find((m: any) => m.isLead);
        if (lead) setSelectedLeadId(lead.userId);
        if (data.project.members) {
          setSelectedMemberIds(data.project.members.map((m: any) => m.userId));
        }
      }
    } catch (err) {
      console.error('Fetch project detail error:', err);
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  };

  const fetchDepartmentsAndUsers = async () => {
    try {
      const [dRes, uRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/users'),
      ]);
      const dData = await dRes.json();
      const uData = await uRes.json();
      if (dData.departments) setDepartments(dData.departments);
      if (uData.users) setDeptUsers(uData.users);
    } catch (err) {
      console.error('Fetch dept/users error:', err);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority, version: project.version }),
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Change priority error:', err);
    }
  };

  const handleMarkAsOver = async () => {
    if (!confirm(`Are you sure you want to mark ${project.projectNumber} as Over / Completed?`)) return;
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', version: project.version }),
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Mark as over error:', err);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsDeleteModalOpen(false);
        router.replace('/projects');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Delete project error:', err);
      alert('An error occurred while deleting project');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTeamMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTeam(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadUserId: selectedLeadId || undefined,
          memberUserIds: selectedMemberIds,
          version: project.version,
        }),
      });

      if (res.ok) {
        setIsTeamModalOpen(false);
        fetchProjectDetail();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update team members');
      }
    } catch (err) {
      console.error('Update team error:', err);
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          title: taskTitle,
          description: taskDesc,
          assigneeId: taskAssigneeId || null,
          priority: taskPriority,
          estimatedHours: taskEstHours ? Number(taskEstHours) : null,
        }),
      });

      if (res.ok) {
        setTaskTitle('');
        setTaskDesc('');
        setTaskAssigneeId('');
        setTaskEstHours('');
        setTaskPriority('MEDIUM');
        setIsTaskModalOpen(false);
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Create task error:', err);
    }
  };

  const handleAddTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineNote.trim()) return;

    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          note: timelineNote,
          hoursSpent: timelineHours ? Number(timelineHours) : null,
        }),
      });

      if (res.ok) {
        setTimelineNote('');
        setTimelineHours('');
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Add timeline error:', err);
    }
  };

  const handlePostProjectComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    try {
      const res = await fetch(`/api/tasks/project/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          body: commentBody,
        }),
      });

      if (res.ok) {
        setCommentBody('');
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Post comment error:', err);
    }
  };

  const handleSendSupportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId || !supportReason.trim()) return;

    try {
      const res = await fetch('/api/support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.id,
          targetDepartmentId: targetDeptId,
          targetUserId: targetUserId || null,
          reason: supportReason,
          urgency: supportUrgency,
        }),
      });

      if (res.ok) {
        setTargetDeptId('');
        setTargetUserId('');
        setSupportReason('');
        setIsSupportModalOpen(false);
        fetchProjectDetail();
      }
    } catch (err) {
      console.error('Support request error:', err);
    }
  };

  const handleDecommissionProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decommissionReason.trim()) return;

    setIsSubmittingDecommission(true);
    setConflictWarning(null);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          rejectionReason: decommissionReason,
          version: project.version,
        }),
      });

      if (res.status === 409) {
        setConflictWarning('Concurrency Conflict: Another user has updated this project. Your view has been refreshed with latest changes.');
        fetchProjectDetail();
        setIsDecommissionModalOpen(false);
        return;
      }

      if (res.ok) {
        setDecommissionReason('');
        setIsDecommissionModalOpen(false);
        fetchProjectDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to decommission project.');
      }
    } catch (err) {
      console.error('Decommission error:', err);
    } finally {
      setIsSubmittingDecommission(false);
    }
  };

  const handleUpdateProjectStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    setIsSubmittingStatus(true);
    setConflictWarning(null);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          supportRequiredNote: statusReason || undefined,
          version: project.version,
        }),
      });

      if (res.status === 409) {
        setConflictWarning('Concurrency Conflict: Another user has updated this project. Your view has been refreshed with latest changes.');
        fetchProjectDetail();
        setIsStatusModalOpen(false);
        return;
      }

      if (res.ok) {
        setStatusReason('');
        setIsStatusModalOpen(false);
        fetchProjectDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update project status.');
      }
    } catch (err) {
      console.error('Status update error:', err);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  if (isLoading || !project) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <DashboardSkeleton />
      </div>
    );
  }

  const leadMember = project.members?.find((m: any) => m.isLead);
  const totalTasks = project.totalTasks !== undefined ? project.totalTasks : (project.tasks?.length || 0);
  const doneTasks = project.doneTasks !== undefined ? project.doneTasks : (project.tasks?.filter((t: any) => t.status === 'DONE').length || 0);
  const progressPercent = project.completionPercentage !== undefined ? project.completionPercentage : (totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);

  const isHodOrAdmin = currentUser?.role === 'ADMIN' || (currentUser?.role === 'HOD' && currentUser?.departmentId === project.departmentId);
  const canManage = isHodOrAdmin || leadMember?.userId === currentUser?.id;
  const isSameDepartmentTarget = currentUser?.departmentId && targetDeptId === currentUser.departmentId;

  const departmentMembers = deptUsers.filter(
    (u) => currentUser?.role === 'ADMIN' || u.departmentId === project.departmentId
  );

  return (
    <div className="flex-1 pb-12">
      <Header
        title={`${project.projectNumber} — ${project.title}`}
        subtitle={`Department: ${project.department?.name} | Created by ${project.createdBy?.name}`}
        extraActions={
          <div className="flex items-center gap-2 flex-wrap">
            <ProjectPresenceBadge currentUserId={currentUser?.id} />

            <StatusGlyph status={project.status} size={14} />

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium bg-white/5 text-gray-300 border border-white/10 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} /> Export
            </button>

            {/* Team Members Assignment Button (Admin & HOD) */}
            {isHodOrAdmin && (
              <button
                onClick={() => setIsTeamModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium bg-[#5e6ad2]/20 text-[#8b95e8] border border-[#5e6ad2]/30 rounded-md hover:bg-[#5e6ad2]/30 transition-colors flex items-center gap-1.5"
              >
                <Users size={14} /> Manage Team ({project.members?.length || 0})
              </button>
            )}

            {/* Mark as Over (Admin & HOD alone) */}
            {isHodOrAdmin && project.status !== 'COMPLETED' && (
              <button
                onClick={handleMarkAsOver}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={14} /> Mark as Over
              </button>
            )}

            {/* Delete Project (Admin & HOD alone) */}
            {isHodOrAdmin && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}

            {canManage && project.status !== 'CANCELLED' && (
              <>
                <button
                  onClick={() => setIsStatusModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md hover:bg-indigo-500/30 transition-colors flex items-center gap-1.5"
                >
                  <TrendingUp size={14} /> Update Status
                </button>
                <button
                  onClick={() => setIsDecommissionModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
                >
                  <X size={14} /> Cancel Project
                </button>
              </>
            )}

            <button
              onClick={() => {
                setTargetDeptId(project.departmentId);
                setIsSupportModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-md hover:bg-orange-500/30 transition-colors flex items-center gap-1.5"
            >
              <HelpCircle size={14} /> Request Support
            </button>
          </div>
        }
      />

      {/* Conflict Warning Banner */}
      {conflictWarning && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Concurrency Notice:</span>
            <span>{conflictWarning}</span>
          </div>
          <button
            onClick={() => setConflictWarning(null)}
            className="text-amber-300 hover:text-white text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="bg-[#0c0d0f] hairline-b px-6">
        <div className="flex gap-6 text-xs font-medium text-gray-400">
          {[
            { id: 'overview', label: 'Overview & Milestones', icon: <TrendingUp size={14} /> },
            { id: 'tasks', label: `Tasks (${totalTasks})`, icon: <CheckSquare size={14} /> },
            { id: 'team', label: `Team Members (${project.members?.length || 0})`, icon: <Users size={14} /> },
            { id: 'timeline', label: 'Daily Timeline', icon: <Clock size={14} /> },
            { id: 'history', label: 'Audit History', icon: <History size={14} /> },
            { id: 'comments', label: 'Comments Thread', icon: <MessageSquare size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#5e6ad2] text-white font-semibold'
                  : 'border-transparent hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Project Meta Bar */}
        <div className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3 text-xs shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Project Lead</span>
              <AvatarChip
                name={leadMember?.user?.name || project.pointOfContact?.name}
                designation={leadMember?.user?.designation || project.pointOfContact?.designation}
                isLead={true}
              />
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Priority Level</span>
              {canManage ? (
                <select
                  value={project.priority || 'MEDIUM'}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className="bg-[#0c0d0f] hairline-border text-xs px-2 py-1 rounded focus:outline-none font-semibold text-gray-200"
                >
                  <option value="LOW">⚪ Low</option>
                  <option value="MEDIUM">🔵 Medium</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="URGENT">🔴 Urgent</option>
                </select>
              ) : (
                <span className="font-semibold text-gray-300">
                  {project.priority === 'URGENT' && '🔴 Urgent'}
                  {project.priority === 'HIGH' && '🟠 High'}
                  {project.priority === 'LOW' && '⚪ Low'}
                  {(!project.priority || project.priority === 'MEDIUM') && '🔵 Medium'}
                </span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Time of Allocation</span>
              <span className="text-gray-300 font-mono">
                {project.timeOfAllocation
                  ? new Date(project.timeOfAllocation).toLocaleString()
                  : 'Pending Approval'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Target Due Date</span>
              <span className="text-gray-300 font-medium flex items-center gap-1">
                <Calendar size={12} />
                {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'Unset'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-gray-500 block mb-1">Live Progress</span>
              <span className="text-emerald-400 font-mono font-bold">{progressPercent}% Completed</span>
            </div>
          </div>

          {/* Labels & Tags row */}
          {project.labels && project.labels.length > 0 && (
            <div className="pt-2 hairline-t flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 font-semibold">
                <Tag size={11} /> Tags:
              </span>
              {project.labels.map((pl: any) => (
                <TagBadge key={pl.id || pl.label?.id} name={pl.label?.name || pl.name} color={pl.label?.color || pl.color} />
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Overview & Milestones */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Visual Lifecycle Pipeline */}
            <WorkflowPipeline project={project} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="p-5 bg-[#101114] hairline-border rounded-xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#5e6ad2]" /> Live Progress Completion
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span>Task Completion ({doneTasks} of {totalTasks} done)</span>
                      <span className="font-mono font-bold text-emerald-400">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-[#0c0d0f] rounded-full hairline-border overflow-hidden">
                      <div
                        style={{ width: `${progressPercent}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="pt-3 hairline-t space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400">Recent Work Timeline Digest</h4>
                    {project.timelineEntries && project.timelineEntries.length > 0 ? (
                      <div className="space-y-2">
                        {project.timelineEntries.slice(0, 4).map((te: any) => (
                          <div key={te.id} className="p-3 bg-[#0c0d0f] hairline-border rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <AvatarChip name={te.user?.name} designation={te.user?.designation} size="sm" />
                              <span className="text-[10px] text-gray-500 font-mono">
                                {new Date(te.entryDate).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-300 pl-7">{te.note}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic py-2">No timeline updates logged yet.</p>
                    )}
                  </div>
                </div>

                {/* Milestones Panel */}
                <MilestonesPanel
                  projectId={project.id}
                  milestones={project.milestones || []}
                  onMilestonesChange={fetchProjectDetail}
                  canManage={canManage}
                />
              </div>

              <div className="p-5 bg-[#101114] hairline-border rounded-xl space-y-4">
                <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Project Description</h3>
                <p className="text-xs text-gray-300 leading-relaxed">{project.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tasks */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Project Tasks ({totalTasks})
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> Add Task
              </button>
            </div>

            {project.tasks && project.tasks.length > 0 && (
              <TaskGanttView
                tasks={project.tasks}
                onSelectTask={(id) => setSelectedTaskId(id)}
              />
            )}

            <div className="space-y-2">
              {project.tasks?.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="p-3 bg-[#101114] hairline-border hover:border-gray-600 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#5e6ad2] font-semibold">{t.taskNumber}</span>
                    <span className="font-medium text-gray-100">{t.title}</span>
                    {t.priority === 'URGENT' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded uppercase">Urgent</span>
                    )}
                    {t.priority === 'HIGH' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded uppercase">High Priority</span>
                    )}
                    {t.priority === 'LOW' && (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded uppercase">Low</span>
                    )}
                    {(!t.priority || t.priority === 'MEDIUM') && (
                      <span className="px-2 py-0.5 text-[9px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded uppercase">Medium</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <AvatarChip name={t.assignee?.name} designation={t.assignee?.designation} size="sm" />
                    <StatusGlyph status={t.status} size={12} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Team & Members */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                  Assigned Team Members & Lead
                </h3>
                <p className="text-xs text-gray-400">
                  Team members assigned to this project can view deliverables, tasks, and log timeline progress.
                </p>
              </div>

              {isHodOrAdmin && (
                <button
                  onClick={() => setIsTeamModalOpen(true)}
                  className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={14} /> Assign / Change Team Members
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.members?.map((m: any) => (
                <div
                  key={m.id || m.userId}
                  className="p-4 bg-[#101114] hairline-border rounded-xl flex items-center justify-between space-y-2 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <AvatarChip
                      name={m.user?.name}
                      designation={m.user?.designation}
                      isLead={m.isLead}
                      showDesignation={true}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {m.isLead && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Project Lead
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500">
                      Added: {new Date(m.addedAt || project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <form onSubmit={handleAddTimelineEntry} className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-gray-200">Log Daily Progress Update</h3>
              <textarea
                required
                rows={2}
                value={timelineNote}
                onChange={(e) => setTimelineNote(e.target.value)}
                placeholder="What did you complete today on this project?..."
                className="w-full bg-[#0c0d0f] hairline-border text-xs text-gray-100 p-3 rounded focus:outline-none focus:border-[#5e6ad2]"
              />
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  placeholder="Hours spent (optional)"
                  value={timelineHours}
                  onChange={(e) => setTimelineHours(e.target.value)}
                  className="bg-[#0c0d0f] hairline-border text-xs text-gray-100 px-3 py-1.5 rounded focus:outline-none w-48"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white text-xs font-medium rounded hover:bg-[#4e5ac0]"
                >
                  Submit Log
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {project.timelineEntries?.map((te: any) => (
                <div key={te.id} className="p-4 bg-[#101114] hairline-border rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <AvatarChip name={te.user?.name} designation={te.user?.designation} size="sm" />
                    <span className="text-[11px] text-gray-500 font-mono">
                      {new Date(te.entryDate).toLocaleDateString()} — {te.hoursSpent ? `${te.hoursSpent} hrs` : ''}
                    </span>
                  </div>
                  <p className="text-gray-300 pl-8 leading-relaxed">{te.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Audit History */}
        {activeTab === 'history' && (
          <HistoryTab projectId={project.id} />
        )}

        {/* Tab 5: Comments Thread */}
        {activeTab === 'comments' && (
          <CommentThread
            projectId={project.id}
            comments={project.comments || []}
            availableUsers={deptUsers}
            projectMembers={project.members || []}
            onCommentPosted={() => fetchProjectDetail()}
            title={`Comments & Discussion (${project.projectNumber})`}
            placeholder="Share project updates, specify project changes, or tag colleagues..."
          />
        )}
      </div>

      {/* Team Members Modal (Admin & HOD) */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <Users size={16} className="text-[#5e6ad2]" /> Manage Team Members for {project.projectNumber}
              </h2>
              <button onClick={() => setIsTeamModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTeamMembers} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-200 font-medium block mb-1">Select Project Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => {
                    const newLead = e.target.value;
                    setSelectedLeadId(newLead);
                    if (newLead && !selectedMemberIds.includes(newLead)) {
                      setSelectedMemberIds((prev) => [...prev, newLead]);
                    }
                  }}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="">Select Project Lead...</option>
                  {departmentMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.designation || u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-200 font-medium block mb-1">
                  Assign Team Members to Project
                </label>
                <div className="max-h-56 overflow-y-auto space-y-1.5 bg-[#0c0d0f] p-3 rounded hairline-border">
                  {departmentMembers.map((u) => {
                    const isChecked = selectedMemberIds.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center justify-between p-1.5 hover:bg-white/5 rounded cursor-pointer">
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMemberIds((prev) => [...prev, u.id]);
                              } else {
                                setSelectedMemberIds((prev) => prev.filter((id) => id !== u.id));
                              }
                            }}
                            className="rounded border-gray-700 bg-gray-900 text-[#5e6ad2]"
                          />
                          <span>{u.name}</span>
                        </div>
                        <span className="text-[11px] text-gray-500">{u.designation || u.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTeam}
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSavingTeam ? 'Saving...' : 'Save Team Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Modal (Admin & HOD alone) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#101114] border border-red-500/30 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle size={18} /> Delete Project Permanently
              </h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-white">
                  {project.projectNumber} — {project.title}
                </strong>
                ?
              </p>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300 leading-relaxed">
                ⚠️ This action will permanently remove this project, its {project.tasks?.length || 0} tasks, all checklist items, milestones, attachments, and timeline records. This action cannot be undone.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50 flex items-center gap-1.5 shadow-md"
              >
                <Trash2 size={13} /> {isDeleting ? 'Deleting...' : 'Confirm Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={project}
      />

      {/* Task Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        user={currentUser}
        allProjectTasks={project.tasks || []}
        onTaskUpdated={fetchProjectDetail}
      />

      {/* Support Request Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100">Request Support on {project.projectNumber}</h2>
              <button onClick={() => setIsSupportModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendSupportRequest} className="space-y-3 text-xs">
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
                    .filter((d: any) => d.status !== 'DECOMMISSIONED')
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {isSameDepartmentTarget ? (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Select Specific Colleague / Lead *</label>
                  <select
                    required
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
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
              ) : (
                <div className="p-3 bg-white/5 border border-white/10 rounded text-[11px] text-gray-400">
                  Cross-department requests route directly to the target department's HOD to review and assign an appropriate team member.
                </div>
              )}

              <div>
                <label className="text-gray-300 font-medium block mb-1">Urgency Level *</label>
                <select
                  value={supportUrgency}
                  onChange={(e) => setSupportUrgency(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="NORMAL">Normal Urgency</option>
                  <option value="HIGH">High Urgency</option>
                  <option value="URGENT">Critical / Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Reason for Support *</label>
                <textarea
                  required
                  rows={3}
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  placeholder="Describe assistance or deliverable needed..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium"
                >
                  Submit Support Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-100">Create Task for {project.projectNumber}</h2>
            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-300 block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                />
              </div>

              <div>
                <label className="text-gray-300 block mb-1">Assignee (Team Member)</label>
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                >
                  <option value="">Unassigned</option>
                  {departmentMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.designation || u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 block mb-1">Priority Level *</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded font-semibold"
                  >
                    <option value="LOW">⚪ Low</option>
                    <option value="MEDIUM">🔵 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="URGENT">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-300 block mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={taskEstHours}
                    onChange={(e) => setTaskEstHours(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5e6ad2] text-white rounded font-medium"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel/Decommission Project Modal */}
      {isDecommissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] border border-red-500/30 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <X size={16} /> Cancel Project
              </h2>
              <button onClick={() => setIsDecommissionModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDecommissionProject} className="space-y-4 text-xs">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300">
                Warning: Cancelling this project will set its status to <strong>CANCELLED</strong> and notify all assigned members.
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Reason for Cancellation *</label>
                <textarea
                  required
                  rows={3}
                  value={decommissionReason}
                  onChange={(e) => setDecommissionReason(e.target.value)}
                  placeholder="Explain why this project is being cancelled..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDecommissionModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDecommission}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingDecommission ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#101114] hairline-border rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100">Update Project Status</h2>
              <button onClick={() => setIsStatusModalOpen(false)} className="p-1 text-gray-400 hover:text-white rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateProjectStatus} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Target Status *</label>
                <select
                  required
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                >
                  <option value="">Select Status...</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="SUPPORT_REQUIRED">Support Required</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed (Over)</option>
                </select>
              </div>

              {['ON_HOLD', 'SUPPORT_REQUIRED'].includes(targetStatus) && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Reason / Details Note *</label>
                  <textarea
                    required
                    rows={3}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder={`Explain why this project is being marked as ${targetStatus}...`}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 p-3 rounded focus:outline-none focus:border-[#5e6ad2]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-3 py-1.5 bg-white/5 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50"
                >
                  {isSubmittingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
