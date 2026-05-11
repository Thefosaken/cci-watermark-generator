'use client';

import { Campus, ServiceType } from '@/types/watermark';

interface CampusSelectorProps {
  campuses: Campus[];
  value: Campus | null;
  serviceType: ServiceType;
  onChange: (campus: Campus) => void;
}

export function CampusSelector({ campuses, value, serviceType, onChange }: CampusSelectorProps) {
  const activeCampuses = campuses.filter((c) => c.active);

  const getDisplayAddress = (campus: Campus) => {
    if (serviceType === 'midweek' && campus.midweekAddress) {
      return campus.midweekAddress;
    }
    if (serviceType === 'sunday' && campus.sundayAddress) {
      return campus.sundayAddress;
    }
    return campus.address;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Campus</label>
      <select
        value={value?.id || ''}
        onChange={(e) => {
          const selected = activeCampuses.find((c) => c.id === e.target.value);
          if (selected) onChange(selected);
        }}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
      >
        <option value="">Select a campus...</option>
        {activeCampuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </select>
      {value && (
        <p className="text-sm text-gray-500">
          {value.cityLabel} • {getDisplayAddress(value)}
        </p>
      )}
    </div>
  );
}
