'use client';

import { useState, useRef, useEffect } from 'react';
import { ServiceType, Campus, WatermarkPayload } from '@/types/watermark';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { CampusSelector } from './CampusSelector';
import { renderWatermark, loadImage } from '@/lib/drawWatermark';
import { generateFilename } from '@/lib/filename';

interface WatermarkFormProps {
  campuses: Campus[];
  logoUrl: string;
}

export function WatermarkForm({ campuses, logoUrl }: WatermarkFormProps) {
  const [serviceType, setServiceType] = useState<ServiceType>('sunday');
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [topic, setTopic] = useState('');
  const [address, setAddress] = useState('');
  const [eventLogo, setEventLogo] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [landscapePreview, setLandscapePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const logoRef = useRef<HTMLImageElement | null>(null);
  const eventLogoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    loadImage(logoUrl)
      .then((img) => {
        logoRef.current = img;
        setLogoLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load logo:', err);
        setLogoLoaded(true);
      });
  }, [logoUrl]);

  useEffect(() => {
    if (selectedCampus) {
      let addr = selectedCampus.address;
      if (serviceType === 'midweek' && selectedCampus.midweekAddress) {
        addr = selectedCampus.midweekAddress;
      } else if (serviceType === 'sunday' && selectedCampus.sundayAddress) {
        addr = selectedCampus.sundayAddress;
      }
      setAddress(addr);
    }
  }, [selectedCampus, serviceType]);

  const canGenerate = selectedCampus && topic.trim() && logoLoaded;

  const handleGenerate = async () => {
    if (!selectedCampus || !topic.trim()) {
      setError('Please select a campus and enter a topic');
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      if (!logoRef.current) {
        throw new Error('Logo not loaded');
      }

      const payload: WatermarkPayload = {
        serviceType,
        topic: topic.trim(),
        campusName: selectedCampus.name,
        cityLabel: selectedCampus.cityLabel,
        address: address.trim(),
        eventLogoUrl: eventLogo || undefined,
      };

      let evtImg: HTMLImageElement | undefined;
      if (eventLogo) {
        evtImg = await loadImage(eventLogo);
        eventLogoRef.current = evtImg;
      }

      const [portrait, landscape] = await Promise.all([
        renderWatermark(payload, 'portrait', logoRef.current, evtImg),
        renderWatermark(payload, 'landscape', logoRef.current, evtImg),
      ]);

      setPortraitPreview(portrait.url);
      setLandscapePreview(landscape.url);
    } catch (err) {
      setError('Failed to generate watermark. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPortrait = async () => {
    if (!portraitPreview || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    const portraitBlob = await fetch(portraitPreview).then((r) => r.blob());
    const portraitName = generateFilename(selectedCampus.name, serviceType, topic, 'Portrait');
    saveAs(portraitBlob, portraitName);
  };

  const handleDownloadLandscape = async () => {
    if (!landscapePreview || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    const landscapeBlob = await fetch(landscapePreview).then((r) => r.blob());
    const landscapeName = generateFilename(selectedCampus.name, serviceType, topic, 'Landscape');
    saveAs(landscapeBlob, landscapeName);
  };

  const handleDownloadBoth = async () => {
    if (!portraitPreview || !landscapePreview || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    const portraitBlob = await fetch(portraitPreview).then((r) => r.blob());
    const landscapeBlob = await fetch(landscapePreview).then((r) => r.blob());
    const portraitName = generateFilename(selectedCampus.name, serviceType, topic, 'Portrait');
    const landscapeName = generateFilename(selectedCampus.name, serviceType, topic, 'Landscape');
    saveAs(portraitBlob, portraitName);
    saveAs(landscapeBlob, landscapeName);
  };

  const handleAddToZip = async () => {
    if (!portraitPreview || !landscapePreview || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    const JSZip = (await import('jszip')).default;
    const portraitBlob = await fetch(portraitPreview).then((r) => r.blob());
    const landscapeBlob = await fetch(landscapePreview).then((r) => r.blob());
    const portraitName = generateFilename(selectedCampus.name, serviceType, topic, 'Portrait');
    const landscapeName = generateFilename(selectedCampus.name, serviceType, topic, 'Landscape');
    const zip = new JSZip();
    zip.file(portraitName, portraitBlob);
    zip.file(landscapeName, landscapeBlob);
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `CCI_${selectedCampus.name.replace(/\s/g, '')}_${serviceType}_${topic.replace(/\s/g, '-')}.zip`);
  };

  const handleEventLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <ServiceTypeSelector value={serviceType} onChange={setServiceType} />
      
      <CampusSelector
        campuses={campuses}
        value={selectedCampus}
        serviceType={serviceType}
        onChange={setSelectedCampus}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Topic/Theme</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter service topic..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Venue address..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      {serviceType === 'event' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Event Logo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleEventLogoUpload}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !canGenerate}
        className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating...' : 'Generate Preview'}
      </button>

      {portraitPreview && landscapePreview && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Portrait</p>
              <img
                src={portraitPreview}
                alt="Portrait preview"
                className="w-full rounded-lg border"
              />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Landscape</p>
              <img
                src={landscapePreview}
                alt="Landscape preview"
                className="w-full rounded-lg border"
              />
            </div>
          </div>
          
            <button
              onClick={() => setShowDownloadMenu(true)}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-sm active:scale-[0.98] transition-all"
            >
              Download Options
            </button>
            
            {showDownloadMenu && (
              <>
                <style>{`
                  @keyframes backdrop-enter {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(4px); }
                  }
                  @keyframes modal-enter {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                  }
                  .animate-backdrop { animation: backdrop-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                  .animate-modal { animation: modal-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                `}</style>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div 
                    className="absolute inset-0 bg-black/40 animate-backdrop"
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  <div 
                    className="relative w-full max-w-sm bg-white rounded-[24px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden animate-modal border border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight text-gray-900">Download</h3>
                        <p className="text-sm text-gray-500 mt-1">Select your preferred format</p>
                      </div>
                      <button 
                        onClick={() => setShowDownloadMenu(false)}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
                        aria-label="Close"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-3 space-y-1">
                      <button
                        onClick={() => { handleDownloadPortrait(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-4 p-3 rounded-[16px] hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center group-hover:bg-white group-hover:shadow-sm group-hover:text-red-600 transition-all border border-transparent group-hover:border-gray-200">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Portrait Only</div>
                          <div className="text-xs text-gray-500 mt-0.5">Optimized for stories & mobile</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => { handleDownloadLandscape(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-4 p-3 rounded-[16px] hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center group-hover:bg-white group-hover:shadow-sm group-hover:text-red-600 transition-all border border-transparent group-hover:border-gray-200">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Landscape Only</div>
                          <div className="text-xs text-gray-500 mt-0.5">Standard presentation format</div>
                        </div>
                      </button>

                      <div className="h-px bg-gray-100 mx-4 my-2"></div>

                      <button
                        onClick={() => { handleDownloadBoth(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-4 p-3 rounded-[16px] hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center group-hover:bg-white group-hover:shadow-sm group-hover:text-gray-900 transition-all border border-transparent group-hover:border-gray-200">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Both Formats</div>
                          <div className="text-xs text-gray-500 mt-0.5">Download 2 separate images</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { handleAddToZip(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-4 p-3 rounded-[16px] hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center group-hover:bg-white group-hover:shadow-sm group-hover:text-gray-900 transition-all border border-transparent group-hover:border-gray-200">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Archive to ZIP</div>
                          <div className="text-xs text-gray-500 mt-0.5">Compressed folder with both</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
        </div>
      )}
    </div>
  );
}
