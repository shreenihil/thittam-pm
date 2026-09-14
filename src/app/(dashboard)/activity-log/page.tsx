'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { History, Shield } from 'lucide-react';

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/activity-log');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.error('Fetch activity log error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Administrative Activity Audit Log"
        subtitle="Reverse-chronological system audit feed across projects, tasks, and users"
      />

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading audit feed...</div>
        ) : (
          <div className="bg-[#101114] hairline-border rounded-xl p-4 space-y-3 shadow-sm">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-[#0c0d0f] hairline-border rounded-lg flex items-center justify-between text-xs hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AvatarChip
                    name={log.actor?.name || 'System Admin'}
                    designation={log.actor?.designation || log.actor?.role}
                    size="sm"
                  />
                  <div>
                    <span className="font-semibold text-gray-100 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-white/5 mr-2">
                      {log.entityType}
                    </span>
                    <span className="text-gray-300 font-medium capitalize">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    {log.meta && (
                      <span className="text-gray-500 text-[11px] ml-2">
                        {JSON.stringify(log.meta)}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-gray-500 font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
