'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, Wifi, WifiOff } from 'lucide-react';

interface Viewer {
  userId: string;
  name: string;
  designation?: string;
  role: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeViewers: Viewer[];
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  activeViewers: [],
  joinProject: () => {},
  leaveProject: () => {},
  subscribe: () => () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeViewers, setActiveViewers] = useState<Viewer[]>([]);
  const currentProjectRef = useRef<string | null>(null);
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      // Re-join active project if reconnected
      if (currentProjectRef.current) {
        socketInstance.emit('join:project', currentProjectRef.current);
      }
      // Notify all subscribers of full resync upon reconnect
      const resyncListeners = eventListenersRef.current.get('resync');
      if (resyncListeners) {
        resyncListeners.forEach((cb) => cb({ timestamp: Date.now() }));
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('presence:update', (data: { projectId: string; viewers: Viewer[] }) => {
      if (data.projectId === currentProjectRef.current) {
        setActiveViewers(data.viewers || []);
      }
    });

    setSocket(socketInstance);

    return () => {
      if (currentProjectRef.current) {
        socketInstance.emit('leave:project', currentProjectRef.current);
      }
      socketInstance.disconnect();
    };
  }, []);

  const joinProject = useCallback(
    (projectId: string) => {
      if (!projectId) return;
      if (currentProjectRef.current && currentProjectRef.current !== projectId) {
        socket?.emit('leave:project', currentProjectRef.current);
      }
      currentProjectRef.current = projectId;
      socket?.emit('join:project', projectId);
    },
    [socket]
  );

  const leaveProject = useCallback(
    (projectId: string) => {
      if (!projectId) return;
      if (currentProjectRef.current === projectId) {
        currentProjectRef.current = null;
        setActiveViewers([]);
      }
      socket?.emit('leave:project', projectId);
    },
    [socket]
  );

  const subscribe = useCallback(
    (event: string, callback: (data: any) => void) => {
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, new Set());
      }
      eventListenersRef.current.get(event)!.add(callback);

      // Attach to socket if available
      const socketHandler = (data: any) => {
        callback(data);
      };

      socket?.on(event, socketHandler);

      return () => {
        eventListenersRef.current.get(event)?.delete(callback);
        socket?.off(event, socketHandler);
      };
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeViewers,
        joinProject,
        leaveProject,
        subscribe,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Presence Indicator on Project Detail:
 * Displays active viewer avatars & count
 */
export function ProjectPresenceBadge({ currentUserId }: { currentUserId?: string }) {
  const { isConnected, activeViewers } = useSocket();

  const otherViewers = activeViewers.filter((v) => v.userId !== currentUserId);

  if (otherViewers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 hairline-border rounded-full text-xs animate-in fade-in duration-200">
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {otherViewers.slice(0, 3).map((v) => (
          <div
            key={v.userId}
            title={`${v.name} (${v.role}) is viewing now`}
            className="w-5 h-5 rounded-full bg-[#5e6ad2] text-white flex items-center justify-center text-[9px] font-bold border border-[#101114]"
          >
            {v.name[0]?.toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-gray-300 font-medium">
        {otherViewers.length === 1 ? (
          <span><strong>{otherViewers[0].name}</strong> viewing</span>
        ) : (
          <span><strong>{otherViewers.length}</strong> others viewing</span>
        )}
      </span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
    </div>
  );
}
