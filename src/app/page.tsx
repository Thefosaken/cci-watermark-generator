import campuses from '@/data/campuses.json';
import { WatermarkForm } from '@/components/WatermarkForm';

import { CciLogo } from '@/components/CciLogo';

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="bg-white">
        <header className="pt-10 pb-6 px-4">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <div className="mb-6">
              <CciLogo width={220} height={107} />
            </div>
            <h1 className="text-2xl font-semibold text-gray-800 tracking-wide">
              CCI Watermark Generator
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Create brand-consistent service watermarks for your campus
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <WatermarkForm campuses={campuses} logoUrl="/cci-logo.svg" />
          </div>
        </main>

        
      </div>
    </div>
  );
}