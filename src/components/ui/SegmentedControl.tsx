import React from 'react';

interface Option {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <div className="inline-flex p-0.5 rounded-md bg-[#101114] hairline-border">
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${
              isActive
                ? 'bg-[#5e6ad2] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
