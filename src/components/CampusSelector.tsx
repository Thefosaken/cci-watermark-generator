'use client';

import { useState, useRef, useEffect } from 'react';
import { Campus, ServiceType } from '@/types/watermark';

interface CampusSelectorProps {
  campuses: Campus[];
  value: Campus | null;
  serviceType: ServiceType;
  onChange: (campus: Campus) => void;
}

export function CampusSelector({ campuses, value, serviceType, onChange }: CampusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCampuses = campuses.filter((c) => c.active);
  const filteredCampuses = activeCampuses.filter((c) => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.cityLabel.toLowerCase().includes(search.toLowerCase())
  );

  const getDisplayAddress = (campus: Campus) => {
    if (serviceType === 'midweek' && campus.midweekAddress) {
      return campus.midweekAddress;
    }
    if (serviceType === 'sunday' && campus.sundayAddress) {
      return campus.sundayAddress;
    }
    return campus.address;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Campus</label>
      
      <div 
        className={`w-full min-h-[44px] flex items-center justify-between px-3 bg-[var(--surface)] border ${
          isOpen 
            ? 'border-[var(--brand-red)] ring-[3px] ring-[var(--brand-red)]/50' 
            : 'border-[var(--border)] hover:border-[var(--border-strong)]'
        } rounded-[8px] text-[15px] cursor-pointer transition-all`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setSearch('');
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        <span className={value ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'}>
          {value ? value.name : 'Select campus...'}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input 
              ref={inputRef}
              type="text" 
              placeholder="Search campuses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--surface-subtle)] border border-transparent rounded-[6px] px-3 py-2 text-[14px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand-red)] focus:ring-[3px] focus:ring-[var(--brand-red)]/50 transition-all"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCampuses.length > 0 ? (
              filteredCampuses.map((campus) => (
                <div 
                  key={campus.id} 
                  className={`px-3 py-2.5 cursor-pointer flex flex-col hover:bg-[var(--surface-subtle)] border-l-2 ${
                    value?.id === campus.id 
                      ? 'border-[var(--brand-red)] bg-[var(--brand-red-soft)]/20' 
                      : 'border-transparent'
                  }`}
                  onClick={() => {
                    onChange(campus);
                    setIsOpen(false);
                  }}
                >
                  <span className="text-[14px] font-medium text-[var(--text)]">{campus.name}</span>
                  <span className="text-[12px] text-[var(--text-muted)] mt-0.5">{campus.cityLabel}</span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-[13px] text-[var(--text-muted)]">No campuses found</div>
            )}
          </div>
        </div>
      )}

      {value && (
        <p className="text-[13px] text-[var(--text-faint)] leading-relaxed">
          {value.cityLabel} <span className="mx-1.5 opacity-50">•</span> {getDisplayAddress(value)}
        </p>
      )}
    </div>
  );
}
