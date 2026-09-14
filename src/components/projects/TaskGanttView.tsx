'use client';

import React from 'react';
import { TaskItem } from '@/lib/types';
import { StatusGlyph } from '../ui/StatusGlyph';
import { AvatarChip } from '../ui/AvatarChip';
import { AlertCircle } from 'lucide-react';

interface TaskGanttViewProps {
  tasks: TaskItem[];
  onSelectTask: (taskId: string) => void;
}

export const TaskGanttView: React.FC<TaskGanttViewProps> = ({ tasks, onSelectTask }) => {
  const startDate = new Date('2026-09-01');
  const endDate = new Date('2026-09-30');
  const totalDays = 30;

  return (
    <div className="bg-[#101114] hairline-border rounded-xl p-4 overflow-x-auto shadow-sm">
      <div className="min-w-[800px] relative">
        {/* Timeline Header */}
        <div className="flex border-b border-white/10 pb-2 mb-4 text-xs font-semibold text-gray-400">
          <div className="w-72 shrink-0 px-2">Task Title & Assignee</div>
          <div className="flex-1 grid grid-cols-6 text-center border-l border-white/5">
            <div>Sep 01 - 05</div>
            <div>Sep 06 - 10</div>
            <div>Sep 11 - 15</div>
            <div>Sep 16 - 20</div>
            <div>Sep 21 - 25</div>
            <div>Sep 26 - 30</div>
          </div>
        </div>

        {/* Task Rows */}
        <div className="space-y-4">
          {tasks.map((t) => {
            const tStart = t.startDate ? new Date(t.startDate) : new Date('2026-09-02');
            const tDue = t.dueDate ? new Date(t.dueDate) : new Date('2026-09-15');

            const startDay = Math.max(0, Math.ceil((tStart.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
            const durationDays = Math.max(3, Math.ceil((tDue.getTime() - tStart.getTime()) / (1000 * 3600 * 24)));

            const leftPercent = (startDay / totalDays) * 100;
            const widthPercent = Math.min((durationDays / totalDays) * 100, 100 - leftPercent);

            const isBlocked = t.blockedBy?.some((dep) => dep.dependsOnTask?.status !== 'DONE');

            let barColor = 'bg-[#5e6ad2]';
            if (t.status === 'DONE') barColor = 'bg-emerald-500';
            if (isBlocked) barColor = 'bg-red-500/80';

            return (
              <div
                key={t.id}
                onClick={() => onSelectTask(t.id)}
                className="flex items-center text-xs py-1.5 hover:bg-white/[0.02] rounded cursor-pointer group"
              >
                <div className="w-72 shrink-0 px-2 pr-4 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="font-mono text-[11px] text-[#5e6ad2] font-semibold mr-1.5">
                      {t.taskNumber}
                    </span>
                    <span className="font-medium text-gray-200 group-hover:text-white">{t.title}</span>
                  </div>
                  {isBlocked && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-1">
                      <AlertCircle size={10} /> Blocked
                    </span>
                  )}
                </div>

                <div className="flex-1 relative h-7 bg-[#0c0d0f] rounded-md hairline-border flex items-center px-1">
                  <div
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    className={`absolute h-5 rounded ${barColor} shadow-md flex items-center justify-between px-2 text-[10px] font-semibold text-white truncate`}
                  >
                    <span className="truncate">{t.taskNumber}</span>
                    <span className="text-[9px] opacity-80">{t.assignee?.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
