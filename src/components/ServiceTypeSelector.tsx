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
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Service Type</label>
      <div className="relative flex bg-gray-100 rounded-full p-1.5 shadow-inner border border-gray-200/50">
        {/* Sliding Background Pill */}
        <div 
          className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/3)] bg-white rounded-full transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-200/50"
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
              className={`relative z-10 flex-1 py-3 text-[15px] font-medium transition-all duration-300 outline-none active:scale-[0.97] select-none ${
                isSelected
                  ? 'text-red-600'
                  : 'text-gray-500 hover:text-gray-700'
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