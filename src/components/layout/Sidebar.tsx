'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  BarChart3,
  HelpCircle,
  History,
  User,
  Search,
  LogOut,
  Bell,
  Building,
  X,
} from 'lucide-react';
import { UserSession } from '@/lib/types';
import { AvatarChip } from '../ui/AvatarChip';
import { useOsShortcut } from '@/lib/useOsShortcut';

interface SidebarProps {
  user: UserSession;
  onOpenSearch: () => void;
  unreadNotificationsCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  onOpenSearch,
  unreadNotificationsCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { shortcutLabel } = useOsShortcut();

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Navigation items based on role hierarchy
  const isElevated = user.role === 'ADMIN' || user.role === 'HOD';
  const isLeadOrAbove = isElevated || user.role === 'TEAM_LEAD';

  const navItems: { label: string; href: string; icon: React.ReactNode; badge?: number }[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'Projects', href: '/projects', icon: <FolderKanban size={16} /> },
    ...(isElevated ? [{ label: 'Departments', href: '/departments', icon: <Building size={16} /> }] : []),
    ...(isLeadOrAbove ? [{ label: 'Approval Queue', href: '/approval-queue', icon: <CheckSquare size={16} /> }] : []),
    ...(isElevated || user.role === 'HR' ? [{ label: 'Users', href: '/users', icon: <Users size={16} /> }] : []),
    ...(isLeadOrAbove ? [{ label: 'Team Workload', href: '/workload', icon: <BarChart3 size={16} /> }] : []),
    { label: 'Support Requests', href: '/support-requests', icon: <HelpCircle size={16} /> },
    ...(isElevated ? [{ label: 'Activity Log', href: '/activity-log', icon: <History size={16} /> }] : []),
    {
      label: 'Notifications',
      href: '/notifications',
      icon: <Bell size={16} />,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { label: 'My Profile', href: '/profile', icon: <User size={16} /> },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`w-64 md:w-60 bg-[#0c0d0f] hairline-r flex flex-col justify-between h-screen fixed left-0 top-0 z-40 select-none transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Workspace Title */}
          <div className="h-14 px-4 hairline-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#5e6ad2] flex items-center justify-center text-white font-bold text-xs shadow-md">
                TH
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-100 tracking-tight">Thittam</span>
                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 truncate max-w-[110px]">
                  <Building size={10} className="shrink-0" />
                  <span className="truncate">{user.departmentName || (user.role === 'ADMIN' ? 'Org Wide' : 'Management')}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                {user.role}
              </span>
              {/* Mobile Close Button */}
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="p-1 text-gray-400 hover:text-white rounded-md md:hidden ml-1"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Global Quick Search with OS-Aware Badge */}
          <div className="p-3">
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onOpenSearch();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 bg-[#101114] hairline-border hover:border-white/20 rounded-lg transition-all group"
            >
              <span className="flex items-center gap-2 group-hover:text-gray-200">
                <Search size={14} className="text-gray-500 group-hover:text-[#5e6ad2]" />
                Search...
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded font-mono text-gray-400 group-hover:border-[#5e6ad2]/40 group-hover:text-[#5e6ad2] transition-colors">
                {shortcutLabel}
              </kbd>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="px-2 space-y-0.5 mt-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-[#5e6ad2]/20 text-white border-l-2 border-[#5e6ad2] font-semibold'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Card */}
        <div className="p-3 hairline-t bg-[#0a0b0d] shrink-0">
          <div className="flex items-center justify-between">
            <AvatarChip
              name={user.name}
              designation={user.designation}
              showDesignation={true}
              size="md"
            />
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

