'use client';

import React, { useState, useEffect } from 'react';
import { UserSession } from '@/lib/types';
import { Sidebar } from '@/components/layout/Sidebar';
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal';
import { SecurityProvider } from '@/components/layout/SecurityProvider';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { MobileNavProvider, useMobileNav } from '@/lib/navContext';

interface DashboardClientLayoutProps {
  user: UserSession;
  children: React.ReactNode;
}

const LayoutContent: React.FC<DashboardClientLayoutProps> = ({ user, children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isMobileOpen, setIsMobileOpen } = useMobileNav();

  // Global cross-OS keyboard listener (Cmd+K for Mac/iOS, Ctrl+K for Windows/Linux/other OS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c0e] flex flex-col md:flex-row w-full overflow-x-hidden">
      {/* Responsive Sidebar Drawer */}
      <Sidebar
        user={user}
        onOpenSearch={() => setIsSearchOpen(true)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area (Full width on mobile, offset on desktop) */}
      <main className="flex-1 w-full md:ml-60 min-h-screen flex flex-col min-w-0">
        {children}
      </main>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

export const DashboardClientLayout: React.FC<DashboardClientLayoutProps> = ({
  user,
  children,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <SecurityProvider>
      <SocketProvider>
        <MobileNavProvider onOpenSearch={() => setIsSearchOpen(true)}>
          <LayoutContent user={user}>{children}</LayoutContent>
        </MobileNavProvider>
      </SocketProvider>
    </SecurityProvider>
  );
};

