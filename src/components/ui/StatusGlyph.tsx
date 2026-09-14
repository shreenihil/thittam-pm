import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  XCircle,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { ProjectStatus, TaskStatus } from '@/lib/types';

interface StatusGlyphProps {
  status: ProjectStatus | TaskStatus | string;
  showText?: boolean;
  size?: number;
}

export const StatusGlyph: React.FC<StatusGlyphProps> = ({
  status,
  showText = true,
  size = 16,
}) => {
  let icon = <Circle size={size} className="text-gray-400" />;
  let label = status.replace(/_/g, ' ');
  let badgeColor = 'text-gray-400 bg-gray-500/10 border-gray-500/20';

  switch (status) {
    case 'IN_PROGRESS':
      icon = <Clock size={size} className="text-amber-400 animate-pulse" />;
      badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      break;
    case 'TODO':
    case 'PENDING_APPROVAL':
      icon = <Circle size={size} className="text-gray-400" />;
      badgeColor = 'text-gray-300 bg-gray-500/10 border-gray-500/20';
      break;
    case 'SUPPORT_REQUIRED':
      icon = <AlertTriangle size={size} className="text-orange-400" />;
      badgeColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      break;
    case 'ON_HOLD':
      icon = <PauseCircle size={size} className="text-blue-400" />;
      badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      break;
    case 'COMPLETED':
    case 'DONE':
      icon = <CheckCircle2 size={size} className="text-emerald-400" />;
      badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      break;
    case 'CANCELLED':
    case 'REJECTED':
      icon = <XCircle size={size} className="text-red-400" />;
      badgeColor = 'text-red-400 bg-red-500/10 border-red-500/20';
      break;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${badgeColor}`}>
      {icon}
      {showText && <span className="capitalize">{label.toLowerCase()}</span>}
    </div>
  );
};
