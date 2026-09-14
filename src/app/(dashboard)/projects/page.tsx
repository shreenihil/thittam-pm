'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ProjectListView } from '@/components/projects/ProjectListView';
import { ProjectKanbanView } from '@/components/projects/ProjectKanbanView';
import { PortfolioGanttView } from '@/components/projects/PortfolioGanttView';
import { ProjectCalendarView } from '@/components/projects/ProjectCalendarView';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useSocket } from '@/components/providers/SocketProvider';
import { List, LayoutGrid, BarChart2, Calendar as CalendarIcon, X, AlertCircle, ShieldAlert } from 'lucide-react';

export default function ProjectsPage() {
  const [view, setView] = useState('list');
  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Project Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [directLeadUserId, setDirectLeadUserId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchProjects(true);
    fetchCurrentUser();
    fetchDepartmentsAndUsers();
  }, []);

  // Real-time socket event subscription for live board & list synchronization
  useEffect(() => {
    const unsubUpdated = subscribe('project:updated', () => {
      fetchProjects(false);
    });
    const unsubCreated = subscribe('project:created', () => {
      fetchProjects(false);
    });
    const unsubDeleted = subscribe('project:deleted', () => {
      fetchProjects(false);
    });
    const unsubBulk = subscribe('project:bulk_updated', () => {
      fetchProjects(false);
    });
    const unsubResync = subscribe('resync', () => {
      fetchProjects(false);
    });

    return () => {
      unsubUpdated();
      unsubCreated();
      unsubDeleted();
      unsubBulk();
      unsubResync();
    };
  }, [subscribe]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) setCurrentUser(data.user);
    } catch (err) {
      console.error('Fetch me error:', err);
    }
  };

  const fetchDepartmentsAndUsers = async () => {
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/users'),
      ]);
      const deptData = await deptRes.json();
      const userData = await userRes.json();
      if (deptData.departments) setDepartments(deptData.departments);
      if (userData.users) setUsersList(userData.users);
    } catch (err) {
      console.error('Fetch departments/users error:', err);
    }
  };

  const fetchProjects = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic UI update
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        fetchProjects(false);
      }
    } catch (err) {
      console.error('Status change error:', err);
      fetchProjects(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete project');
        fetchProjects(false);
      }
    } catch (err) {
      console.error('Delete project error:', err);
      fetchProjects(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Project Title is required');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Project Description is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          dueDate: dueDate || null,
          departmentId: selectedDeptId || currentUser?.departmentId || null,
          leadUserId: directLeadUserId || null,
          memberUserIds: selectedMemberIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit project ticket');
        return;
      }

      // Success
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
      setSelectedDeptId('');
      setDirectLeadUserId('');
      setSelectedMemberIds([]);
      setIsModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      setErrorMessage('An unexpected error occurred while creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdminOrHod = currentUser?.role === 'ADMIN' || currentUser?.role === 'HOD';
  const isViewer = currentUser?.role === 'VIEWER';

  const relevantUsers = usersList.filter(
    (u) =>
      currentUser?.role === 'ADMIN' ||
      u.departmentId === (selectedDeptId || currentUser?.departmentId)
  );

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Projects Workspace"
        subtitle="Manage and track department projects across List, Kanban, Gantt, and Calendar views"
        onPrimaryAction={
          !isViewer
            ? () => {
                setErrorMessage('');
                setIsModalOpen(true);
              }
            : undefined
        }
        primaryActionLabel={!isViewer ? 'New Project' : undefined}
        extraActions={
          <SegmentedControl
            options={[
              { id: 'list', label: 'List', icon: <List size={14} /> },
              { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={14} /> },
              { id: 'gantt', label: 'Portfolio Gantt', icon: <BarChart2 size={14} /> },
              { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={14} /> },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />

      <div className="p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : (
          <>
            {view === 'list' && (
              <ProjectListView
                projects={projects}
                user={currentUser}
                onProjectStatusChange={handleStatusChange}
                onDeleteProject={handleDeleteProject}
                onRefresh={fetchProjects}
              />
            )}
            {view === 'kanban' && (
              <ProjectKanbanView
                projects={projects}
                onProjectStatusChange={handleStatusChange}
              />
            )}
            {view === 'gantt' && <PortfolioGanttView projects={projects} />}
            {view === 'calendar' && <ProjectCalendarView projects={projects} />}
          </>
        )}
      </div>

      {/* New Project Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#101114] hairline-border rounded-xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between hairline-b pb-3">
              <h2 className="text-sm font-semibold text-gray-100">Create New Project Ticket</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Project Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Brand Reel & Campaign"
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe scope, objectives, and deliverables..."
                  className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                />
              </div>

              {/* Priority Selection for Admin & HOD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Priority Level *</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2] font-semibold"
                  >
                    <option value="LOW" className="text-gray-300">⚪ Low Priority</option>
                    <option value="MEDIUM" className="text-blue-400">🔵 Medium Priority</option>
                    <option value="HIGH" className="text-orange-400">🟠 High Priority</option>
                    <option value="URGENT" className="text-red-400 font-bold">🔴 Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-medium block mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  />
                </div>
              </div>

              {currentUser?.role === 'ADMIN' && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Department *</label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => {
                      setSelectedDeptId(e.target.value);
                      setDirectLeadUserId('');
                      setSelectedMemberIds([]);
                    }}
                    className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                  >
                    <option value="">Select Department...</option>
                    {departments
                      .filter((d) => d.status !== 'DECOMMISSIONED')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Direct Assignment Field for Admin and HOD */}
              {isAdminOrHod && (
                <div className="space-y-3 p-3 bg-white/5 hairline-border rounded-lg">
                  <div>
                    <label className="text-gray-200 font-medium block mb-1">
                      Assign Project Lead
                    </label>
                    <select
                      value={directLeadUserId}
                      onChange={(e) => setDirectLeadUserId(e.target.value)}
                      className="w-full bg-[#0c0d0f] hairline-border text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-[#5e6ad2]"
                    >
                      <option value="">Assign Later (Unassigned Lead)</option>
                      {relevantUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.designation || u.role} ({u.department?.name || 'Dept'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Direct assignment immediately sets project status to <span className="text-amber-400 font-semibold">In Progress</span> and stamps allocation timestamp.
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-200 font-medium block mb-1">
                      Assign Team Members to Project
                    </label>
                    <div className="max-h-28 overflow-y-auto space-y-1 bg-[#0c0d0f] p-2 rounded hairline-border">
                      {relevantUsers.map((u) => {
                        const isChecked = selectedMemberIds.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-2 text-xs text-gray-300 hover:text-white cursor-pointer">
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
                            <span>{u.name} ({u.designation || u.role})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-white/5 border border-white/10 rounded text-[11px] text-gray-400">
                {currentUser?.role === 'EMPLOYEE' ? (
                  <span>Employee-created projects route to the <strong className="text-amber-400">HOD / Team Lead Approval Queue</strong>.</span>
                ) : (
                  <span>Admin/HOD created projects are auto-approved live immediately.</span>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white rounded font-medium disabled:opacity-50 flex items-center gap-2 shadow-md"
                >
                  {isSubmitting ? 'Creating Project...' : 'Submit Project Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
