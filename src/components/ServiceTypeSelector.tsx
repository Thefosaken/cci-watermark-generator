'use client';

import { ServiceType, OrganizationType } from '@/types/watermark';

interface ServiceTypeSelectorProps {
  value: ServiceType;
  onChange: (value: ServiceType) => void;
  organizationType: OrganizationType;
}

const campusServiceTypes: { value: ServiceType; label: string }[] = [
  { value: 'midweek', label: 'Midweek' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'event', label: 'Special Event' },
];

const cellChurchServiceTypes: { value: ServiceType; label: string }[] = [
  { value: 'midweek', label: 'Midweek' },
  { value: 'sunday', label: 'Sunday' },
];

export function ServiceTypeSelector({ value, onChange, organizationType }: ServiceTypeSelectorProps) {
  const serviceTypes = organizationType === 'cellChurch' ? cellChurchServiceTypes : campusServiceTypes;
  // Clamp to 0 so the sliding pill never flies off-screen when `value` isn't in
  // the current list (e.g. 'event' selected while switching to Cell Church).
  const selectedIndex = Math.max(0, serviceTypes.findIndex((t) => t.value === value));
  
  const activeServiceTypes = organizationType === 'cellChurch' ? cellChurchServiceTypes : campusServiceTypes;
  const pillWidth = 100 / activeServiceTypes.length;

  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Service Type</label>
      <div className="relative flex bg-[var(--surface-subtle)] rounded-full p-1 border border-[var(--border)]">
        {/* Sliding Background Pill */}
        <div 
          className="absolute top-1 bottom-1 left-1 bg-[var(--surface-raised)] rounded-full transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] border border-[var(--border)]"
          style={{ 
            transform: `translateX(${selectedIndex * 100}%)`,
            width: `calc(${pillWidth}% - 4px)`,
          }}
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