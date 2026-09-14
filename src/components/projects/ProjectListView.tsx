'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AvatarChip } from '../ui/AvatarChip';
import { TagBadge } from '../ui/TagBadge';
import {
  Calendar,
  ArrowUpDown,
  CheckSquare,
  Square,
  Layers,
  CheckCircle2,
  Trash2,
  X,
  AlertTriangle,
  Flag,
} from 'lucide-react';

interface ProjectListViewProps {
  projects: any[];
  user?: any;
  onProjectStatusChange: (id: string, newStatus: string) => void;
  onDeleteProject?: (id: string) => void;
  onRefresh?: () => void;
}

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  user,
  onProjectStatusChange,
  onDeleteProject,
  onRefresh,
}) => {
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterTag, setFilterTag] = useState('ALL');
  const [sortField, setSortField] = useState<'projectNumber' | 'dueDate' | 'title' | 'priority'>('projectNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select bulk state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Delete Confirmation Modal State
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Collect all unique labels across projects
  const allLabelsMap = new Map<string, any>();
  projects.forEach((p) => {
    if (p.labels) {
      p.labels.forEach((l: any) => {
        const lbl = l.label || l;
        if (lbl.id && !allLabelsMap.has(lbl.id)) {
          allLabelsMap.set(lbl.id, lbl);
        }
      });
    }
  });
  const allLabels = Array.from(allLabelsMap.values());

  const filteredProjects = projects.filter((p) => {
    if (filterDept !== 'ALL' && p.departmentId !== filterDept) return false;
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && (p.priority || 'MEDIUM') !== filterPriority) return false;
    if (filterTag !== 'ALL') {
      const pLabelIds = (p.labels || []).map((l: any) => (l.label ? l.label.id : l.id));
      if (!pLabelIds.includes(filterTag)) return false;
    }
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortField === 'priority') {
      const scoreA = PRIORITY_ORDER[a.priority || 'MEDIUM'] || 0;
      const scoreB = PRIORITY_ORDER[b.priority || 'MEDIUM'] || 0;
      return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    }

    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (sortField === 'dueDate') {
      valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: 'projectNumber' | 'dueDate' | 'title' | 'priority') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sortedProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedProjects.map((p) => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyBulkStatus = async (statusOverride?: string) => {
    const targetStatus = statusOverride || bulkStatus;
    if (selectedIds.length === 0 || !targetStatus) return;

    setIsSubmittingBulk(true);
    try {
      const res = await fetch('/api/projects/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: selectedIds,
          action: 'STATUS_CHANGE',
          value: targetStatus,
        }),
      });

      if (res.ok) {
        setSelectedIds([]);
        setBulkStatus('');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Bulk update error:', err);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!projectToDelete || !onDeleteProject) return;
    onDeleteProject(projectToDelete.id);
    setProjectToDelete(null);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmittingBulk(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      }
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const canBulkManage = user?.role === 'ADMIN' || user?.role === 'HOD';

  const renderPriorityBadge = (priority: string = 'MEDIUM') => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            Urgent
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            High
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Low
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Medium
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#101114] p-3 hairline-border rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-gray-400 font-medium">Filters:</span>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#0c0d0f] hairline-border text-gray-200 px-2.5 py-1 rounded focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="SUPPORT_REQUIRED">Support Required</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-[#0c0d0f] hairline-border text-gray-200 px-2.5 py-1 rounded focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">🔴 Urgent Priority</option>
            <option value="HIGH">🟠 High Priority</option>
            <option value="MEDIUM">🔵 Medium Priority</option>
            <option value="LOW">⚪ Low Priority</option>
          </select>

          {allLabels.length > 0 && (
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="bg-[#0c0d0f] hairline-border text-gray-200 px-2.5 py-1 rounded focus:outline-none"
            >
              <option value="ALL">All Tags / Labels</option>
              {allLabels.map((lbl) => (
                <option key={lbl.id} value={lbl.id}>
                  🏷️ {lbl.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {canBulkManage && selectedIds.length > 0 && (
          <span className="text-xs text-indigo-400 font-semibold font-mono">
            {selectedIds.length} projects selected
          </span>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {canBulkManage && selectedIds.length > 0 && (
        <div className="bg-[#181a20] hairline-border border-[#5e6ad2]/40 rounded-xl p-3 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
          <div className="flex items-center gap-2 text-gray-200 font-medium">
            <Layers size={16} className="text-[#5e6ad2]" />
            <span>Bulk Actions for <strong>{selectedIds.length}</strong> Projects</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApplyBulkStatus('COMPLETED')}
              disabled={isSubmittingBulk}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
              title="Mark all selected projects as Over / Completed"
            >
              <CheckCircle2 size={13} />
              Mark Over
            </button>

            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={isSubmittingBulk}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
              title="Delete selected projects"
            >
              <Trash2 size={13} />
              Delete Selected
            </button>

            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="bg-[#0c0d0f] hairline-border text-gray-200 px-3 py-1.5 rounded focus:outline-none"
            >
              <option value="">Other Statuses...</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="SUPPORT_REQUIRED">Support Required</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {bulkStatus && (
              <button
                onClick={() => handleApplyBulkStatus()}
                disabled={isSubmittingBulk}
                className="px-3 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-gray-400 hover:text-white rounded"
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Dense Hairline Data Table */}
      <div className="overflow-x-auto bg-[#101114] hairline-border rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0c0d0f] text-gray-400 hairline-b font-medium select-none">
              {canBulkManage && (
                <th className="py-3 px-3 w-8">
                  <button
                    onClick={handleSelectAll}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {selectedIds.length === sortedProjects.length && sortedProjects.length > 0 ? (
                      <CheckSquare size={14} className="text-[#5e6ad2]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
              )}
              <th
                onClick={() => toggleSort('projectNumber')}
                className="py-3 px-4 cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">
                  Project Number <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                onClick={() => toggleSort('title')}
                className="py-3 px-4 cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">
                  Title & Tags <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                onClick={() => toggleSort('priority')}
                className="py-3 px-4 cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">
                  Priority <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Project Lead</th>
              <th className="py-3 px-4">Status</th>
              <th
                onClick={() => toggleSort('dueDate')}
                className="py-3 px-4 cursor-pointer hover:text-white"
              >
                <span className="flex items-center gap-1">
                  Due Date <ArrowUpDown size={12} />
                </span>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedProjects.map((p) => {
              const leadMember = p.members?.find((m: any) => m.isLead);
              const isOverdue = p.dueDate && new Date(p.dueDate) < new Date() && p.status !== 'COMPLETED';
              const isSelected = selectedIds.includes(p.id);
              const pLabels = (p.labels || []).map((l: any) => l.label || l);
              const isHodOrAdmin = user?.role === 'ADMIN' || (user?.role === 'HOD' && user?.departmentId === p.departmentId);

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-white/[0.02] transition-colors group ${
                    isSelected ? 'bg-[#5e6ad2]/5' : ''
                  }`}
                >
                  {canBulkManage && (
                    <td className="py-3 px-3 w-8">
                      <button
                        onClick={() => handleToggleSelect(p.id)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={14} className="text-[#5e6ad2]" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="py-3 px-4 font-mono font-semibold text-[#5e6ad2]">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.projectNumber}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-gray-100 hover:text-[#5e6ad2] block"
                      >
                        {p.title}
                      </Link>
                      {pLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {pLabels.map((lbl: any) => (
                            <TagBadge key={lbl.id} label={lbl} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {renderPriorityBadge(p.priority)}
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-gray-300">
                      {p.department?.name}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <AvatarChip
                      name={leadMember?.user?.name || p.pointOfContact?.name}
                      designation={leadMember?.user?.designation || p.pointOfContact?.designation}
                      isLead={true}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={p.status}
                      onChange={(e) => onProjectStatusChange(p.id, e.target.value)}
                      className="bg-transparent text-xs font-medium cursor-pointer focus:outline-none"
                    >
                      <option value="IN_PROGRESS" className="bg-[#101114] text-amber-400">
                        In Progress
                      </option>
                      <option value="PENDING_APPROVAL" className="bg-[#101114] text-gray-300">
                        Pending Approval
                      </option>
                      <option value="SUPPORT_REQUIRED" className="bg-[#101114] text-orange-400">
                        Support Required
                      </option>
                      <option value="ON_HOLD" className="bg-[#101114] text-blue-400">
                        On Hold
                      </option>
                      <option value="COMPLETED" className="bg-[#101114] text-emerald-400">
                        Completed (Over)
                      </option>
                      <option value="CANCELLED" className="bg-[#101114] text-red-400">
                        Cancelled
                      </option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    {p.dueDate ? (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isOverdue ? 'text-red-400 font-semibold' : ''
                        }`}
                      >
                        <Calendar size={12} />
                        {new Date(p.dueDate).toLocaleDateString()}
                        {isOverdue && (
                          <span className="px-1 py-0.2 text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 rounded uppercase font-bold ml-1">
                            Overdue
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isHodOrAdmin && p.status !== 'COMPLETED' && (
                        <button
                          onClick={() => onProjectStatusChange(p.id, 'COMPLETED')}
                          className="px-2 py-1 text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-colors flex items-center gap-1"
                          title="Mark project as Over / Completed"
                        >
                          <CheckCircle2 size={12} />
                          Over
                        </button>
                      )}

                      {isHodOrAdmin && onDeleteProject && (
                        <button
                          onClick={() => setProjectToDelete(p)}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete project"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      <Link
                        href={`/projects/${p.id}`}
                        className="px-2.5 py-1 text-xs bg-white/5 hover:bg-[#5e6ad2] text-gray-200 hover:text-white rounded transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Project Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#101114] border border-red-500/30 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle size={18} /> Delete Project Permanently
              </h2>
              <button
                onClick={() => setProjectToDelete(null)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong className="text-white">
                  {projectToDelete.projectNumber} — {projectToDelete.title}
                </strong>
                ?
              </p>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300">
                ⚠️ This action will permanently remove this project and all of its tasks, checklist subtasks, milestones, timeline entries, attachments, and comments. This cannot be undone.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-md"
              >
                <Trash2 size={13} /> Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#101114] border border-red-500/30 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle size={18} /> Bulk Delete Projects
              </h2>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <p>
                Are you sure you want to delete all <strong className="text-white">{selectedIds.length}</strong> selected projects?
              </p>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300">
                ⚠️ All associated tasks, milestones, comments, and attachments for these {selectedIds.length} projects will be permanently removed.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBulk}
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 shadow-md"
              >
                <Trash2 size={13} /> {isSubmittingBulk ? 'Deleting...' : 'Delete All Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
