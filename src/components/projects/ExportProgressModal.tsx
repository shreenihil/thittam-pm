'use client';

import React from 'react';
import { Download, Printer, X, FileText, CheckCircle2, Calendar, User } from 'lucide-react';

interface ExportProgressModalProps {
  isOpen?: boolean;
  project: any;
  onClose: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({ isOpen = true, project, onClose }) => {
  if (!isOpen) return null;

  const totalTasks = project.tasks?.length || project.totalTasks || 0;
  const doneTasks = project.tasks
    ? project.tasks.filter((t: any) => t.status === 'DONE').length
    : project.doneTasks || 0;
  const completionPercentage =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleExportCSV = () => {
    const rows = [
      ['Thittam PM — Project Progress Report'],
      ['Generated At', new Date().toLocaleString()],
      ['Project Number', project.projectNumber],
      ['Project Title', project.title],
      ['Department', project.department?.name || 'N/A'],
      ['Status', project.status],
      ['Completion Rate', `${completionPercentage}%`],
      ['Due Date', project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'],
      [],
      ['--- TASKS BREAKDOWN ---'],
      ['Task Number', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date'],
    ];

    if (project.tasks && Array.isArray(project.tasks)) {
      project.tasks.forEach((t: any) => {
        rows.push([
          t.taskNumber,
          `"${t.title.replace(/"/g, '""')}"`,
          t.status,
          t.priority,
          t.assignee?.name || 'Unassigned',
          t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A',
        ]);
      });
    }

    rows.push([]);
    rows.push(['--- MILESTONES ---']);
    rows.push(['Milestone', 'Due Date', 'Status']);

    if (project.milestones && Array.isArray(project.milestones)) {
      project.milestones.forEach((m: any) => {
        rows.push([
          `"${m.title.replace(/"/g, '""')}"`,
          m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'N/A',
          m.isCompleted ? 'COMPLETED' : 'PENDING',
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${project.projectNumber}_Progress_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#101114] hairline-border rounded-2xl shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between hairline-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 text-[#5e6ad2] flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">Export Project Progress</h2>
              <p className="text-xs text-gray-400">
                Generate executive summary progress digest and CSV export
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Executive Progress Card */}
        <div className="p-5 bg-[#0c0d0f] hairline-border rounded-xl space-y-4 text-xs">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[11px] text-[#5e6ad2] font-semibold">
                {project.projectNumber}
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{project.title}</h3>
              <p className="text-gray-400 mt-1">{project.description}</p>
            </div>

            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {project.status}
            </span>
          </div>

          {/* Metric Gauges */}
          <div className="grid grid-cols-3 gap-3 pt-3 hairline-t">
            <div className="p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 block text-[11px]">Completion Gauge</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {completionPercentage}%
              </span>
              <span className="text-[10px] text-gray-500">
                {doneTasks} of {totalTasks} tasks done
              </span>
            </div>

            <div className="p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 block text-[11px]">Target Due Date</span>
              <span className="text-xs font-semibold text-gray-200 mt-1 block">
                {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'No Target Set'}
              </span>
              <span className="text-[10px] text-gray-500">Scheduled deliverable</span>
            </div>

            <div className="p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 block text-[11px]">Department / Team</span>
              <span className="text-xs font-semibold text-gray-200 mt-1 block truncate">
                {project.department?.name || 'General'}
              </span>
              <span className="text-[10px] text-gray-500 truncate">
                {project.team?.name || 'Core Operations'}
              </span>
            </div>
          </div>

          {/* Key Milestones Digest */}
          {project.milestones && project.milestones.length > 0 && (
            <div className="space-y-2 pt-2 hairline-t">
              <h4 className="font-semibold text-gray-300 text-xs">Checkpoint Milestones</h4>
              <div className="space-y-1.5">
                {project.milestones.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 bg-[#101114] rounded hairline-border text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        size={13}
                        className={m.isCompleted ? 'text-emerald-400' : 'text-gray-600'}
                      />
                      <span className={m.isCompleted ? 'line-through text-gray-400' : 'text-gray-200 font-medium'}>
                        {m.title}
                      </span>
                    </div>
                    <span className="text-gray-500 font-mono">
                      {new Date(m.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 hairline-border"
          >
            <Printer size={14} /> Print Progress Report
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-lg"
          >
            <Download size={14} /> Download CSV Data
          </button>
        </div>
      </div>
    </div>
  );
};
