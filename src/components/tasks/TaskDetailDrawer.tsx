'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  Paperclip,
  MessageSquare,
  Link as LinkIcon,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  Clock,
  Calendar,
  User,
} from 'lucide-react';
import { TaskItem, UserSession } from '@/lib/types';
import { StatusGlyph } from '../ui/StatusGlyph';
import { AvatarChip } from '../ui/AvatarChip';
import { CommentThread } from '../comments/CommentThread';

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  user?: UserSession;
  allProjectTasks?: TaskItem[];
  onTaskUpdated?: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  taskId,
  onClose,
  user,
  allProjectTasks = [],
  onTaskUpdated,
}) => {
  const [task, setTask] = useState<any | null>(null);
  const [deptUsers, setDeptUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [selectedDependencyId, setSelectedDependencyId] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    fetchTaskDetails();
    fetchDeptUsers();
  }, [taskId]);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (data.task) {
        setTask(data.task);
      }
    } catch (err) {
      console.error('Fetch task error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeptUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setDeptUsers(data.users);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  if (!taskId) return null;

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Status change error:', err);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Priority change error:', err);
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: newAssigneeId || '' }),
      });
      if (res.ok) {
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Assignee change error:', err);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !confirm(`Are you sure you want to delete task "${task.title}" (${task.taskNumber})?`)) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onClose();
        if (onTaskUpdated) onTaskUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSubtaskTitle }),
      });
      if (res.ok) {
        setNewSubtaskTitle('');
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Add subtask error:', err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentDone: boolean) => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtaskId, isDone: !currentDone }),
      });
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      console.error('Toggle subtask error:', err);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', task.id);
    formData.append('projectId', task.projectId);

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchTaskDetails();
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddDependency = async () => {
    if (!task || !selectedDependencyId) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependsOnTaskId: selectedDependencyId }),
      });
      if (res.ok) {
        setSelectedDependencyId('');
        fetchTaskDetails();
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Add dependency error:', err);
    }
  };

  const handleRemoveDependency = async (dependencyId: string) => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}/dependencies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      });
      fetchTaskDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      console.error('Remove dependency error:', err);
    }
  };

  // Blocked check
  const isBlocked = task?.blockedBy?.some((dep: any) => dep.dependsOnTask?.status !== 'DONE');
  const canManageTask = user?.role === 'ADMIN' || user?.role === 'HOD' || user?.role === 'TEAM_LEAD' || task?.assigneeId === user?.id;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-[#101114] hairline-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="h-14 px-6 hairline-b flex items-center justify-between bg-[#0c0d0f]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-gray-400 font-semibold">
            {task?.taskNumber || 'Loading...'}
          </span>
          {isBlocked && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded flex items-center gap-1">
              <AlertCircle size={10} />
              Blocked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManageTask && (
            <button
              onClick={handleDeleteTask}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              title="Delete Task"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {isLoading || !task ? (
        <div className="p-8 text-center text-xs text-gray-500">Loading task details...</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Status Bar */}
          <div>
            <h2 className="text-base font-semibold text-gray-100 mb-2">{task.title}</h2>
            {task.description && (
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{task.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c0d0f] hairline-border rounded-lg text-xs">
              <div>
                <span className="text-[11px] text-gray-500 block mb-1">Status</span>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full bg-[#101114] hairline-border text-gray-200 px-2 py-1 rounded text-xs focus:outline-none font-medium"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="SUPPORT_REQUIRED">Support Required</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] text-gray-500 block mb-1">Priority</span>
                <select
                  value={task.priority || 'MEDIUM'}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className="w-full bg-[#101114] hairline-border text-gray-200 px-2 py-1 rounded text-xs focus:outline-none font-semibold"
                >
                  <option value="LOW" className="text-gray-300">⚪ Low Priority</option>
                  <option value="MEDIUM" className="text-blue-400">🔵 Medium Priority</option>
                  <option value="HIGH" className="text-orange-400">🟠 High Priority</option>
                  <option value="URGENT" className="text-red-400 font-bold">🔴 Urgent Priority</option>
                </select>
              </div>

              {/* Editable Assignee Dropdown for Admin, HOD, and Lead */}
              <div>
                <span className="text-[11px] text-gray-500 block mb-1">Assignee (Delegation)</span>
                {canManageTask ? (
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    className="w-full bg-[#101114] hairline-border text-gray-200 px-2 py-1 rounded text-xs focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {deptUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.designation || u.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <AvatarChip
                    name={task.assignee?.name}
                    designation={task.assignee?.designation}
                    showDesignation={true}
                  />
                )}
              </div>

              <div>
                <span className="text-[11px] text-gray-500 block mb-1 flex items-center gap-1">
                  <Calendar size={12} /> Due Date
                </span>
                <span className="text-gray-300 font-medium">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date set'}
                </span>
              </div>
            </div>
          </div>

          {/* Task Dependencies Section */}
          <div className="space-y-3 hairline-t pt-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon size={14} className="text-[#5e6ad2]" />
              Dependencies (Blocked By)
            </h3>

            {task.blockedBy && task.blockedBy.length > 0 ? (
              <div className="space-y-1.5">
                {task.blockedBy.map((dep: any) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-[#0c0d0f] hairline-border rounded text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-gray-400">{dep.dependsOnTask?.taskNumber}</span>
                      <span className="text-gray-200">{dep.dependsOnTask?.title}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusGlyph status={dep.dependsOnTask?.status || 'TODO'} size={12} />
                      <button
                        onClick={() => handleRemoveDependency(dep.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No task blockers added.</p>
            )}

            {/* Add Dependency Picker */}
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedDependencyId}
                onChange={(e) => setSelectedDependencyId(e.target.value)}
                className="flex-1 bg-[#0c0d0f] hairline-border text-xs text-gray-300 px-2 py-1 rounded focus:outline-none"
              >
                <option value="">Select task that blocks this task...</option>
                {allProjectTasks
                  .filter((t) => t.id !== task.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.taskNumber} — {t.title}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddDependency}
                disabled={!selectedDependencyId}
                className="px-3 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/20 disabled:opacity-40"
              >
                Add Blocker
              </button>
            </div>
          </div>

          {/* Subtasks Checklist */}
          <div className="space-y-3 hairline-t pt-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare size={14} className="text-[#5e6ad2]" />
              Checklist Subtasks
            </h3>

            <div className="space-y-1.5">
              {task.subtasks?.map((st: any) => (
                <label
                  key={st.id}
                  className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0c0d0f] hairline-border rounded text-xs cursor-pointer hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={st.isDone}
                    onChange={() => handleToggleSubtask(st.id, st.isDone)}
                    className="rounded border-gray-700 bg-gray-900 text-[#5e6ad2] focus:ring-0"
                  />
                  <span className={st.isDone ? 'line-through text-gray-500' : 'text-gray-200'}>
                    {st.title}
                  </span>
                </label>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add checklist item..."
                className="flex-1 bg-[#0c0d0f] hairline-border text-xs text-gray-200 px-3 py-1.5 rounded focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#5e6ad2] text-white text-xs font-medium rounded hover:bg-[#4e5ac0]"
              >
                Add
              </button>
            </form>
          </div>

          {/* File Attachments */}
          <div className="space-y-3 hairline-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Paperclip size={14} className="text-[#5e6ad2]" />
                File Attachments ({task.attachments?.length || 0})
              </h3>
              <label className="cursor-pointer text-xs text-[#5e6ad2] hover:underline flex items-center gap-1 font-medium">
                <Plus size={12} />
                {isUploading ? 'Uploading...' : 'Upload File'}
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-1.5">
              {task.attachments?.map((att: any) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between px-3 py-2 bg-[#0c0d0f] hairline-border rounded text-xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Paperclip size={12} className="text-gray-400 shrink-0" />
                    <span className="text-gray-200 font-medium truncate">{att.fileName}</span>
                    <span className="text-[10px] text-gray-500">
                      ({Math.round(att.fileSize / 1024)} KB)
                    </span>
                  </span>
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10"
                    title="Download Attachment"
                  >
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Thread */}
          <div className="hairline-t pt-4">
            <CommentThread
              projectId={task.projectId}
              taskId={task.id}
              comments={task.comments || []}
              availableUsers={deptUsers}
              onCommentPosted={() => fetchTaskDetails()}
              title={`Task Discussion (${task.taskNumber})`}
              placeholder="Post a comment or tag team members to communicate changes..."
            />
          </div>
        </div>
      )}
    </div>
  );
};
