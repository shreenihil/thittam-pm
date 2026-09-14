'use client';

import React from 'react';
import {
  HelpCircle,
  Users2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export interface RequestFlowStepperProps {
  request: {
    id: string;
    kind: 'PEOPLE_HELP' | 'ISSUE_ESCALATION';
    status: string;
    urgency?: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    requestedBy?: { name: string; designation?: string; role?: string };
    targetDepartment?: { name: string };
    targetUser?: { name: string; designation?: string; role?: string };
    assignedUser?: { name: string; designation?: string; role?: string };
    teamLeadNote?: string;
    hodNote?: string;
    resolutionNote?: string;
    isDirectToAdmin?: boolean;
  };
  compact?: boolean;
}

export const RequestFlowStepper: React.FC<RequestFlowStepperProps> = ({ request, compact = false }) => {
  let currentStageIndex = 1;
  const isRejected = request.status?.includes('REJECTED') || request.status === 'DECLINED';
  const isResolved = request.status === 'RESOLVED' || request.status === 'ACCEPTED' || request.status === 'COMPLETED';
  const isEscalatedAdmin = request.status === 'ESCALATED_ADMIN' || request.isDirectToAdmin;
  const isAssigned = Boolean(request.assignedUser || request.targetUser);

  if (isResolved || isRejected) {
    currentStageIndex = 5;
  } else if (isEscalatedAdmin || (isAssigned && request.status?.includes('ASSIGNED'))) {
    currentStageIndex = 4;
  } else if (request.status === 'PENDING_HOD_REVIEW' || request.status === 'AWAITING_HOD') {
    currentStageIndex = 3;
  } else if (request.status === 'PENDING_TEAM_LEAD_REVIEW' || request.status === 'AWAITING_TEAM_LEAD') {
    currentStageIndex = 2;
  } else {
    currentStageIndex = 1;
  }

  const stages = [
    {
      label: '1. Request Raised',
      subtext: request.requestedBy?.name || 'Requester',
      icon: HelpCircle,
      stageIndex: 1,
    },
    {
      label: '2. Team Lead Triage',
      subtext: request.teamLeadNote ? 'Endorsed' : 'Level 1 Review',
      icon: Users2,
      stageIndex: 2,
    },
    {
      label: '3. HOD Decision',
      subtext: request.targetDepartment?.name ? `${request.targetDepartment.name} HOD` : 'Department Head',
      icon: UserCheck,
      stageIndex: 3,
    },
    {
      label: isEscalatedAdmin ? '4. Admin Escalation' : '4. Assigned Specialist',
      subtext: isEscalatedAdmin
        ? 'Executive Action'
        : request.assignedUser?.name || request.targetUser?.name || 'Assigned Member',
      icon: isEscalatedAdmin ? ShieldAlert : UserCheck,
      stageIndex: 4,
    },
    {
      label: isRejected ? '5. Closed / Rejected' : '5. Resolved',
      subtext: isRejected ? 'Declined' : isResolved ? 'Completed' : 'Pending Outcome',
      icon: isRejected ? XCircle : CheckCircle2,
      stageIndex: 5,
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-[11px] text-gray-400 overflow-x-auto py-1">
        {stages.map((stg, i) => {
          const isPassed = currentStageIndex > stg.stageIndex || (currentStageIndex === 5 && !isRejected);
          const isCurrent = currentStageIndex === stg.stageIndex;
          const Icon = stg.icon;

          return (
            <React.Fragment key={i}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                  isRejected && isCurrent
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : isCurrent
                    ? 'bg-[#5e6ad2]/20 text-[#a5affb] border border-[#5e6ad2]/40 font-semibold'
                    : isPassed
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-white/5 text-gray-500'
                }`}
              >
                <Icon size={10} />
                <span>{stg.label.split('. ')[1]}</span>
              </div>
              {i < stages.length - 1 && <ArrowRight size={10} className="text-gray-600 flex-shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0b0d] hairline-border rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={12} className="text-[#5e6ad2]" /> Request Authority & Flow Pipeline
        </span>
        <span className="text-[10px] font-mono text-gray-400">
          Created: {new Date(request.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
        {stages.map((stg) => {
          const isPassed = currentStageIndex > stg.stageIndex || (currentStageIndex === 5 && !isRejected);
          const isCurrent = currentStageIndex === stg.stageIndex;
          const Icon = stg.icon;

          let badgeColor = 'border-white/5 bg-[#121316] text-gray-500';
          let iconColor = 'text-gray-500';

          if (isRejected && isCurrent) {
            badgeColor = 'border-red-500/30 bg-red-500/10 text-red-300 ring-1 ring-red-500/20';
            iconColor = 'text-red-400';
          } else if (isCurrent) {
            badgeColor = 'border-[#5e6ad2]/40 bg-[#5e6ad2]/10 text-indigo-200 ring-1 ring-[#5e6ad2]/30';
            iconColor = 'text-[#5e6ad2]';
          } else if (isPassed) {
            badgeColor = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
            iconColor = 'text-emerald-400';
          }

          return (
            <div
              key={stg.stageIndex}
              className={`p-2 rounded-lg border text-left transition-all ${badgeColor}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className={iconColor} />
                <span className="text-[10px] font-bold tracking-tight block truncate">{stg.label}</span>
              </div>
              <p className="text-[10px] opacity-80 truncate">{stg.subtext}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
