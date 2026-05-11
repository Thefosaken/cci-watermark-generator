'use client';

import { ServiceType } from '@/types/watermark';

interface ServiceTypeSelectorProps {
  value: ServiceType;
  onChange: (value: ServiceType) => void;
}

const serviceTypes: { value: ServiceType; label: string }[] = [
  { value: 'midweek', label: 'Midweek' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'event', label: 'Special Event' },
];

export function ServiceTypeSelector({ value, onChange }: ServiceTypeSelectorProps) {
  const selectedIndex = serviceTypes.findIndex((t) => t.value === value);

  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Service Type</label>
      <div className="relative flex bg-[var(--surface-subtle)] rounded-full p-1 shadow-inner border border-[var(--border)]">
        {/* Sliding Background Pill */}
        <div 
          className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] bg-[var(--surface-raised)] rounded-full transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[var(--border)]"
          style={{ transform: `translateX(${selectedIndex * 100}%)` }}
        />
        
        {/* Clickable Options */}
        {serviceTypes.map((type) => {
          const isSelected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={`relative z-10 flex-1 py-2.5 text-[14px] font-medium transition-all duration-300 outline-none active:scale-[0.97] select-none ${
                isSelected
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}