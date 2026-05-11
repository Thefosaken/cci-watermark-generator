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
      <div className="relative flex bg-[#0A0C10] rounded-[24px] p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] border border-[#1F2128]">
        {/* Sliding Background Pill */}
        <div 
          className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/3)] bg-[#1A1D24] rounded-[20px] transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.04]"
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
                  ? 'text-[#FF4A4A]'
                  : 'text-[#8A8F98] hover:text-white'
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