'use client';

import React, { useState } from 'react';
import { Flag, Plus, CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';

interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  dueDate: string;
  isCompleted: boolean;
}

interface MilestonesPanelProps {
  projectId: string;
  milestones: Milestone[];
  canManage: boolean;
  onRefresh?: () => void;
  onMilestonesChange?: () => void;
}

export const MilestonesPanel: React.FC<MilestonesPanelProps> = ({
  projectId,
  milestones,
  canManage,
  onRefresh,
  onMilestonesChange,
}) => {
  const triggerRefresh = () => {
    if (onRefresh) onRefresh();
    if (onMilestonesChange) onMilestonesChange();
  };
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completedCount = milestones.filter((m) => m.isCompleted).length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, dueDate }),
      });

      if (res.ok) {
        setTitle('');
        setDescription('');
        setDueDate('');
        setIsAdding(false);
        triggerRefresh();
      }
    } catch (err) {
      console.error('Create milestone error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (m: Milestone) => {
    if (!canManage) return;
    try {
      await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: m.id, isCompleted: !m.isCompleted }),
      });
      triggerRefresh();
    } catch (err) {
      console.error('Toggle milestone error:', err);
    }
  };

  const handleDelete = async (milestoneId: string) => {
    if (!canManage) return;
    try {
      await fetch(`/api/projects/${projectId}/milestones?milestoneId=${milestoneId}`, {
        method: 'DELETE',
      });
      triggerRefresh();
    } catch (err) {
      console.error('Delete milestone error:', err);
    }
  };

  return (
    <div className="bg-[#101114] hairline-border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Flag size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Project Milestones</h3>
            <p className="text-[11px] text-gray-400">
              {completedCount} of {milestones.length} key checkpoint goals reached ({progressPercent}%)
            </p>
          </div>
        </div>

        {canManage && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-2.5 py-1 text-xs font-medium text-[#5e6ad2] bg-[#5e6ad2]/10 hover:bg-[#5e6ad2]/20 border border-[#5e6ad2]/20 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} /> Add Milestone
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#0c0d0f] rounded-full h-1.5 overflow-hidden hairline-border">
        <div
          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Add Milestone Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="p-3 bg-[#0c0d0f] hairline-border rounded-lg space-y-2.5 text-xs animate-in fade-in duration-150">
          <div>
            <label className="text-gray-300 block mb-1">Milestone Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. M2: User Acceptance Testing Sign-off"
              className="w-full bg-[#101114] hairline-border text-gray-100 px-3 py-1.5 rounded focus:outline-none focus:border-[#5e6ad2]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-300 block mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#101114] hairline-border text-gray-100 px-3 py-1.5 rounded focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
            <div>
              <label className="text-gray-300 block mb-1">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope note..."
                className="w-full bg-[#101114] hairline-border text-gray-100 px-3 py-1.5 rounded focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 bg-white/5 text-gray-400 hover:text-white rounded font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1 bg-[#5e6ad2] text-white rounded font-medium text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Milestone'}
            </button>
          </div>
        </form>
      )}

      {/* Milestones List */}
      <div className="space-y-2">
        {milestones.length === 0 ? (
          <p className="text-xs text-gray-500 py-3 text-center italic">No milestones defined for this project.</p>
        ) : (
          milestones.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg flex items-center justify-between text-xs transition-colors ${
                m.isCompleted ? 'bg-emerald-500/5 hairline-border border-emerald-500/20' : 'bg-[#0c0d0f] hairline-border'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handleToggle(m)}
                  disabled={!canManage}
                  className={`transition-colors ${canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                >
                  {m.isCompleted ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Circle size={16} className="text-gray-500 shrink-0" />
                  )}
                </button>
                <div>
                  <h4 className={`font-medium ${m.isCompleted ? 'line-through text-gray-400' : 'text-gray-100'}`}>
                    {m.title}
                  </h4>
                  {m.description && <p className="text-[11px] text-gray-400 mt-0.5">{m.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                  <Calendar size={12} className="text-indigo-400" />
                  <span>{new Date(m.dueDate).toLocaleDateString()}</span>
                </div>

                {canManage && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    title="Delete milestone"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
