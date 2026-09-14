import React from 'react';
import Link from 'next/link';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { Header } from '@/components/layout/Header';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { AvatarChip } from '@/components/ui/AvatarChip';
import {
  FolderKanban,
  CheckSquare,
  Clock,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) return null;

  // Role-specific project filtering
  let projectWhere: any = {};

  if (session.role === 'HOD') {
    projectWhere.departmentId = session.departmentId;
  } else if (session.role === 'TEAM_LEAD') {
    projectWhere.OR = [
      { departmentId: session.departmentId },
      { createdById: session.id },
      { pointOfContactId: session.id },
      { members: { some: { userId: session.id } } },
    ];
  } else if (session.role === 'EMPLOYEE' || session.role === 'INTERN' || session.role === 'HR') {
    projectWhere.OR = [
      { createdById: session.id },
      { pointOfContactId: session.id },
      { members: { some: { userId: session.id } } },
    ];
  } else if (session.role === 'CONTRACTOR') {
    projectWhere.members = { some: { userId: session.id } };
  } else if (session.role === 'CLIENT') {
    projectWhere.clientVisibilities = { some: { userId: session.id } };
  }

  const [
    projectsCount,
    activeProjectsCount,
    pendingTicketsCount,
    supportRequiredCount,
    completedProjectsCount,
    myActiveTasks,
    overdueProjects,
    recentActivity,
  ] = await Promise.all([
    db.project.count({ where: projectWhere }),
    db.project.count({
      where: { ...projectWhere, status: 'IN_PROGRESS' },
    }),
    db.project.count({
      where: { ...projectWhere, status: 'PENDING_APPROVAL' },
    }),
    db.project.count({
      where: { ...projectWhere, status: 'SUPPORT_REQUIRED' },
    }),
    db.project.count({
      where: { ...projectWhere, status: 'COMPLETED' },
    }),
    db.task.findMany({
      where: {
        assigneeId: session.id,
        status: { in: ['TODO', 'IN_PROGRESS', 'SUPPORT_REQUIRED'] },
      },
      include: { project: true },
      orderBy: { dueDate: 'asc' },
      take: 6,
    }),
    db.project.findMany({
      where: {
        ...projectWhere,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
        dueDate: { lt: new Date() },
      },
      include: { pointOfContact: true, members: { include: { user: true } } },
      take: 5,
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 7,
    }),
  ]);

  const isPrivileged = session.role === 'ADMIN' || session.role === 'HOD';

  return (
    <div className="flex-1 pb-16 bg-mesh-dark">
      <Header
        title={`Welcome back, ${session.name}`}
        subtitle={`${session.designation || session.role} • ${session.departmentName || (session.role === 'ADMIN' ? 'Executive Administration' : 'Management')}`}
        extraActions={
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-glow-accent transition-all duration-200"
          >
            <FolderKanban size={14} />
            <span>Explore Projects</span>
            <ArrowRight size={13} className="opacity-70" />
          </Link>
        }
      />

      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Unlogged Timeline Prompt Banner */}
        <div className="glass-card rounded-xl p-4 border border-[#5e6ad2]/30 bg-gradient-to-r from-[#5e6ad2]/10 via-[#5e6ad2]/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#5e6ad2]/20 border border-[#5e6ad2]/40 flex items-center justify-center text-[#5e6ad2] shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-100 flex items-center gap-2">
                <span>Daily Work Timeline Progress</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">
                  Active
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Log hours spent and notes on your assigned tasks to maintain automated project audit history.
              </p>
            </div>
          </div>
          <Link
            href="/projects"
            className="px-3.5 py-2 bg-[#5e6ad2] hover:bg-[#4e5ac0] text-white text-xs font-semibold rounded-lg transition-all shadow-sm shrink-0 interactive-hover"
          >
            Log Progress Now
          </Link>
        </div>

        {/* Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Projects */}
          <div className="glass-card rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5e6ad2] to-indigo-400 opacity-80" />
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="font-medium tracking-wide uppercase text-[11px]">Active Initiatives</span>
              <div className="p-2 rounded-lg bg-[#5e6ad2]/15 text-[#5e6ad2] group-hover:scale-110 transition-transform">
                <FolderKanban size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">{activeProjectsCount}</span>
              <span className="text-xs text-gray-400">/ {projectsCount} total</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400">
              <CheckCircle2 size={13} />
              <span>{completedProjectsCount} completed to date</span>
            </div>
          </div>

          {/* Pending Approval */}
          <div className="glass-card rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400 opacity-80" />
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="font-medium tracking-wide uppercase text-[11px]">Approval Pipeline</span>
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 group-hover:scale-110 transition-transform">
                <CheckSquare size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{pendingTicketsCount}</span>
              <span className="text-xs text-gray-400">awaiting review</span>
            </div>
            <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-amber-400" />
              <span>{isPrivileged ? 'Review in queue' : 'Under management review'}</span>
            </div>
          </div>

          {/* Support Requests */}
          <div className="glass-card rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 opacity-80" />
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="font-medium tracking-wide uppercase text-[11px]">Support Escalations</span>
              <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 group-hover:scale-110 transition-transform">
                <HelpCircle size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-orange-400 tracking-tight">{supportRequiredCount}</span>
              <span className="text-xs text-gray-400">open tickets</span>
            </div>
            <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
              <Activity size={13} className="text-orange-400" />
              <span>Peer & department triage</span>
            </div>
          </div>

          {/* Overdue / Critical Items */}
          <div className="glass-card rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-400 opacity-80" />
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="font-medium tracking-wide uppercase text-[11px]">Overdue Attention</span>
              <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400 group-hover:scale-110 transition-transform">
                <AlertCircle size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-400 tracking-tight">{overdueProjects.length}</span>
              <span className="text-xs text-gray-400">past target deadline</span>
            </div>
            <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
              <Clock size={13} className="text-rose-400" />
              <span>Requires immediate priority</span>
            </div>
          </div>
        </div>

        {/* Dashboard Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: My Active Tasks & Overdue Projects */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Active Tasks Card */}
            <div className="glass-card rounded-2xl p-6 space-y-5 border border-white/10 shadow-card-elevated">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2]">
                    <Layers size={15} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-100 tracking-tight">
                      My Assigned Deliverables
                    </h3>
                    <p className="text-[11px] text-gray-400">Active tasks requiring action or progress logging</p>
                  </div>
                </div>
                <Link
                  href="/projects"
                  className="text-xs text-[#5e6ad2] hover:text-[#4e5ac0] font-medium flex items-center gap-1 transition-colors"
                >
                  <span>View full board</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {myActiveTasks.length > 0 ? (
                <div className="space-y-2.5">
                  {myActiveTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 bg-[#0e1014] hover:bg-[#12141a] border border-white/5 hover:border-white/15 rounded-xl flex items-center justify-between text-xs transition-all duration-200 group"
                    >
                      <div className="space-y-1 max-w-[65%]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#5e6ad2] font-semibold text-[11px] px-1.5 py-0.5 rounded bg-[#5e6ad2]/10">
                            {t.taskNumber}
                          </span>
                          <span className="font-medium text-gray-100 truncate group-hover:text-white">
                            {t.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono truncate flex items-center gap-1.5">
                          <span className="text-gray-500">{t.project.projectNumber}</span>
                          <span>•</span>
                          <span className="text-gray-400 truncate">{t.project.title}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <StatusGlyph status={t.status} size={12} />
                        {t.dueDate ? (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono bg-white/5 px-2 py-1 rounded-md">
                            <Calendar size={11} className="text-gray-500" />
                            {new Date(t.dueDate).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600 font-mono">No due date</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-gray-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-gray-400">
                    <CheckCircle2 size={18} />
                  </div>
                  <p>No active tasks assigned to your account right now.</p>
                  <Link href="/projects" className="text-[#5e6ad2] hover:underline block text-[11px]">
                    Browse projects & assign yourself
                  </Link>
                </div>
              )}
            </div>

            {/* Overdue Items Alert Card */}
            {overdueProjects.length > 0 && (
              <div className="glass-card rounded-2xl p-6 space-y-4 border border-rose-500/20 bg-rose-500/[0.02]">
                <div className="flex items-center justify-between pb-3 border-b border-rose-500/15">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertCircle size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Overdue Deliverables ({overdueProjects.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-rose-400/80 font-mono">Action Recommended</span>
                </div>

                <div className="space-y-2.5">
                  {overdueProjects.map((p) => {
                    const leadMember = p.members?.find((m) => m.isLead);
                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-[#0e1014] border border-rose-500/25 rounded-xl flex items-center justify-between text-xs hover:border-rose-500/40 transition-colors"
                      >
                        <div className="space-y-0.5 max-w-[65%]">
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-semibold text-gray-100 hover:text-rose-300 truncate block"
                          >
                            {p.projectNumber} — {p.title}
                          </Link>
                          <span className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                            <Clock size={11} />
                            Target was {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <AvatarChip
                          name={leadMember?.user?.name || p.pointOfContact?.name || 'Unassigned'}
                          designation={leadMember?.user?.designation}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Live Activity Feed */}
          <div className="glass-card rounded-2xl p-6 space-y-5 border border-white/10 shadow-card-elevated">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#5e6ad2]/20 flex items-center justify-center text-[#5e6ad2]">
                  <TrendingUp size={15} />
                </div>
                <h3 className="text-sm font-semibold text-gray-100 tracking-tight">
                  Activity Audit Stream
                </h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-500/10 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>

            <div className="space-y-3">
              {recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-[#0e1014] border border-white/5 rounded-xl text-xs space-y-1.5 hover:border-white/15 transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="font-mono text-[#5e6ad2] uppercase font-semibold text-[10px] px-1.5 py-0.2 rounded bg-[#5e6ad2]/10">
                      {act.entityType}
                    </span>
                    <span className="text-gray-500 font-mono text-[10px]">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-200 capitalize font-medium text-xs">
                    {act.action.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>

            {isPrivileged && (
              <div className="pt-2 border-t border-white/5">
                <Link
                  href="/activity-log"
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Activity size={13} className="text-[#5e6ad2]" />
                  <span>View Organization Audit Logs</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

