'use client';

import React from 'react';

interface TagBadgeProps {
  label?: {
    id?: string;
    name: string;
    color: string;
  };
  name?: string;
  color?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export const TagBadge: React.FC<TagBadgeProps> = ({ label, name, color, onRemove, size = 'sm' }) => {
  const tagName = name || label?.name || '';
  const tagColor = color || label?.color || '#5e6ad2';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium border ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        backgroundColor: `${tagColor}15`,
        borderColor: `${tagColor}35`,
        color: tagColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tagColor }}
      />
      <span>{tagName}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-75 focus:outline-none"
        >
          ×
        </button>
      )}
    </span>
  );
};
