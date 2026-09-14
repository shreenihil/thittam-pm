'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { StatusGlyph } from '../ui/StatusGlyph';
import { AvatarChip } from '../ui/AvatarChip';
import { Calendar, AlertTriangle } from 'lucide-react';

interface ProjectKanbanViewProps {
  projects: any[];
  onProjectStatusChange: (id: string, newStatus: string) => void;
}

const COLUMNS = [
  { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'SUPPORT_REQUIRED', label: 'Support Required' },
  { id: 'ON_HOLD', label: 'On Hold' },
  { id: 'COMPLETED', label: 'Completed' },
];

function KanbanCard({ project }: { project: any }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const leadMember = project.members?.find((m: any) => m.isLead);
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'COMPLETED';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3.5 bg-[#101114] hairline-border hover:border-gray-600 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-colors space-y-2.5 group"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-[#5e6ad2]">
          {project.projectNumber}
        </span>
        <div className="flex items-center gap-1.5">
          {project.priority === 'URGENT' && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded uppercase">Urgent</span>
          )}
          {project.priority === 'HIGH' && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded uppercase">High</span>
          )}
          {project.priority === 'LOW' && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded uppercase">Low</span>
          )}
          <span className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-gray-400">
            {project.department?.name}
          </span>
        </div>
      </div>

      <Link
        href={`/projects/${project.id}`}
        className="font-medium text-xs text-gray-100 hover:text-[#5e6ad2] block line-clamp-2"
      >
        {project.title}
      </Link>

      <div className="pt-2 hairline-t flex items-center justify-between text-xs">
        <AvatarChip
          name={leadMember?.user?.name || project.pointOfContact?.name}
          designation={leadMember?.user?.designation || project.pointOfContact?.designation}
          size="sm"
          isLead={true}
        />

        {project.dueDate && (
          <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
            <Calendar size={11} />
            {new Date(project.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ col, projects }: { col: any; projects: any[] }) {
  const { setNodeRef } = useDroppable({
    id: col.id,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-[260px] bg-[#0c0d0f] hairline-border rounded-xl p-3 flex flex-col h-[calc(100vh-180px)]"
    >
      <div className="flex items-center justify-between pb-3 hairline-b mb-3">
        <div className="flex items-center gap-2">
          <StatusGlyph status={col.id} showText={false} size={14} />
          <h3 className="text-xs font-semibold text-gray-200">{col.label}</h3>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-gray-300">
          {projects.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {projects.map((p) => (
          <KanbanCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

export const ProjectKanbanView: React.FC<ProjectKanbanViewProps> = ({
  projects,
  onProjectStatusChange,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const projectId = active.id;
    const targetStatus = over.id;

    const project = projects.find((p) => p.id === projectId);
    if (project && project.status !== targetStatus) {
      onProjectStatusChange(projectId, targetStatus);
    }
  };

  const activeProject = activeDragId ? projects.find((p) => p.id === activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.status === col.id);
          return <KanbanColumn key={col.id} col={col} projects={colProjects} />;
        })}
      </div>

      <DragOverlay>
        {activeProject ? <KanbanCard project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
