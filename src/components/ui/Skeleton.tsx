import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white/5 rounded-lg ${className}`}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-7 w-12" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="p-3 bg-[#0c0d0f] hairline-border rounded-lg flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
        <div className="space-y-3">
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      </div>
    </div>
  );
}
