'use client';

import React from 'react';
import { Plus, Menu } from 'lucide-react';
import { useMobileNav } from '@/lib/navContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  extraActions?: React.ReactNode;
  onToggleMobileNav?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onPrimaryAction,
  primaryActionLabel,
  extraActions,
  onToggleMobileNav,
}) => {
  const { toggleMobileNav } = useMobileNav();
  const handleToggle = onToggleMobileNav || toggleMobileNav;

  return (
    <header className="h-14 px-4 md:px-6 hairline-b bg-[#0b0c0e]/85 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={handleToggle}
          className="p-1.5 -ml-1 text-gray-400 hover:text-white rounded-lg md:hidden hover:bg-white/5 transition-colors shrink-0"
          aria-label="Open mobile navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-gray-100 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {extraActions}
        {onPrimaryAction && primaryActionLabel && (
          <button
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#5e6ad2] text-white rounded-lg hover:bg-[#4e5ac0] active:scale-[0.98] transition-all shadow-sm"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{primaryActionLabel}</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
      </div>
    </header>
  );
};

