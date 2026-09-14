'use client';

import React, { createContext, useContext, useState } from 'react';

interface MobileNavContextType {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  openSearch: () => void;
}

const MobileNavContext = createContext<MobileNavContextType>({
  isMobileOpen: false,
  setIsMobileOpen: () => {},
  toggleMobileNav: () => {},
  openSearch: () => {},
});

export const useMobileNav = () => useContext(MobileNavContext);

export const MobileNavProvider: React.FC<{
  children: React.ReactNode;
  onOpenSearch: () => void;
}> = ({ children, onOpenSearch }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleMobileNav = () => setIsMobileOpen((prev) => !prev);

  return (
    <MobileNavContext.Provider
      value={{
        isMobileOpen,
        setIsMobileOpen,
        toggleMobileNav,
        openSearch: onOpenSearch,
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
};
