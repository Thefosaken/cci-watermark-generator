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
      <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Campus</label>
      <div className="relative">
        <select
          value={value?.id || ''}
          onChange={(e) => {
            const selected = activeCampuses.find((c) => c.id === e.target.value);
            if (selected) onChange(selected);
          }}
          className="w-full h-10 md:h-11 px-3 appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-[15px] text-[var(--text)] focus:border-[var(--brand-red)] focus:ring-1 focus:ring-[var(--brand-red)] transition-all outline-none shadow-sm cursor-pointer"
        >
          <option value="" disabled>Select campus...</option>
          {activeCampuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      {value && (
        <p className="text-[13px] text-[var(--text-faint)] leading-relaxed">
          {value.cityLabel} <span className="mx-1.5 opacity-50">•</span> {getDisplayAddress(value)}
        </p>
      )}
    </div>
  );
}
