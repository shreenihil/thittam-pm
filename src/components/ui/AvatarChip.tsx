import React from 'react';
import { User } from 'lucide-react';

interface AvatarChipProps {
  name?: string | null;
  designation?: string | null;
  showDesignation?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isLead?: boolean;
}

export const AvatarChip: React.FC<AvatarChipProps> = ({
  name,
  designation,
  showDesignation = true,
  size = 'md',
  isLead = false,
}) => {
  if (!name) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 italic border border-dashed border-gray-700 px-2 py-0.5 rounded">
        <User size={12} />
        Unassigned
      </div>
    );
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const sizeClasses =
    size === 'sm'
      ? 'w-5 h-5 text-[10px]'
      : size === 'lg'
      ? 'w-8 h-8 text-sm'
      : 'w-6 h-6 text-xs';

  return (
    <div className="inline-flex items-center gap-2 max-w-full">
      <div
        className={`relative rounded-full flex items-center justify-center font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shrink-0 ${sizeClasses}`}
      >
        {initials}
        {isLead && (
          <span
            title="Project Lead"
            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-gray-900"
          />
        )}
      </div>

      <div className="flex flex-col min-w-0 leading-tight">
        <span className="text-xs font-medium text-gray-200 truncate flex items-center gap-1">
          {name}
          {isLead && <span className="text-[10px] text-amber-400 font-semibold px-1 py-0.2 bg-amber-400/10 rounded">Lead</span>}
        </span>
        {showDesignation && designation && (
          <span className="text-[11px] text-gray-400 truncate">{designation}</span>
        )}
      </div>
    </div>
  );
};
