import campuses from '@/data/campuses.json';
import cellChurches from '@/data/cellChurches.json';
import cellChurchesInternational from '@/data/cellChurchesInternational.json';
import { WatermarkForm } from '@/components/WatermarkForm';
import { CciLogo } from '@/components/CciLogo';

const allCellChurches = [...cellChurches, ...cellChurchesInternational].sort((a, b) =>
  a.id.localeCompare(b.id),
);

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col selection:bg-[var(--brand-red-soft)] selection:text-[var(--brand-red)]">
      <header className="h-14 md:h-16 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="text-[var(--brand-red)]">
            <CciLogo width={72} height={35} />
          </div>
          <div className="w-[1px] h-5 bg-[var(--border)] hidden sm:block"></div>
          <h1 className="text-[14px] font-semibold text-[var(--text)] tracking-tight hidden sm:block">
            Watermark Generator
          </h1>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-2.5 py-1 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
             Internal Tool
           </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 md:p-8">
        <WatermarkForm campuses={campuses} cellChurches={allCellChurches} logoUrl="/cci-logo.svg" />
      </main>
    </div>
  );
}