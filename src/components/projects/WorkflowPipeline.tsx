'use client';

import React from 'react';
import {
  FileText,
  UserCheck,
  ShieldCheck,
  PlayCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  XCircle,
} from 'lucide-react';

interface WorkflowPipelineProps {
  project: {
    status: string;
    approvalStage?: string | null;
    createdAt: string | Date;
    createdBy?: { name: string; role?: string };
    teamLeadApprovedById?: string | null;
    teamLeadApprovedAt?: string | Date | null;
    timeOfAllocation?: string | Date | null;
    approvedById?: string | null;
    completionPercentage?: number;
    totalTasks?: number;
    doneTasks?: number;
  };
  compact?: boolean;
}

export const WorkflowPipeline: React.FC<WorkflowPipelineProps> = ({ project, compact = false }) => {
  const isCancelled = project.status === 'CANCELLED' || project.status === 'REJECTED';
  const isPendingApproval = project.status === 'PENDING_APPROVAL';
  const isTeamLeadStage = isPendingApproval && project.approvalStage === 'TEAM_LEAD';
  const isHodStage = isPendingApproval && (!project.approvalStage || project.approvalStage === 'HOD');
  const isCompleted = project.status === 'COMPLETED';
  const isInProgress = ['IN_PROGRESS', 'SUPPORT_REQUIRED', 'ON_HOLD'].includes(project.status);

  // Stage states: 'completed' | 'current' | 'upcoming' | 'rejected'
  const stages = [
    {
      id: 'draft',
      label: '1. Ticket Drafted',
      subtitle: project.createdBy ? `By ${project.createdBy.name}` : 'Created',
      icon: <FileText size={14} />,
      state: 'completed' as const,
      timestamp: project.createdAt ? new Date(project.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : null,
    },
    {
      id: 'team_lead',
      label: '2. Team Lead Endorsement',
      subtitle: project.teamLeadApprovedAt
        ? 'Stage 1 Endorsed'
        : isTeamLeadStage
        ? 'Pending Review'
        : 'Bypassed / Not required',
      icon: <UserCheck size={14} />,
      state: (project.teamLeadApprovedAt || (!isTeamLeadStage && !isPendingApproval)
        ? 'completed'
        : isTeamLeadStage
        ? 'current'
        : 'upcoming') as 'completed' | 'current' | 'upcoming',
      timestamp: project.teamLeadApprovedAt
        ? new Date(project.teamLeadApprovedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : null,
    },
    {
      id: 'hod',
      label: '3. HOD Final Approval',
      subtitle: project.timeOfAllocation
        ? 'Stage 2 Approved'
        : isHodStage
        ? 'Pending HOD Sign-off'
        : 'Awaiting Stage 1',
      icon: <ShieldCheck size={14} />,
      state: (project.timeOfAllocation
        ? 'completed'
        : isHodStage
        ? 'current'
        : 'upcoming') as 'completed' | 'current' | 'upcoming',
      timestamp: project.timeOfAllocation
        ? new Date(project.timeOfAllocation).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : null,
    },
    {
      id: 'execution',
      label: '4. Active Execution',
      subtitle: isCompleted
        ? '100% Executed'
        : isInProgress
        ? `${project.completionPercentage ?? 0}% Completed`
        : 'Pending Allocation',
      icon: <PlayCircle size={14} />,
      state: (isCompleted
        ? 'completed'
        : isInProgress
        ? 'current'
        : 'upcoming') as 'completed' | 'current' | 'upcoming',
      timestamp: null,
    },
    {
      id: 'completed',
      label: isCancelled ? 'Cancelled / Closed' : '5. Verified & Delivered',
      subtitle: isCancelled ? 'Project Decommissioned' : isCompleted ? 'Completed' : 'Final Delivery',
      icon: isCancelled ? <XCircle size={14} /> : <CheckCircle2 size={14} />,
      state: (isCancelled
        ? 'rejected'
        : isCompleted
        ? 'completed'
        : 'upcoming') as 'completed' | 'current' | 'upcoming' | 'rejected',
      timestamp: null,
    },
  ];

  return (
    <div className={`w-full ${compact ? 'p-3' : 'p-4'} bg-[#0c0d0f] hairline-border rounded-xl shadow-sm space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={12} className="text-[#5e6ad2]" /> Project Authority & Lifecycle Pipeline
        </span>
        <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
          isCancelled
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : isCompleted
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : isPendingApproval
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-[#5e6ad2]/20 text-[#5e6ad2] border border-[#5e6ad2]/30'
        }`}>
          {project.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Horizontal Step Sequence */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {stages.map((st, idx) => (
          <div
            key={st.id}
            className={`p-2.5 rounded-lg border transition-all ${
              st.state === 'completed'
                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400'
                : st.state === 'current'
                ? 'bg-indigo-500/10 border-[#5e6ad2] text-white shadow-sm ring-1 ring-[#5e6ad2]/30'
                : st.state === 'rejected'
                ? 'bg-red-500/5 border-red-500/30 text-red-400'
                : 'bg-white/5 border-white/5 text-gray-500'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                st.state === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : st.state === 'current'
                  ? 'bg-[#5e6ad2] text-white'
                  : st.state === 'rejected'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-white/10 text-gray-400'
              }`}>
                {st.state === 'completed' ? '✓' : idx + 1}
              </span>

              {st.timestamp && (
                <span className="text-[9px] font-mono text-gray-500">{st.timestamp}</span>
              )}
            </div>

            <span className={`block font-semibold text-[11px] leading-tight truncate ${
              st.state === 'current' ? 'text-gray-100' : st.state === 'completed' ? 'text-gray-200' : 'text-gray-500'
            }`}>
              {st.label}
            </span>

            <span className={`block text-[10px] mt-0.5 truncate ${
              st.state === 'current' ? 'text-[#5e6ad2] font-medium' : 'text-gray-500'
            }`}>
              {st.subtitle}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
