'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { AvatarChip } from '@/components/ui/AvatarChip';
import { BarChart3, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

import { TableRowSkeleton } from '@/components/ui/Skeleton';

export default function WorkloadPage() {
  const [workload, setWorkload] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWorkload();
  }, []);

  const fetchWorkload = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workload');
      const data = await res.json();
      if (data.workload) setWorkload(data.workload);
    } catch (err) {
      console.error('Fetch workload error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Team Resource Allocation & Workload"
        subtitle="Capacity gauges and active task hour allocations across team members"
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#101114] hairline-border rounded-xl flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">Available (&lt;80% Cap)</h4>
                  <p className="text-[11px] text-gray-500">
                    {workload.filter((w) => w.availabilityStatus === 'available').length} Team Members
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#101114] hairline-border rounded-xl flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">Near Capacity (80–100%)</h4>
                  <p className="text-[11px] text-gray-500">
                    {workload.filter((w) => w.availabilityStatus === 'near_capacity').length} Team Members
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#101114] hairline-border rounded-xl flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">Overloaded (&gt;100% Cap)</h4>
                  <p className="text-[11px] text-gray-500">
                    {workload.filter((w) => w.availabilityStatus === 'overloaded').length} Team Members
                  </p>
                </div>
              </div>
            </div>

            {/* Workload Data Table */}
            <div className="overflow-x-auto bg-[#101114] hairline-border rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0c0d0f] text-gray-400 hairline-b font-medium">
                    <th className="py-3 px-4">Team Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Active Tasks</th>
                    <th className="py-3 px-4">Assigned Hours</th>
                    <th className="py-3 px-4">Weekly Capacity</th>
                    <th className="py-3 px-4">Workload Bar & Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {workload.map((w) => {
                    let gaugeBg = 'bg-emerald-500';
                    let badge = (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                        Available
                      </span>
                    );

                    if (w.availabilityStatus === 'near_capacity') {
                      gaugeBg = 'bg-amber-500';
                      badge = (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                          Near Capacity
                        </span>
                      );
                    } else if (w.availabilityStatus === 'overloaded') {
                      gaugeBg = 'bg-red-500';
                      badge = (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                          Overloaded
                        </span>
                      );
                    }

                    return (
                      <tr key={w.userId} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <AvatarChip name={w.name} designation={w.designation} size="md" />
                        </td>
                        <td className="py-3 px-4 text-gray-300">{w.departmentName}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-gray-200">
                          {w.activeTasksCount} active tasks
                        </td>
                        <td className="py-3 px-4 font-mono text-[#5e6ad2] font-bold">
                          {w.totalEstimatedHours} hrs
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">
                          {w.weeklyCapacityHours} hrs/wk
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-36 h-2 bg-[#0c0d0f] rounded-full hairline-border overflow-hidden">
                              <div
                                style={{ width: `${Math.min(w.capacityRatio, 100)}%` }}
                                className={`h-full rounded-full ${gaugeBg}`}
                              />
                            </div>
                            {badge}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
