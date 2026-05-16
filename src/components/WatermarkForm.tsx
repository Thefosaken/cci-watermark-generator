'use client';

import { useState, useRef, useEffect } from 'react';
import { ServiceType, Campus, WatermarkPayload } from '@/types/watermark';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { CampusSelector } from './CampusSelector';
import { renderWatermark, renderDocumentaryWatermark, loadImage } from '@/lib/drawWatermark';
import { generateFilename, generateDocumentaryFilename } from '@/lib/filename';
import { createDriveFolder, uploadDriveFile, delay, loadGisScript, requestDriveToken, showFolderPicker, getGoogleConfig, DriveError } from '@/lib/googleDrive';
import { ChromePicker } from 'react-color';

const PRESET_COLORS = [
  '#0000FF', '#D32126', '#000000', '#FFFFFF', 
  '#F5A623', '#7ED321', '#4A90E2', '#9013FE'
];

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
  const [eventBgColor, setEventBgColor] = useState('#0000ff');
  const [eventLogoScale, setEventLogoScale] = useState(100);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [landscapePreview, setLandscapePreview] = useState<string | null>(null);
  const [docPortraitPreview, setDocPortraitPreview] = useState<string | null>(null);
  const [docLandscapePreview, setDocLandscapePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, campusName: '' });
  const [lastAddressKey, setLastAddressKey] = useState('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveProgress, setDriveProgress] = useState({ current: 0, total: 0 });

  const logoRef = useRef<HTMLImageElement | null>(null);
  const eventLogoRef = useRef<HTMLImageElement | null>(null);
  // Pre-generated blobs for instant downloads (populated during handleGenerate)
  const portraitBlobRef = useRef<Blob | null>(null);
  const landscapeBlobRef = useRef<Blob | null>(null);
  const docPortraitBlobRef = useRef<Blob | null>(null);
  const docLandscapeBlobRef = useRef<Blob | null>(null);

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
    loadGisScript();
  }, []);

  // Allow the error modal to be dismissed with the Escape key.
  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setError(null);
        setShowErrorDetails(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [error]);

  // Reset the address field to the campus default whenever the campus or
  // service type changes. Adjusting state during render (React-recommended for
  // prop-derived state) avoids the extra cascading render an effect would cause.
  const addressKey = selectedCampus ? `${selectedCampus.id}|${serviceType}` : '';
  if (addressKey !== lastAddressKey) {
    setLastAddressKey(addressKey);
    if (selectedCampus) {
      let addr = selectedCampus.address;
      if (serviceType === 'midweek' && selectedCampus.midweekAddress) {
        addr = selectedCampus.midweekAddress;
      } else if (serviceType === 'sunday' && selectedCampus.sundayAddress) {
        addr = selectedCampus.sundayAddress;
      }
      setAddress(addr);
    }
  }

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
        eventBgColor,
        eventLogoScale,
      };

      let evtImg: HTMLImageElement | undefined;
      if (eventLogo) {
        evtImg = await loadImage(eventLogo);
        eventLogoRef.current = evtImg;
      }

      const [portrait, landscape, docPortrait, docLandscape] = await Promise.all([
        renderWatermark(payload, 'portrait', logoRef.current, evtImg),
        renderWatermark(payload, 'landscape', logoRef.current, evtImg),
        renderDocumentaryWatermark(payload, 'portrait', logoRef.current),
        renderDocumentaryWatermark(payload, 'landscape', logoRef.current),
      ]);

      setPortraitPreview(portrait.url);
      setLandscapePreview(landscape.url);
      setDocPortraitPreview(docPortrait.url);
      setDocLandscapePreview(docLandscape.url);
      // Pre-generate blobs now so all individual downloads are instant
      const toBlob = (c: HTMLCanvasElement): Promise<Blob> =>
        new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
      const [pBlob, lBlob, dpBlob, dlBlob] = await Promise.all([
        toBlob(portrait.canvas),
        toBlob(landscape.canvas),
        toBlob(docPortrait.canvas),
        toBlob(docLandscape.canvas),
      ]);
      portraitBlobRef.current = pBlob;
      landscapeBlobRef.current = lBlob;
      docPortraitBlobRef.current = dpBlob;
      docLandscapeBlobRef.current = dlBlob;
    } catch (err) {
      setError('Failed to generate watermark. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Live preview — regenerate when the event background colour or logo scale
  // changes. Declared after handleGenerate so it references a defined value.
  useEffect(() => {
    if (serviceType === 'event' && portraitPreview && !isGenerating && canGenerate) {
      const timer = setTimeout(() => {
        handleGenerate();
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBgColor, eventLogoScale]);

  // Helper — promisify canvas.toBlob
  const toBlob = (c: HTMLCanvasElement): Promise<Blob> =>
    new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));

  // Individual downloads use pre-cached blobs — instant click response
  const handleDownloadPortrait = async () => {
    if (!portraitBlobRef.current || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    saveAs(portraitBlobRef.current, generateFilename(selectedCampus.name, serviceType, topic, 'Portrait'));
  };

  const handleDownloadLandscape = async () => {
    if (!landscapeBlobRef.current || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    saveAs(landscapeBlobRef.current, generateFilename(selectedCampus.name, serviceType, topic, 'Landscape'));
  };

  const handleDownloadBoth = async () => {
    if (!portraitBlobRef.current || !landscapeBlobRef.current || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    saveAs(portraitBlobRef.current, generateFilename(selectedCampus.name, serviceType, topic, 'Portrait'));
    saveAs(landscapeBlobRef.current, generateFilename(selectedCampus.name, serviceType, topic, 'Landscape'));
  };

  const handleDownloadDocumentary = async () => {
    if (!docPortraitBlobRef.current || !docLandscapeBlobRef.current || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    saveAs(docPortraitBlobRef.current, generateDocumentaryFilename(selectedCampus.name, serviceType, topic, 'Portrait'));
    saveAs(docLandscapeBlobRef.current, generateDocumentaryFilename(selectedCampus.name, serviceType, topic, 'Landscape'));
  };

  const handleAddToZip = async () => {
    if (!portraitBlobRef.current || !landscapeBlobRef.current || !selectedCampus) return;
    const { saveAs } = await import('file-saver');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const normalFolder = zip.folder('Normal');
    const docFolder = zip.folder('Documentary');
    normalFolder?.file(generateFilename(selectedCampus.name, serviceType, topic, 'Portrait'), portraitBlobRef.current);
    normalFolder?.file(generateFilename(selectedCampus.name, serviceType, topic, 'Landscape'), landscapeBlobRef.current);
    if (docPortraitBlobRef.current) docFolder?.file(generateDocumentaryFilename(selectedCampus.name, serviceType, topic, 'Portrait'), docPortraitBlobRef.current);
    if (docLandscapeBlobRef.current) docFolder?.file(generateDocumentaryFilename(selectedCampus.name, serviceType, topic, 'Landscape'), docLandscapeBlobRef.current);
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${selectedCampus.name.replace(/\s/g, '')}-${topic.replace(/\s/g, '')}.zip`);
  };

  const handleDownloadAllCampuses = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic before downloading all campuses');
      return;
    }

    const activeCampuses = campuses.filter((campus) => {
      let addr = campus.address;
      if (serviceType === 'midweek' && campus.midweekAddress) {
        addr = campus.midweekAddress;
      } else if (serviceType === 'sunday' && campus.sundayAddress) {
        addr = campus.sundayAddress;
      }
      return campus.active && addr.trim();
    });

    if (activeCampuses.length === 0) {
      setError('No campuses with valid addresses found');
      return;
    }

    setError(null);
    setIsGeneratingAll(true);
    setProgress({ current: 0, total: activeCampuses.length, campusName: '' });

    try {
      if (!logoRef.current) {
        throw new Error('Logo not loaded');
      }

      const { saveAs } = await import('file-saver');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Batch parallel rendering — process BATCH_SIZE campuses simultaneously
      const BATCH_SIZE = 4;
      for (let i = 0; i < activeCampuses.length; i += BATCH_SIZE) {
        const batch = activeCampuses.slice(i, Math.min(i + BATCH_SIZE, activeCampuses.length));
        setProgress({ current: i + 1, total: activeCampuses.length, campusName: batch.map((c) => c.name).join(', ') });

        const batchResults = await Promise.all(
          batch.map(async (campus) => {
            let addr = campus.address;
            if (serviceType === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
            else if (serviceType === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;

            const payload: WatermarkPayload = {
              serviceType,
              topic: topic.trim(),
              campusName: campus.name,
              cityLabel: campus.cityLabel,
              address: addr.trim(),
              eventLogoUrl: eventLogo || undefined,
              eventBgColor,
              eventLogoScale,
            };

            const [portrait, landscape, docPortrait, docLandscape] = await Promise.all([
              renderWatermark(payload, 'portrait', logoRef.current!, undefined),
              renderWatermark(payload, 'landscape', logoRef.current!, undefined),
              renderDocumentaryWatermark(payload, 'portrait', logoRef.current!),
              renderDocumentaryWatermark(payload, 'landscape', logoRef.current!),
            ]);

            const [pBlob, lBlob, dpBlob, dlBlob] = await Promise.all([
              toBlob(portrait.canvas),
              toBlob(landscape.canvas),
              toBlob(docPortrait.canvas),
              toBlob(docLandscape.canvas),
            ]);

            return { campus, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        batchResults.forEach(({ campus, pBlob, lBlob, dpBlob, dlBlob }) => {
          const campusFolder = zip.folder(campus.name);
          const normalFolder = campusFolder?.folder('Service');
          const docFolder = campusFolder?.folder('Documentary');
          normalFolder?.file(generateFilename(campus.name, serviceType, topic.trim(), 'Portrait'), pBlob);
          normalFolder?.file(generateFilename(campus.name, serviceType, topic.trim(), 'Landscape'), lBlob);
          docFolder?.file(generateDocumentaryFilename(campus.name, serviceType, topic.trim(), 'Portrait'), dpBlob);
          docFolder?.file(generateDocumentaryFilename(campus.name, serviceType, topic.trim(), 'Landscape'), dlBlob);
        });

        setProgress({ current: i + batch.length, total: activeCampuses.length, campusName: batch[batch.length - 1].name });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      const topicSlug = topic.trim().replace(/\s+/g, '-');
      saveAs(content, `CCI_${topicSlug}_Watermark_${date}.zip`);
    } catch (err) {
      setError('Failed to generate all watermarks. Please try again.');
      console.error(err);
    } finally {
      setIsGeneratingAll(false);
      setShowDownloadMenu(false);
    }
  };

  const handleDriveExportAll = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic before exporting to Google Drive');
      return;
    }

    const activeCampuses = campuses.filter((campus) => {
      let addr = campus.address;
      if (serviceType === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
      else if (serviceType === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;
      return campus.active && addr.trim();
    });

    if (activeCampuses.length === 0) {
      setError('No campuses with valid addresses found');
      return;
    }

    setError(null);
    setIsGeneratingAll(true);

    try {
      // Fail fast with a clear message if the Google credentials are missing
      // from this build (they are baked in at build time on Vercel).
      const { clientId, apiKey } = getGoogleConfig();

      const accessToken = await requestDriveToken(clientId);

      setProgress({ current: 0, total: 0, campusName: 'Choose a destination folder...' });

      let folderId: string;
      try {
        folderId = await showFolderPicker(accessToken, apiKey);
      } catch (err) {
        // A deliberate cancel is a soft abort; anything else is a real failure
        // and keeps its explanatory message.
        if (err instanceof DriveError && err.userCancelled) {
          setError('Folder selection cancelled — export aborted.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not open the Drive folder picker.');
        }
        return;
      }

      setIsUploadingToDrive(true);

      const BATCH_SIZE = 4;
      const t = topic.trim();
      const st = serviceType;

      const batchResults: Array<{ campus: Campus; pBlob: Blob; lBlob: Blob; dpBlob: Blob; dlBlob: Blob }> = [];

      for (let i = 0; i < activeCampuses.length; i += BATCH_SIZE) {
        const batch = activeCampuses.slice(i, i + BATCH_SIZE);
        setProgress({ current: i + 1, total: activeCampuses.length, campusName: batch.map((c) => c.name).join(', ') });

        const results = await Promise.all(
          batch.map(async (campus) => {
            let addr = campus.address;
            if (st === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
            else if (st === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;

            const payload: WatermarkPayload = {
              serviceType: st,
              topic: t,
              campusName: campus.name,
              cityLabel: campus.cityLabel,
              address: addr.trim(),
              eventLogoUrl: eventLogo || undefined,
              eventBgColor,
              eventLogoScale,
            };

            const [portrait, landscape, docPortrait, docLandscape] = await Promise.all([
              renderWatermark(payload, 'portrait', logoRef.current!, undefined),
              renderWatermark(payload, 'landscape', logoRef.current!, undefined),
              renderDocumentaryWatermark(payload, 'portrait', logoRef.current!),
              renderDocumentaryWatermark(payload, 'landscape', logoRef.current!),
            ]);

            const [pBlob, lBlob, dpBlob, dlBlob] = await Promise.all([
              toBlob(portrait.canvas),
              toBlob(landscape.canvas),
              toBlob(docPortrait.canvas),
              toBlob(docLandscape.canvas),
            ]);

            return { campus, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        batchResults.push(...results);
        setProgress({ current: i + batch.length, total: activeCampuses.length, campusName: batch[batch.length - 1].name });
      }

      const date = new Date().toISOString().split('T')[0];
      const topicSlug = t.replace(/\s+/g, '-');
      const rootFolderName = `CCI_${topicSlug}_Watermark_${date}`;

      setProgress({ current: 1, total: 1, campusName: 'Creating folder in Google Drive...' });

      const rootId = await createDriveFolder(accessToken, rootFolderName, folderId);

      const totalFiles = batchResults.length * 4;
      let uploaded = 0;

      for (const { campus, pBlob, lBlob, dpBlob, dlBlob } of batchResults) {
        const campusId = await createDriveFolder(accessToken, campus.name, rootId);
        const [serviceId, docId] = await Promise.all([
          createDriveFolder(accessToken, 'Service', campusId),
          createDriveFolder(accessToken, 'Documentary', campusId),
        ]);

        await Promise.all([
          uploadDriveFile(accessToken, pBlob, generateFilename(campus.name, st, t, 'Portrait'), serviceId),
          uploadDriveFile(accessToken, lBlob, generateFilename(campus.name, st, t, 'Landscape'), serviceId),
          uploadDriveFile(accessToken, dpBlob, generateDocumentaryFilename(campus.name, st, t, 'Portrait'), docId),
          uploadDriveFile(accessToken, dlBlob, generateDocumentaryFilename(campus.name, st, t, 'Landscape'), docId),
        ]);

        uploaded += 4;
        setDriveProgress({ current: uploaded, total: totalFiles });
        setProgress({ current: uploaded, total: totalFiles, campusName: `Uploading ${campus.name}...` });

        await delay(200);
      }
    } catch (err) {
      let message = 'Google Drive export failed. Please try again.';
      if (err instanceof Error) message = err.message;
      setError(message);
      console.error('Drive export error:', err);
    } finally {
      setIsGeneratingAll(false);
      setIsUploadingToDrive(false);
      setShowDownloadMenu(false);
    }
  };

  const handleEventLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const dismissError = () => {
    setError(null);
    setShowErrorDetails(false);
  };

  // The first line of an error is its summary; any remaining lines are detail.
  const [errorSummary, ...errorRestLines] = (error ?? '').split('\n');
  const errorDetails = errorRestLines.join('\n').trim();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      {/* Left Column: Form Controls */}
      <div className="lg:col-span-5 xl:col-span-4 w-full bg-[var(--surface)] rounded-[16px] border border-[var(--border)] p-5 md:p-6 space-y-6">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--text)] tracking-tight mb-1">Generate Watermarks</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Fill in watermark details below</p>
        </div>

        <div className="h-px w-full bg-[var(--border)]" />

        <div className="space-y-5">
          <ServiceTypeSelector value={serviceType} onChange={setServiceType} />
          
          <CampusSelector
            campuses={campuses}
            value={selectedCampus}
            serviceType={serviceType}
            onChange={setSelectedCampus}
          />

          <div className="space-y-2">
            <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Topic / Theme</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter service topic..."
              className="w-full h-11 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-[15px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand-red)] focus:ring-[3px] focus:ring-[var(--brand-red)]/20 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Venue Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Input venue address..."
              className="w-full h-11 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] text-[15px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand-red)] focus:ring-[3px] focus:ring-[var(--brand-red)]/20 transition-all outline-none"
            />
          </div>

          {serviceType === 'event' && (
            <div className="space-y-5 border-t border-[var(--border)] pt-5 mt-5">
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Event Logo</label>
                <div className={`relative group cursor-pointer border border-dashed border-[var(--border-strong)] hover:border-[var(--brand-red)] rounded-[12px] transition-colors flex flex-col items-center justify-center bg-[var(--surface-subtle)] hover:bg-[var(--surface)] overflow-hidden ${eventLogo ? 'h-[140px] p-2' : 'p-4 min-h-[120px]'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEventLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title={eventLogo ? "Change event logo" : "Upload event logo"}
                  />
                  {eventLogo ? (
                    <div className="relative w-full h-full rounded-[8px] overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmIj48L3JlY3Q+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlNWU1Ij48L3JlY3Q+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU1ZTUiPjwvcmVjdD48L3N2Zz4=')]">
                      <div className="absolute inset-0 transition-colors" style={{ backgroundColor: eventBgColor }}></div>
                      <img src={eventLogo} alt="Event logo" className="relative z-0 w-full h-full object-contain p-2" style={{ transform: `scale(${eventLogoScale / 100})` }} />
                      <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[13px] font-medium">Click to change</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-faint)] group-hover:text-[var(--brand-red)] transition-colors mb-2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span className="text-[13px] font-medium text-[var(--text)]">Click or drag to upload</span>
                      <span className="text-[12px] text-[var(--text-faint)] mt-1">PNG or SVG</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Background</label>
                  <div 
                    className="flex items-center gap-3 h-11 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] cursor-pointer hover:border-[var(--brand-red)] transition-colors"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <div className="w-6 h-6 rounded-full border border-[var(--border-strong)] flex-shrink-0 shadow-inner" style={{ backgroundColor: eventBgColor }}></div>
                    <span className="text-[13px] text-[var(--text)] uppercase font-medium">{eventBgColor}</span>
                  </div>

                  {showColorPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => { setShowColorPicker(false); setShowAdvancedPicker(false); }}></div>
                      <div className="absolute left-0 top-[calc(100%+8px)] z-50 p-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] w-max animate-in fade-in zoom-in-95 duration-200">
                        {showAdvancedPicker ? (
                          <div className="flex flex-col gap-3">
                            <ChromePicker 
                              color={eventBgColor} 
                              onChange={(color) => setEventBgColor(color.hex)} 
                              disableAlpha={true}
                              styles={{ default: { picker: { boxShadow: 'none', background: 'transparent', width: '200px' } } }}
                            />
                            <button 
                              onClick={() => setShowAdvancedPicker(false)}
                              className="w-full py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                            >
                              Back to Presets
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-5 gap-2 mb-3 w-[196px]">
                              {PRESET_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => { setEventBgColor(c); setShowColorPicker(false); }}
                                  className={`w-full aspect-square rounded-[6px] border ${eventBgColor.toLowerCase() === c.toLowerCase() ? 'border-[var(--brand-red)] ring-2 ring-[var(--brand-red)]/20' : 'border-[var(--border)]'} shadow-inner hover:scale-105 active:scale-95 transition-all`}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                              <button 
                                onClick={() => setShowAdvancedPicker(true)}
                                className="relative w-full aspect-square rounded-[6px] cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center overflow-hidden border border-[var(--border)] shadow-inner"
                                title="Custom Color"
                              >
                                <div className="absolute inset-0 pointer-events-none" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}></div>
                                <div className="absolute inset-[3px] bg-[var(--surface)] rounded-full flex items-center justify-center shadow-sm pointer-events-none">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                  </svg>
                                </div>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 w-[196px]">
                              <span className="text-[12px] text-[var(--text-muted)] font-medium">HEX</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)]">#</span>
                                <input
                                  type="text"
                                  value={eventBgColor.replace('#', '')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                                    setEventBgColor(`#${val}`);
                                  }}
                                  className="w-full h-8 pl-5 pr-2 text-[13px] uppercase bg-[var(--surface-subtle)] border border-[var(--border)] rounded-[6px] focus:outline-none focus:border-[var(--brand-red)] transition-colors"
                                  placeholder="0000FF"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between h-[18px]">
                    <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Scale</label>
                    <span className="text-[12px] text-[var(--text-muted)] font-medium">{eventLogoScale}%</span>
                  </div>
                  <div className="flex items-center h-11">
                    <input
                      type="range"
                      min="10"
                      max="400"
                      value={eventLogoScale}
                      onChange={(e) => setEventLogoScale(Number(e.target.value))}
                      className="w-full accent-[var(--brand-red)]"
                      disabled={!eventLogo}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="w-full h-12 bg-[var(--brand-red)] text-white text-[15px] font-semibold rounded-[10px] hover:bg-[var(--brand-red-dark)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : 'Generate Preview'}
          </button>
        </div>
      </div>

      {/* Right Column: Preview Area */}
      <div className="lg:col-span-7 xl:col-span-8 w-full">
        {(!portraitPreview || !landscapePreview) ? (
          <div className="w-full h-[300px] lg:h-full min-h-[400px] border border-dashed border-[var(--border-strong)] rounded-[16px] flex flex-col items-center justify-center text-[var(--text-faint)] bg-[var(--surface-subtle)]/50 transition-all">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p className="text-[14px] font-medium text-[var(--text-muted)]">No preview generated yet</p>
            <p className="text-[13px] mt-1 text-[var(--text-faint)]">Fill out the configuration to view output.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-[var(--text)] tracking-tight">Output Preview</h3>
              <button
                onClick={() => setShowDownloadMenu(true)}
                className="h-9 px-4 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[13px] font-semibold rounded-[8px] hover:bg-[var(--surface-subtle)] active:scale-[0.97] transition-all flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download
              </button>
            </div>

            {/* Normal Watermarks */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Normal Watermark</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <div className="bg-[var(--surface)] p-4 rounded-[16px] border border-[var(--border)] flex flex-col group">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[var(--text)]">Portrait</h4>
                      <p className="text-[12px] text-[var(--text-muted)]">1080 × 1350 • 4:5</p>
                    </div>
                  </div>
                  <div className="relative w-full aspect-[4/5] rounded-[8px] overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmIj48L3JlY3Q+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlNWU1Ij48L3JlY3Q+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU1ZTUiPjwvcmVjdD48L3N2Zz4=')]">
                    <img src={portraitPreview} alt="Portrait preview" className="w-full h-full object-contain" />
                  </div>
                </div>

                <div className="bg-[var(--surface)] p-4 rounded-[16px] border border-[var(--border)] flex flex-col group">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[var(--text)]">Landscape</h4>
                      <p className="text-[12px] text-[var(--text-muted)]">1620 × 1080 • 3:2</p>
                    </div>
                  </div>
                  <div className="relative w-full aspect-[3/2] rounded-[8px] overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmIj48L3JlY3Q+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlNWU1Ij48L3JlY3Q+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU1ZTUiPjwvcmVjdD48L3N2Zz4=')]">
                    <img src={landscapePreview} alt="Landscape preview" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* Documentary Watermarks */}
            {docPortraitPreview && docLandscapePreview && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Documentary Watermark</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[11px] text-[var(--text-faint)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full border border-[var(--border)]">Transparent PNG</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <div className="bg-[var(--surface)] p-4 rounded-[16px] border border-[var(--border)] flex flex-col group">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[var(--text)]">Documentary Portrait</h4>
                        <p className="text-[12px] text-[var(--text-muted)]">1080 × 1350 • Overlay</p>
                      </div>
                    </div>
                    <div className="relative w-full aspect-[4/5] rounded-[8px] overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmIj48L3JlY3Q+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlNWU1Ij48L3JlY3Q+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU1ZTUiPjwvcmVjdD48L3N2Zz4=')]">
                      <img src={docPortraitPreview} alt="Documentary Portrait preview" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] p-4 rounded-[16px] border border-[var(--border)] flex flex-col group">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[var(--text)]">Documentary Landscape</h4>
                        <p className="text-[12px] text-[var(--text-muted)]">1620 × 1080 • Overlay</p>
                      </div>
                    </div>
                    <div className="relative w-full aspect-[3/2] rounded-[8px] overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZmZmIj48L3JlY3Q+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlNWU1Ij48L3JlY3Q+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU1ZTUiPjwvcmVjdD48L3N2Zz4=')]">
                      <img src={docLandscapePreview} alt="Documentary Landscape preview" className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal */}
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
                    className="relative w-full max-w-[320px] bg-[var(--surface)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] overflow-hidden animate-modal border border-[var(--border-strong)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--border)]">
                      <div>
                        <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text)]">Download Export</h3>
                        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Select preferred format</p>
                      </div>
                      <button 
                        onClick={() => setShowDownloadMenu(false)}
                        className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors active:scale-95"
                        aria-label="Close"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => { handleDownloadPortrait(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect>
                            <line x1="12" y1="18" x2="12.01" y2="18"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Portrait Only</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Optimized for stories</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => { handleDownloadLandscape(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Landscape Only</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Standard presentation</div>
                        </div>
                      </button>

                      <div className="h-px bg-[var(--border)] mx-3 my-1"></div>

                      <button
                        onClick={() => { handleDownloadBoth(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Both Formats</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Download separately</div>
                        </div>
                      </button>

                      <button
                        onClick={() => { handleAddToZip(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Archive to ZIP</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Compressed folder</div>
                        </div>
                      </button>

                      <div className="h-px bg-[var(--border)] mx-3 my-1"></div>

                      <button
                        onClick={() => { handleDownloadDocumentary(); setShowDownloadMenu(false); }}
                        disabled={!docPortraitPreview || !docLandscapePreview}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Documentary Only</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Transparent overlay PNGs</div>
                        </div>
                      </button>

                      <div className="h-px bg-[var(--border)] mx-3 my-1"></div>

                      <button
                        onClick={() => { handleDownloadAllCampuses(); }}
                        disabled={!topic.trim()}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">All Campuses (ZIP)</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Download for all {campuses.filter((c) => c.active).length} campuses</div>
                        </div>
                      </button>

                      <div className="h-px bg-[var(--border)] mx-3 my-1"></div>

                      <button
                        onClick={() => { handleDriveExportAll(); }}
                        disabled={!topic.trim()}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-[18px] h-[18px] flex items-center justify-center">
                          <img src="/google-drive-logo.svg" alt="Google Drive" className="w-full h-full" />
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">All Campuses (Google Drive)</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Export directly to your Drive</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Progress Modal */}
            {isGeneratingAll && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="w-full max-w-[320px] bg-[var(--surface)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-6 border border-[var(--border-strong)]">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-[var(--brand-red)] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isUploadingToDrive ? (
                      <>
                        <h3 className="text-[14px] font-semibold text-[var(--text)] mb-2">Uploading to Google Drive</h3>
                        <p className="text-[13px] text-[var(--text-muted)] mb-3">
                          {progress.campusName} ({driveProgress.current} of {driveProgress.total} files)
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-[14px] font-semibold text-[var(--text)] mb-2">Generating All Campuses</h3>
                        <p className="text-[13px] text-[var(--text-muted)] mb-3">
                          {progress.campusName} ({progress.current} of {progress.total})
                        </p>
                      </>
                    )}
                    <div className="w-full h-2 bg-[var(--surface-subtle)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--brand-red)] transition-all duration-300"
                        style={{ width: `${isUploadingToDrive ? (driveProgress.current / driveProgress.total) * 100 : (progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Modal */}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={dismissError}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-[360px] bg-[var(--surface)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-6 border border-[var(--border-strong)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--danger)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text)] text-center leading-relaxed">{errorSummary}</h3>

            {errorDetails && (
              <div className="mt-3">
                <button
                  onClick={() => setShowErrorDetails((v) => !v)}
                  className="block mx-auto text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showErrorDetails ? 'Hide details' : 'Show details'}
                </button>
                {showErrorDetails && (
                  <p className="mt-2 text-[12px] text-[var(--text-muted)] leading-relaxed whitespace-pre-line bg-[var(--surface-subtle)] rounded-[8px] p-3">
                    {errorDetails}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={dismissError}
              className="mt-5 w-full py-2.5 rounded-[8px] bg-[var(--brand-red)] text-white text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
