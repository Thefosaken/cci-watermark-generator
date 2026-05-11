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
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Service Type</label>
      <div className="flex gap-2">
        {serviceTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              value === type.value
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}