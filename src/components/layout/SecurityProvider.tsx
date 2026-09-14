'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    // Skip on unauthenticated auth pages
    if (pathname === '/login' || pathname === '/reset-password') return;

    let heartbeatInterval: NodeJS.Timeout | null = null;
    let broadcastChannel: BroadcastChannel | null = null;

    // Multi-Tab Coordination via BroadcastChannel
    const setupTabCoordination = () => {
      if (typeof window === 'undefined') return;

      if ('BroadcastChannel' in window) {
        try {
          broadcastChannel = new BroadcastChannel('thittam_tab_coordinator');
          broadcastChannel.postMessage({ type: 'TAB_PING', timestamp: Date.now() });

          broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'LOGOUT_BROADCAST') {
              if (!isLoggingOutRef.current) {
                isLoggingOutRef.current = true;
                router.replace('/login');
              }
            }
          };
        } catch (err) {
          console.error('BroadcastChannel error:', err);
        }
      }
    };

    setupTabCoordination();

    // Heartbeat function: sends keep-alive every 10s so tab switches and app switches NEVER cause premature logouts
    const sendHeartbeat = async () => {
      if (isLoggingOutRef.current) return;

      try {
        const res = await fetch('/api/auth/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 401 || res.status === 403) {
          isLoggingOutRef.current = true;
          router.replace('/login');
        }
      } catch (err) {
        // Network errors or transient drops shouldn't immediately kick user
      }
    };

    // User activity listeners to immediately touch session on user interaction
    const handleUserActivity = () => {
      // Periodic interaction
    };

    // When returning to tab, immediately verify session & send heartbeat
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/auth/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok && (res.status === 401 || res.status === 403)) {
            isLoggingOutRef.current = true;
            router.replace('/login');
          }
        } catch (err) {
          // ignore transient
        }
      }
    };

    // Back/Forward cache protection
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (event.persisted) {
        try {
          const res = await fetch('/api/auth/me');
          if (!res.ok) {
            isLoggingOutRef.current = true;
            router.replace('/login');
          }
        } catch (err) {
          router.replace('/login');
        }
      }
    };

    // Send initial heartbeat and start 10s interval
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 10 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      if (broadcastChannel) broadcastChannel.close();
    };
  }, [pathname, router]);

  return <>{children}</>;
}
