'use client';

import React, { useState, useEffect } from 'react';
import { History, ArrowRight, Clock, ShieldCheck, User as UserIcon } from 'lucide-react';
import { AvatarChip } from '@/components/ui/AvatarChip';

interface HistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: {
    id?: string;
    name: string;
    role: string;
    designation?: string;
  };
  meta: any;
  createdAt: string;
}

interface HistoryTabProps {
  projectId: string;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ projectId }) => {
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/history`);
      const data = await res.json();
      if (data.history) setLogs(data.history);
    } catch (err) {
      console.error('Fetch project history error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <History size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Entity Change History & Audit Diffs</h3>
            <p className="text-[11px] text-gray-400">
              Detailed chronological record of every status change, reassignment, and checkpoint modification
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors hairline-border"
        >
          Refresh Log
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading audit history...</div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
          <History size={24} className="text-gray-600 mx-auto" />
          <h4 className="text-xs font-semibold text-gray-300">No History Records Found</h4>
          <p className="text-[11px] text-gray-500">Changes to project and task attributes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const meta = log.meta || {};
            const before = meta.before;
            const after = meta.after;

            return (
              <div
                key={log.id}
                className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3 text-xs shadow-sm hover:border-white/20 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {formatAction(log.action)}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400 uppercase font-mono">
                      [{log.entityType}]
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                    <Clock size={12} />
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actor Info */}
                <div className="flex items-center gap-2">
                  <AvatarChip
                    name={log.actor.name}
                    designation={log.actor.designation || log.actor.role}
                    size="sm"
                  />
                  <span className="text-gray-400 text-[11px]">
                    performed <strong className="text-gray-200">{formatAction(log.action)}</strong>
                  </span>
                </div>

                {/* Before / After Diff Table if available */}
                {before && after && (
                  <div className="bg-[#0c0d0f] p-3 rounded-lg hairline-border space-y-1.5 text-[11px]">
                    <div className="grid grid-cols-2 gap-3 text-gray-400 hairline-b pb-1">
                      <span className="font-semibold text-red-400/80">Previous State</span>
                      <span className="font-semibold text-emerald-400/80">Updated State</span>
                    </div>

                    {Object.keys(after).map((key) => {
                      if (key === 'version') return null;
                      if (before[key] === after[key]) return null;

                      return (
                        <div key={key} className="grid grid-cols-2 gap-3 pt-1">
                          <div className="flex items-center gap-1.5 text-gray-400 truncate">
                            <span className="text-gray-500 font-mono text-[10px]">{key}:</span>
                            <span className="line-through text-red-300/70 truncate">
                              {String(before[key] ?? 'none')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-emerald-300 truncate font-medium">
                            <ArrowRight size={11} className="text-emerald-400 shrink-0" />
                            <span className="truncate">{String(after[key] ?? 'none')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Additional Meta Note if present */}
                {meta.reason && (
                  <div className="p-2 bg-white/5 rounded text-[11px] text-gray-300 italic">
                    Reason: &quot;{meta.reason}&quot;
                  </div>
                )}
                {meta.note && (
                  <div className="p-2 bg-white/5 rounded text-[11px] text-gray-300 italic">
                    Note: &quot;{meta.note}&quot;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
