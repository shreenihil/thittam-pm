'use client';

import React from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';

interface PortfolioGanttViewProps {
  projects: any[];
}

export const PortfolioGanttView: React.FC<PortfolioGanttViewProps> = ({ projects }) => {
  // Generate timeline months range (e.g. Aug 2026 - Nov 2026)
  const startDate = new Date('2026-08-01');
  const endDate = new Date('2026-11-30');
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

  const months = ['Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'];

  return (
    <div className="bg-[#101114] hairline-border rounded-xl p-4 overflow-x-auto shadow-sm">
      <div className="min-w-[850px]">
        {/* Gantt Header Months */}
        <div className="flex border-b border-white/10 pb-2 mb-4 text-xs font-semibold text-gray-400">
          <div className="w-64 shrink-0 px-2">Project & Deliverable</div>
          <div className="flex-1 grid grid-cols-4 text-center">
            {months.map((m) => (
              <div key={m} className="border-l border-white/5">
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Gantt Rows */}
        <div className="space-y-3">
          {projects.map((p) => {
            const pStart = p.assignedDate ? new Date(p.assignedDate) : new Date(p.createdAt);
            const pDue = p.dueDate ? new Date(p.dueDate) : new Date(pStart.getTime() + 14 * 86400000);

            const startOffsetDays = Math.max(
              0,
              Math.ceil((pStart.getTime() - startDate.getTime()) / (1000 * 3600 * 24))
            );
            const durationDays = Math.max(
              5,
              Math.ceil((pDue.getTime() - pStart.getTime()) / (1000 * 3600 * 24))
            );

            const leftPercent = (startOffsetDays / totalDays) * 100;
            const widthPercent = Math.min((durationDays / totalDays) * 100, 100 - leftPercent);

            let barColor = 'bg-gray-600';
            if (p.status === 'IN_PROGRESS') barColor = 'bg-amber-500';
            if (p.status === 'COMPLETED') barColor = 'bg-emerald-500';
            if (p.status === 'SUPPORT_REQUIRED') barColor = 'bg-orange-500';
            if (p.status === 'ON_HOLD') barColor = 'bg-blue-500';

            return (
              <div key={p.id} className="flex items-center text-xs py-1.5 hover:bg-white/[0.02] rounded">
                <div className="w-64 shrink-0 px-2 truncate pr-4">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium text-gray-200 hover:text-[#5e6ad2] flex items-center gap-2"
                  >
                    <span className="font-mono text-[11px] text-[#5e6ad2] font-semibold">{p.projectNumber}</span>
                    <span className="truncate">{p.title}</span>
                  </Link>
                </div>

                <div className="flex-1 relative h-7 bg-[#0c0d0f] rounded-md hairline-border flex items-center px-1">
                  {/* Progress Project Bar */}
                  <div
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    className={`absolute h-4 rounded ${barColor} shadow-md opacity-85 hover:opacity-100 transition-opacity flex items-center px-2 text-[10px] font-semibold text-white truncate z-10`}
                    title={`${p.title} (${new Date(pStart).toLocaleDateString()} - ${new Date(pDue).toLocaleDateString()})`}
                  >
                    {p.projectNumber}
                  </div>

                  {/* Diamond Milestone Markers */}
                  {p.milestones &&
                    p.milestones.map((m: any) => {
                      const mDate = new Date(m.dueDate);
                      const mOffsetDays = Math.max(
                        0,
                        Math.ceil((mDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))
                      );
                      const mLeftPercent = Math.min(Math.max((mOffsetDays / totalDays) * 100, 1), 99);

                      return (
                        <div
                          key={m.id}
                          style={{ left: `${mLeftPercent}%` }}
                          className={`absolute -top-1 w-3.5 h-3.5 rotate-45 transform -translate-x-1/2 rounded-[2px] border cursor-pointer z-20 shadow-md ${
                            m.isCompleted
                              ? 'bg-emerald-400 border-emerald-300'
                              : 'bg-indigo-500 border-indigo-300 animate-pulse'
                          }`}
                          title={`Milestone: ${m.title} (${new Date(m.dueDate).toLocaleDateString()}) — ${
                            m.isCompleted ? 'Completed' : 'Pending'
                          }`}
                        />
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
