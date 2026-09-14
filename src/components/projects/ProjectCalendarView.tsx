'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Flag,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface TaskItem {
  id: string;
  taskNumber: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignee?: { id: string; name: string };
  project?: { id: string; projectNumber: string; title: string };
}

interface MilestoneItem {
  id: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  project?: { id: string; projectNumber: string; title: string };
}

interface ProjectCalendarViewProps {
  projects: any[];
  tasks?: TaskItem[];
  onSelectTask?: (task: TaskItem) => void;
  onSelectProject?: (projectId: string) => void;
}

export const ProjectCalendarView: React.FC<ProjectCalendarViewProps> = ({
  projects,
  tasks = [],
  onSelectTask,
  onSelectProject,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Extract all tasks and milestones from projects
  const allTasks: any[] = [...tasks];
  const allMilestones: any[] = [];

  projects.forEach((p) => {
    if (p.tasks) {
      p.tasks.forEach((t: any) => {
        if (!allTasks.some((existing) => existing.id === t.id)) {
          allTasks.push({ ...t, project: { id: p.id, projectNumber: p.projectNumber, title: p.title } });
        }
      });
    }
    if (p.milestones) {
      p.milestones.forEach((m: any) => {
        allMilestones.push({ ...m, project: { id: p.id, projectNumber: p.projectNumber, title: p.title } });
      });
    }
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const nextD = new Date(currentDate);
      nextD.setDate(nextD.getDate() - 7);
      setCurrentDate(nextD);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const nextD = new Date(currentDate);
      nextD.setDate(nextD.getDate() + 7);
      setCurrentDate(nextD);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid generation
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const totalDays = lastDayOfMonth.getDate();

  // Days array for Month view
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Prev month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill complete weeks (up to multiple of 7)
  const remainingDays = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getItemsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];

    const dayTasks = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const tDue = new Date(t.dueDate).toISOString().split('T')[0];
      return tDue === dateStr;
    });

    const dayMilestones = allMilestones.filter((m) => {
      if (!m.dueDate) return false;
      const mDue = new Date(m.dueDate).toISOString().split('T')[0];
      return mDue === dateStr;
    });

    return { tasks: dayTasks, milestones: dayMilestones };
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-[#101114] hairline-border rounded-xl shadow-sm p-6 space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hairline-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2] flex items-center justify-center shadow-sm">
            <CalendarIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-gray-400">
              Schedule & due dates across all active projects and checkpoints
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors hairline-border"
          >
            Today
          </button>

          <div className="flex items-center hairline-border rounded-lg bg-[#0c0d0f]">
            <button
              onClick={handlePrev}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 text-gray-400 hover:text-white transition-colors border-l border-white/5"
              title="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Month Days Grid */}
      <div className="space-y-1">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[11px] text-gray-400 select-none pb-1">
          {weekDayNames.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 gap-1 bg-[#0c0d0f] p-1 rounded-xl hairline-border">
          {calendarDays.map((item, idx) => {
            const { tasks: dayTasks, milestones: dayMilestones } = getItemsForDay(item.date);
            const isCurrent = item.isCurrentMonth;
            const today = isToday(item.date);

            return (
              <div
                key={idx}
                className={`min-h-[110px] p-2 rounded-lg flex flex-col justify-between transition-colors ${
                  isCurrent ? 'bg-[#101114]' : 'bg-[#0e0f12]/50 opacity-40'
                } ${today ? 'ring-1 ring-[#5e6ad2] bg-[#5e6ad2]/5' : ''}`}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold font-mono ${
                      today
                        ? 'w-6 h-6 rounded-full bg-[#5e6ad2] text-white flex items-center justify-center text-[11px]'
                        : isCurrent
                        ? 'text-gray-200'
                        : 'text-gray-600'
                    }`}
                  >
                    {item.date.getDate()}
                  </span>

                  {(dayTasks.length > 0 || dayMilestones.length > 0) && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      {dayTasks.length + dayMilestones.length} due
                    </span>
                  )}
                </div>

                {/* Items Stack */}
                <div className="space-y-1 my-1 overflow-y-auto max-h-[75px] pr-0.5">
                  {/* Milestones */}
                  {dayMilestones.map((m) => (
                    <div
                      key={m.id}
                      title={`Milestone: ${m.title} (${m.project?.projectNumber})`}
                      onClick={() => onSelectProject && m.project && onSelectProject(m.project.id)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded flex items-center gap-1 cursor-pointer hover:bg-indigo-500/25 truncate"
                    >
                      <Flag size={10} className="shrink-0 text-indigo-400" />
                      <span className="truncate">{m.title}</span>
                    </div>
                  ))}

                  {/* Tasks */}
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      title={`Task: ${t.title} (${t.status})`}
                      onClick={() => onSelectTask && onSelectTask(t)}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 cursor-pointer truncate ${
                        t.status === 'DONE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t.status === 'DONE' ? (
                        <CheckCircle2 size={10} className="shrink-0 text-emerald-400" />
                      ) : (
                        <Clock size={10} className="shrink-0 text-amber-400" />
                      )}
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>

                <div />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
