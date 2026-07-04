'use client';

import { useState, useRef, useEffect } from 'react';
import { ServiceType, Campus, CellChurch, WatermarkPayload, OrganizationType, EventAlign } from '@/types/watermark';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { CampusSelector } from './CampusSelector';
import { renderWatermark, renderDocumentaryWatermark, loadImage } from '@/lib/drawWatermark';
import { generateFilename, generateDocumentaryFilename } from '@/lib/filename';
import { resolveAddress } from '@/lib/resolveAddress';
import { createDriveFolder, uploadDriveFile, delay, loadGisScript, requestDriveToken, showFolderPicker, getGoogleConfig, DriveError } from '@/lib/googleDrive';
import { ChromePicker } from 'react-color';

const PRESET_COLORS = [
  '#0000FF', '#D32126', '#000000', '#FFFFFF', 
  '#F5A623', '#7ED321', '#4A90E2', '#9013FE'
];

const EVENT_ALIGN_ROTATIONS: Record<string, number | 'dot'> = {
  'top-left': 315,
  'top-center': 0,
  'top-right': 45,
  'center-left': 270,
  'center-center': 'dot',
  'center-right': 90,
  'bottom-left': 225,
  'bottom-center': 180,
  'bottom-right': 135,
};

interface WatermarkFormProps {
  campuses: Campus[];
  cellChurches: CellChurch[];
  logoUrl: string;
}

export function WatermarkForm({ campuses, cellChurches, logoUrl }: WatermarkFormProps) {
  const [organizationType, setOrganizationType] = useState<OrganizationType>('campus');
  const [serviceType, setServiceType] = useState<ServiceType>('sunday');
  const [selectedCampus, setSelectedCampus] = useState<Campus | CellChurch | null>(null);
  const [topic, setTopic] = useState('');
  const [address, setAddress] = useState('');
  const [eventLogo, setEventLogo] = useState<string | null>(null);
  const [eventBgImage, setEventBgImage] = useState<string | null>(null);
  const [eventBgColor, setEventBgColor] = useState('#0000ff');
  const [eventLogoScale, setEventLogoScale] = useState(100);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [landscapePreview, setLandscapePreview] = useState<string | null>(null);
  const [docPortraitPreview, setDocPortraitPreview] = useState<string | null>(null);
  const [docLandscapePreview, setDocLandscapePreview] = useState<string | null>(null);
  const [eventAlign, setEventAlign] = useState<EventAlign>('center-center');
  const [eventBoxColor, setEventBoxColor] = useState('#d71921');
  const [eventClipTop, setEventClipTop] = useState(true);
  const [eventPreviewTick, setEventPreviewTick] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<false | 'bg' | 'box'>(false);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, campusName: '' });
  const [lastAddressKey, setLastAddressKey] = useState('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveProgress, setDriveProgress] = useState({ current: 0, total: 0 });
  const [selectedCampusIds, setSelectedCampusIds] = useState<Set<string>>(new Set());
  const [showMultiSelectModal, setShowMultiSelectModal] = useState<'zip' | 'drive' | null>(null);
  const [multiSelectSearch, setMultiSelectSearch] = useState('');
  // Per-session manual address overrides for the multi-campus picker, keyed by
  // org id. Holds only the campuses the user actually edited; reset on open.
  const [addressOverrides, setAddressOverrides] = useState<Record<string, string>>({});

  const logoRef = useRef<HTMLImageElement | null>(null);
  const eventLogoRef = useRef<HTMLImageElement | null>(null);
  const eventBgImageRef = useRef<HTMLImageElement | null>(null);
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
  const addressKey = selectedCampus ? `${selectedCampus.id}|${serviceType}|${organizationType}` : '';
  if (addressKey !== lastAddressKey) {
    setLastAddressKey(addressKey);
    if (selectedCampus) {
      let addr = selectedCampus.address;
      if (organizationType === 'campus') {
        const campus = selectedCampus as Campus;
        if (serviceType === 'midweek' && campus.midweekAddress) {
          addr = campus.midweekAddress;
        } else if (serviceType === 'sunday' && campus.sundayAddress) {
          addr = campus.sundayAddress;
        }
      }
      setAddress(addr);
    }
  }

  const handleOrganizationTypeChange = (newType: OrganizationType) => {
    setSelectedCampus(null);
    setAddress('');
    setOrganizationType(newType);
    // Cell Church has no "Special Event" tab — always land on Midweek when
    // switching in, regardless of the previously selected service type.
    if (newType === 'cellChurch') {
      setServiceType('midweek');
    }
  };

  const canGenerate = selectedCampus && topic.trim() && logoLoaded;
  const showDocumentary = organizationType === 'campus';

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
        isCellChurch: organizationType === 'cellChurch',
        eventAlign,
        eventBoxColor,
        eventClipTop,
      };

      let evtImg: HTMLImageElement | undefined;
      if (eventLogo) {
        evtImg = await loadImage(eventLogo);
        eventLogoRef.current = evtImg;
      }

      let bgImg: HTMLImageElement | undefined;
      if (eventBgImage) {
        bgImg = await loadImage(eventBgImage);
        eventBgImageRef.current = bgImg;
      }

      const [portrait, landscape] = await Promise.all([
        renderWatermark(payload, 'portrait', logoRef.current, evtImg, bgImg),
        renderWatermark(payload, 'landscape', logoRef.current, evtImg, bgImg),
      ]);

      setPortraitPreview(portrait.url);
      setLandscapePreview(landscape.url);

      // Only generate documentary watermarks for campuses
      if (organizationType === 'campus') {
        const [docPortrait, docLandscape] = await Promise.all([
          renderDocumentaryWatermark(payload, 'portrait', logoRef.current),
          renderDocumentaryWatermark(payload, 'landscape', logoRef.current),
        ]);
        setDocPortraitPreview(docPortrait.url);
        setDocLandscapePreview(docLandscape.url);
      } else {
        setDocPortraitPreview(null);
        setDocLandscapePreview(null);
      }
      // Pre-generate blobs now so all individual downloads are instant
      const toBlob = (c: HTMLCanvasElement): Promise<Blob> =>
        new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
      const [pBlob, lBlob] = await Promise.all([
        toBlob(portrait.canvas),
        toBlob(landscape.canvas),
      ]);
      portraitBlobRef.current = pBlob;
      landscapeBlobRef.current = lBlob;

      // Only generate documentary blobs for campuses
      if (organizationType === 'campus') {
        const [docPortrait, docLandscape] = await Promise.all([
          renderDocumentaryWatermark(payload, 'portrait', logoRef.current),
          renderDocumentaryWatermark(payload, 'landscape', logoRef.current),
        ]);
        const [dpBlob, dlBlob] = await Promise.all([
          toBlob(docPortrait.canvas),
          toBlob(docLandscape.canvas),
        ]);
        docPortraitBlobRef.current = dpBlob;
        docLandscapeBlobRef.current = dlBlob;
      } else {
        docPortraitBlobRef.current = null;
        docLandscapeBlobRef.current = null;
      }
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
  }, [eventBgColor, eventLogoScale, eventBgImage, eventAlign, eventPreviewTick, eventBoxColor, eventClipTop]);

  // Helper — promisify canvas.toBlob
  const toBlob = (c: HTMLCanvasElement): Promise<Blob> =>
    new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));

  // Load the optional event-logo and background-image assets once per bulk
  // run so each per-campus render can reuse the decoded HTMLImageElement.
  const loadEventAssets = async (): Promise<{ evt?: HTMLImageElement; bg?: HTMLImageElement }> => {
    const evt = eventLogo ? await loadImage(eventLogo) : undefined;
    const bg = eventBgImage ? await loadImage(eventBgImage) : undefined;
    return { evt, bg };
  };

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
    const normalFolder = zip.folder('Service');
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
      setError(`Please enter a topic before downloading all ${organizationType === 'cellChurch' ? 'cell churches' : 'campuses'}`);
      return;
    }

    const isCellChurch = organizationType === 'cellChurch';
    const activeOrganizations = isCellChurch
      ? cellChurches.filter((cc) => cc.active && cc.address.trim())
      : campuses.filter((campus) => {
          let addr = campus.address;
          if (serviceType === 'midweek' && campus.midweekAddress) {
            addr = campus.midweekAddress;
          } else if (serviceType === 'sunday' && campus.sundayAddress) {
            addr = campus.sundayAddress;
          }
          return campus.active && addr.trim();
        });

    if (activeOrganizations.length === 0) {
      setError(`No ${isCellChurch ? 'cell churches' : 'campuses'} with valid addresses found`);
      return;
    }

    setError(null);
    setIsGeneratingAll(true);
    setProgress({ current: 0, total: activeOrganizations.length, campusName: '' });

    try {
      if (!logoRef.current) {
        throw new Error('Logo not loaded');
      }

      const { saveAs } = await import('file-saver');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const { evt, bg } = await loadEventAssets();

      const BATCH_SIZE = 4;
      for (let i = 0; i < activeOrganizations.length; i += BATCH_SIZE) {
        const batch = activeOrganizations.slice(i, Math.min(i + BATCH_SIZE, activeOrganizations.length));
        setProgress({ current: i + 1, total: activeOrganizations.length, campusName: batch.map((c) => c.name).join(', ') });

        const batchResults = await Promise.all(
          batch.map(async (org) => {
            let addr = org.address;
            if (!isCellChurch) {
              const campus = org as Campus;
              if (serviceType === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
              else if (serviceType === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;
            }

            const payload: WatermarkPayload = {
              serviceType,
              topic: topic.trim(),
              campusName: org.name,
              cityLabel: org.cityLabel,
              address: addr.trim(),
              eventLogoUrl: eventLogo || undefined,
              eventBgColor,
              eventLogoScale,
              isCellChurch,
              eventAlign,
              eventBoxColor,
              eventClipTop,
            };

            const [portrait, landscape] = await Promise.all([
              renderWatermark(payload, 'portrait', logoRef.current!, evt, bg),
              renderWatermark(payload, 'landscape', logoRef.current!, evt, bg),
            ]);

            const [pBlob, lBlob] = await Promise.all([
              toBlob(portrait.canvas),
              toBlob(landscape.canvas),
            ]);

            let dpBlob: Blob | null = null;
            let dlBlob: Blob | null = null;

            if (!isCellChurch) {
              const [docPortrait, docLandscape] = await Promise.all([
                renderDocumentaryWatermark(payload, 'portrait', logoRef.current!),
                renderDocumentaryWatermark(payload, 'landscape', logoRef.current!),
              ]);
              const [dp, dl] = await Promise.all([
                toBlob(docPortrait.canvas),
                toBlob(docLandscape.canvas),
              ]);
              dpBlob = dp;
              dlBlob = dl;
            }

            return { org, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        batchResults.forEach(({ org, pBlob, lBlob, dpBlob, dlBlob }) => {
          const orgFolder = zip.folder(org.name);
          const normalFolder = orgFolder?.folder('Service');
          normalFolder?.file(generateFilename(org.name, serviceType, topic.trim(), 'Portrait'), pBlob);
          normalFolder?.file(generateFilename(org.name, serviceType, topic.trim(), 'Landscape'), lBlob);
          
          if (dpBlob && dlBlob) {
            const docFolder = orgFolder?.folder('Documentary');
            docFolder?.file(generateDocumentaryFilename(org.name, serviceType, topic.trim(), 'Portrait'), dpBlob);
            docFolder?.file(generateDocumentaryFilename(org.name, serviceType, topic.trim(), 'Landscape'), dlBlob);
          }
        });

        setProgress({ current: i + batch.length, total: activeOrganizations.length, campusName: batch[batch.length - 1].name });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      const topicSlug = topic.trim().replace(/\s+/g, '-');
      const orgSlug = isCellChurch ? 'CellChurch' : 'Campus';
      saveAs(content, `CCI_${orgSlug}_${topicSlug}_Watermark_${date}.zip`);
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

    const isCellChurch = organizationType === 'cellChurch';
    const activeOrganizations = isCellChurch
      ? cellChurches.filter((cc) => cc.active && cc.address.trim())
      : campuses.filter((campus) => {
          let addr = campus.address;
          if (serviceType === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
          else if (serviceType === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;
          return campus.active && addr.trim();
        });

    if (activeOrganizations.length === 0) {
      setError(`No ${isCellChurch ? 'cell churches' : 'campuses'} with valid addresses found`);
      return;
    }

    setError(null);
    setIsGeneratingAll(true);

    try {
      const { clientId, apiKey } = getGoogleConfig();

      const accessToken = await requestDriveToken(clientId);

      setProgress({ current: 0, total: 0, campusName: 'Choose a destination folder...' });

      let folderId: string;
      try {
        folderId = await showFolderPicker(accessToken, apiKey);
      } catch (err) {
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

      const date = new Date().toISOString().split('T')[0];
      const topicSlug = t.replace(/\\s+/g, '-');
      const orgSlug = isCellChurch ? 'CellChurch' : 'Campus';
      const rootFolderName = `CCI_${orgSlug}_${topicSlug}_Watermark_${date}`;

      setProgress({ current: 1, total: 1, campusName: 'Creating folder in Google Drive...' });
      const rootId = await createDriveFolder(accessToken, rootFolderName, folderId);

      const totalFiles = activeOrganizations.length * (isCellChurch ? 2 : 4);
      let uploaded = 0;

      const { evt, bg } = await loadEventAssets();

      for (let i = 0; i < activeOrganizations.length; i += BATCH_SIZE) {
        const batch = activeOrganizations.slice(i, i + BATCH_SIZE);
        setProgress({ current: uploaded, total: totalFiles, campusName: `Generating ${batch.map((c) => c.name).join(', ')}...` });

        const results = await Promise.all(
          batch.map(async (org) => {
            let addr = org.address;
            if (!isCellChurch) {
              const campus = org as Campus;
              if (st === 'midweek' && campus.midweekAddress) addr = campus.midweekAddress;
              else if (st === 'sunday' && campus.sundayAddress) addr = campus.sundayAddress;
            }

            const payload: WatermarkPayload = { serviceType: st, topic: t, campusName: org.name, cityLabel: org.cityLabel, address: addr.trim(), eventLogoUrl: eventLogo || undefined, eventBgColor, eventLogoScale, isCellChurch, eventAlign, eventBoxColor, eventClipTop };
            const [portrait, landscape] = await Promise.all([renderWatermark(payload, 'portrait', logoRef.current!, evt, bg), renderWatermark(payload, 'landscape', logoRef.current!, evt, bg)]);
            const [pBlob, lBlob] = await Promise.all([toBlob(portrait.canvas), toBlob(landscape.canvas)]);
            let dpBlob: Blob | null = null; let dlBlob: Blob | null = null;
            if (!isCellChurch) {
              const [docPortrait, docLandscape] = await Promise.all([renderDocumentaryWatermark(payload, 'portrait', logoRef.current!), renderDocumentaryWatermark(payload, 'landscape', logoRef.current!)]);
              const [dp, dl] = await Promise.all([toBlob(docPortrait.canvas), toBlob(docLandscape.canvas)]);
              dpBlob = dp; dlBlob = dl;
            }
            return { org, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        for (const { org, pBlob, lBlob, dpBlob, dlBlob } of results) {
          setProgress({ current: uploaded, total: totalFiles, campusName: `Uploading ${org.name}...` });
          
          const orgId = await createDriveFolder(accessToken, org.name, rootId);
          const serviceId = await createDriveFolder(accessToken, 'Service', orgId);

          await Promise.all([uploadDriveFile(accessToken, pBlob, generateFilename(org.name, st, t, 'Portrait'), serviceId), uploadDriveFile(accessToken, lBlob, generateFilename(org.name, st, t, 'Landscape'), serviceId)]);
          uploaded += 2;

          if (dpBlob && dlBlob) {
            const docId = await createDriveFolder(accessToken, 'Documentary', orgId);
            await Promise.all([uploadDriveFile(accessToken, dpBlob, generateDocumentaryFilename(org.name, st, t, 'Portrait'), docId), uploadDriveFile(accessToken, dlBlob, generateDocumentaryFilename(org.name, st, t, 'Landscape'), docId)]);
            uploaded += 2;
          }

          setDriveProgress({ current: uploaded, total: totalFiles });
          await delay(200);
        }
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

  const handleEventBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventBgImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    // Reset so picking the same file again still fires onChange
    e.target.value = '';
  };

  const handleEventLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // The address an organisation will export with: the user's per-session manual
  // override if they edited it in the picker, otherwise the service-type default.
  const resolveExportAddress = (org: Campus | CellChurch): string => {
    const override = addressOverrides[org.id];
    return override !== undefined ? override : resolveAddress(org, serviceType, organizationType);
  };

  // Active, picker-selected organisations whose final (possibly overridden)
  // address is non-empty — the exact set that will be exported.
  const getSelectedOrganizations = (): (Campus | CellChurch)[] => {
    const all: (Campus | CellChurch)[] = organizationType === 'cellChurch' ? cellChurches : campuses;
    return all.filter((o) => o.active && selectedCampusIds.has(o.id) && resolveExportAddress(o).trim() !== '');
  };

  // Open the multi-campus picker with every eligible org pre-selected and a
  // fresh (empty) set of address overrides.
  const openMultiSelect = (mode: 'zip' | 'drive') => {
    const all: (Campus | CellChurch)[] = organizationType === 'cellChurch' ? cellChurches : campuses;
    const eligible = all.filter((o) => o.active && resolveAddress(o, serviceType, organizationType).trim() !== '');
    // A midweek campus export defaults to the campuses that run midweek
    // services; every other export defaults to all eligible organisations.
    const preselect =
      organizationType === 'campus' && serviceType === 'midweek'
        ? eligible.filter((o) => (o as Campus).hasMidweek)
        : eligible;
    setSelectedCampusIds(new Set(preselect.map((o) => o.id)));
    setAddressOverrides({});
    setMultiSelectSearch('');
    setShowMultiSelectModal(mode);
  };

  const closeMultiSelect = () => {
    setShowMultiSelectModal(null);
    setAddressOverrides({});
    setMultiSelectSearch('');
  };

  // Derived state for the multi-campus picker. Computed at component scope
  // (rather than in a render-time IIFE) so the modal's event handlers aren't
  // mistaken for render-time ref access by the react-hooks linter.
  const isCellChurch = organizationType === 'cellChurch';
  const multiSelectSource: (Campus | CellChurch)[] = isCellChurch ? cellChurches : campuses;
  const allOrgs = multiSelectSource.filter(
    (o) => o.active && resolveAddress(o, serviceType, organizationType).trim() !== '',
  );
  // A midweek campus export lists only the curated midweek campuses (plus any
  // already-selected campus) until the user searches — then the whole campus
  // list is searchable so any campus can be found and added.
  const midweekCampusMode = organizationType === 'campus' && serviceType === 'midweek';
  const multiSearchQuery = multiSelectSearch.trim().toLowerCase();
  const filteredOrgs = multiSearchQuery
    ? allOrgs.filter(
        (o) =>
          o.name.toLowerCase().includes(multiSearchQuery) ||
          o.cityLabel.toLowerCase().includes(multiSearchQuery),
      )
    : midweekCampusMode
      ? allOrgs.filter((o) => (o as Campus).hasMidweek || selectedCampusIds.has(o.id))
      : allOrgs;
  const allSelected = allOrgs.length > 0 && allOrgs.every((o) => selectedCampusIds.has(o.id));
  const selectedCount = allOrgs.filter((o) => selectedCampusIds.has(o.id)).length;
  const orgLabel = isCellChurch ? 'cell churches' : 'campuses';

  const toggleOne = (id: string) => {
    setSelectedCampusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedCampusIds(allSelected ? new Set() : new Set(allOrgs.map((o) => o.id)));
  };

  const handleDownloadSelectedCampuses = async () => {
    if (!topic.trim()) { setError('Please enter a topic before exporting'); return; }
    const isCellChurch = organizationType === 'cellChurch';
    const orgs = getSelectedOrganizations();
    if (orgs.length === 0) { setError('No campuses selected'); return; }

    setShowMultiSelectModal(null);
    setShowDownloadMenu(false);
    setError(null);
    setIsGeneratingAll(true);
    setProgress({ current: 0, total: orgs.length, campusName: '' });

    try {
      if (!logoRef.current) throw new Error('Logo not loaded');
      const { saveAs } = await import('file-saver');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const BATCH_SIZE = 4;

      const { evt, bg } = await loadEventAssets();

      for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
        const batch = orgs.slice(i, Math.min(i + BATCH_SIZE, orgs.length));
        setProgress({ current: i + 1, total: orgs.length, campusName: batch.map((c) => c.name).join(', ') });

        const batchResults = await Promise.all(
          batch.map(async (org) => {
            const addr = resolveExportAddress(org);
            const payload: WatermarkPayload = { serviceType, topic: topic.trim(), campusName: org.name, cityLabel: org.cityLabel, address: addr.trim(), eventLogoUrl: eventLogo || undefined, eventBgColor, eventLogoScale, isCellChurch, eventAlign, eventBoxColor, eventClipTop };
            const [portrait, landscape] = await Promise.all([renderWatermark(payload, 'portrait', logoRef.current!, evt, bg), renderWatermark(payload, 'landscape', logoRef.current!, evt, bg)]);
            const [pBlob, lBlob] = await Promise.all([toBlob(portrait.canvas), toBlob(landscape.canvas)]);
            let dpBlob: Blob | null = null; let dlBlob: Blob | null = null;
            if (!isCellChurch) {
              const [dp, dl] = await Promise.all([renderDocumentaryWatermark(payload, 'portrait', logoRef.current!), renderDocumentaryWatermark(payload, 'landscape', logoRef.current!)]);
              [dpBlob, dlBlob] = await Promise.all([toBlob(dp.canvas), toBlob(dl.canvas)]);
            }
            return { org, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        batchResults.forEach(({ org, pBlob, lBlob, dpBlob, dlBlob }) => {
          const orgFolder = zip.folder(org.name);
          const svcFolder = orgFolder?.folder('Service');
          svcFolder?.file(generateFilename(org.name, serviceType, topic.trim(), 'Portrait'), pBlob);
          svcFolder?.file(generateFilename(org.name, serviceType, topic.trim(), 'Landscape'), lBlob);
          if (dpBlob && dlBlob) {
            const docFolder = orgFolder?.folder('Documentary');
            docFolder?.file(generateDocumentaryFilename(org.name, serviceType, topic.trim(), 'Portrait'), dpBlob);
            docFolder?.file(generateDocumentaryFilename(org.name, serviceType, topic.trim(), 'Landscape'), dlBlob);
          }
        });
        setProgress({ current: i + batch.length, total: orgs.length, campusName: batch[batch.length - 1].name });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      saveAs(content, `CCI_Selected_${topic.trim().replace(/\s+/g, '-')}_Watermark_${date}.zip`);
    } catch (err) {
      setError('Failed to generate selected campuses. Please try again.');
      console.error(err);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleDriveExportSelected = async () => {
    if (!topic.trim()) { setError('Please enter a topic before exporting'); return; }
    const isCellChurch = organizationType === 'cellChurch';
    const orgs = getSelectedOrganizations();
    if (orgs.length === 0) { setError('No campuses selected'); return; }

    setShowMultiSelectModal(null);
    setShowDownloadMenu(false);
    setError(null);
    setIsGeneratingAll(true);

    try {
      if (!logoRef.current) throw new Error('Logo not loaded');
      const { clientId, apiKey } = getGoogleConfig();
      const accessToken = await requestDriveToken(clientId);

      setProgress({ current: 0, total: 0, campusName: 'Choose a destination folder...' });
      let folderId: string;
      try {
        folderId = await showFolderPicker(accessToken, apiKey);
      } catch (err) {
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

      const date = new Date().toISOString().split('T')[0];
      const rootFolderName = `CCI_Selected_${t.replace(/\\s+/g, '-')}_Watermark_${date}`;
      setProgress({ current: 1, total: 1, campusName: 'Creating folder in Google Drive...' });
      const rootId = await createDriveFolder(accessToken, rootFolderName, folderId);

      const totalFiles = orgs.length * (isCellChurch ? 2 : 4);
      let uploaded = 0;

      const { evt, bg } = await loadEventAssets();

      for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
        const batch = orgs.slice(i, i + BATCH_SIZE);
        setProgress({ current: uploaded, total: totalFiles, campusName: `Generating ${batch.map((c) => c.name).join(', ')}...` });

        const results = await Promise.all(
          batch.map(async (org) => {
            const addr = resolveExportAddress(org);
            const payload: WatermarkPayload = { serviceType: st, topic: t, campusName: org.name, cityLabel: org.cityLabel, address: addr.trim(), eventLogoUrl: eventLogo || undefined, eventBgColor, eventLogoScale, isCellChurch, eventAlign, eventBoxColor, eventClipTop };
            const [portrait, landscape] = await Promise.all([renderWatermark(payload, 'portrait', logoRef.current!, evt, bg), renderWatermark(payload, 'landscape', logoRef.current!, evt, bg)]);
            const [pBlob, lBlob] = await Promise.all([toBlob(portrait.canvas), toBlob(landscape.canvas)]);
            let dpBlob: Blob | null = null; let dlBlob: Blob | null = null;
            if (!isCellChurch) {
              const [dp, dl] = await Promise.all([renderDocumentaryWatermark(payload, 'portrait', logoRef.current!), renderDocumentaryWatermark(payload, 'landscape', logoRef.current!)]);
              [dpBlob, dlBlob] = await Promise.all([toBlob(dp.canvas), toBlob(dl.canvas)]);
            }
            return { org, pBlob, lBlob, dpBlob, dlBlob };
          })
        );

        for (const { org, pBlob, lBlob, dpBlob, dlBlob } of results) {
          setProgress({ current: uploaded, total: totalFiles, campusName: `Uploading ${org.name}...` });
          const orgId = await createDriveFolder(accessToken, org.name, rootId);
          const serviceId = await createDriveFolder(accessToken, 'Service', orgId);
          await Promise.all([uploadDriveFile(accessToken, pBlob, generateFilename(org.name, st, t, 'Portrait'), serviceId), uploadDriveFile(accessToken, lBlob, generateFilename(org.name, st, t, 'Landscape'), serviceId)]);
          uploaded += 2;
          if (dpBlob && dlBlob) {
            const docId = await createDriveFolder(accessToken, 'Documentary', orgId);
            await Promise.all([uploadDriveFile(accessToken, dpBlob, generateDocumentaryFilename(org.name, st, t, 'Portrait'), docId), uploadDriveFile(accessToken, dlBlob, generateDocumentaryFilename(org.name, st, t, 'Landscape'), docId)]);
            uploaded += 2;
          }
          setDriveProgress({ current: uploaded, total: totalFiles });
          await delay(200);
        }
      }
    } catch (err) {
      let message = 'Google Drive export failed. Please try again.';
      if (err instanceof Error) message = err.message;
      setError(message);
      console.error('Drive export error:', err);
    } finally {
      setIsGeneratingAll(false);
      setIsUploadingToDrive(false);
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
          <ServiceTypeSelector value={serviceType} onChange={setServiceType} organizationType={organizationType} />
          
          {/* Organization Type Switch */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Cell Church</span>
            <button
              type="button"
              onClick={() => handleOrganizationTypeChange(organizationType === 'campus' ? 'cellChurch' : 'campus')}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                organizationType === 'cellChurch' ? 'bg-[var(--brand-red)]' : 'bg-[var(--border)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  organizationType === 'cellChurch' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          <CampusSelector
            campuses={campuses}
            cellChurches={cellChurches}
            value={selectedCampus}
            serviceType={serviceType}
            organizationType={organizationType}
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
                      <div className="pointer-events-none absolute inset-0 z-10 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Logo Position</label>
                <div className="grid grid-cols-3 gap-1 w-fit mx-auto">
                  {(Object.keys(EVENT_ALIGN_ROTATIONS) as EventAlign[]).map((value) => {
                    const rotation = EVENT_ALIGN_ROTATIONS[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setEventAlign(value); setEventPreviewTick(t => t + 1); }}
                        className={`relative w-10 h-10 flex items-center justify-center rounded-[8px] border transition-all duration-150 active:scale-90 ${
                          eventAlign === value
                            ? 'bg-[var(--brand-red)] border-[var(--brand-red)] text-white shadow-[0_0_0_2px_var(--brand-red)_inset]'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand-red)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        {rotation === 'dot' ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="8" r="3.5" />
                          </svg>
                        ) : (
                          <svg
                            width="16" height="16" viewBox="0 0 16 16" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: `rotate(${rotation}deg)` }}
                          >
                            <line x1="8" y1="13" x2="8" y2="3" />
                            <polyline points="3 8 8 3 13 8" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Box & Strip Color</label>
                <div className="flex items-center gap-3 h-11 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] hover:border-[var(--brand-red)] transition-colors">
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(showColorPicker ? false : 'box')}
                    className="w-6 h-6 rounded-full border border-[var(--border-strong)] flex-shrink-0 shadow-inner cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: eventBoxColor }}
                    title="Open box colour picker"
                    aria-label="Open box colour picker"
                  />
                  <input
                    type="text"
                    value={eventBoxColor}
                    onChange={(e) => {
                      let val = e.target.value;
                      val = val.startsWith('#') ? val.slice(1) : val;
                      val = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setEventBoxColor('#' + val);
                    }}
                    className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text)] uppercase font-medium focus:outline-none"
                    spellCheck={false}
                    maxLength={7}
                  />
                </div>

                {showColorPicker === 'box' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowColorPicker(false); setShowAdvancedPicker(false); }}></div>
                    <div className="absolute left-0 top-[calc(100%+8px)] z-50 p-3 bg-[var(--surface)] border border-[var(--border-strong)] rounded-[12px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] w-max animate-in fade-in zoom-in-95 duration-200">
                      {showAdvancedPicker ? (
                        <div className="flex flex-col gap-3">
                          <ChromePicker
                            color={eventBoxColor}
                            onChange={(color) => setEventBoxColor(color.hex)}
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
                                onClick={() => { setEventBoxColor(c); setShowColorPicker(false); }}
                                className={`w-full aspect-square rounded-[6px] border ${eventBoxColor.toLowerCase() === c.toLowerCase() ? 'border-[var(--brand-red)] ring-2 ring-[var(--brand-red)]/20' : 'border-[var(--border)]'} shadow-inner hover:scale-105 active:scale-95 transition-all`}
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
                                value={eventBoxColor.replace('#', '')}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                                  setEventBoxColor(`#${val}`);
                                }}
                                className="w-full h-8 pl-5 pr-2 text-[13px] uppercase bg-[var(--surface-subtle)] border border-[var(--border)] rounded-[6px] focus:outline-none focus:border-[var(--brand-red)] transition-colors"
                                placeholder="d71921"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Background</label>
                  <div className="flex items-center gap-3 h-11 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] hover:border-[var(--brand-red)] transition-colors">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(showColorPicker === 'bg' ? false : 'bg')}
                      className="w-6 h-6 rounded-full border border-[var(--border-strong)] flex-shrink-0 shadow-inner cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: eventBgColor }}
                      title="Open colour picker"
                      aria-label="Open colour picker"
                    />
                    <input
                      type="text"
                      value={eventBgColor}
                      onChange={(e) => {
                        let val = e.target.value;
                        val = val.startsWith('#') ? val.slice(1) : val;
                        val = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                        setEventBgColor('#' + val);
                      }}
                      className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text)] uppercase font-medium focus:outline-none"
                      spellCheck={false}
                      maxLength={7}
                    />
                  </div>

                  {showColorPicker === 'bg' && (
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

              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Clip Logo Container Top</span>
                  <p className="text-[11px] text-[var(--text-faint)] mt-0.5">When off, logo can extend above the container top edge</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEventClipTop(!eventClipTop)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                    eventClipTop ? 'bg-[var(--brand-red)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      eventClipTop ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Background Image (Optional)</label>
                <div className="relative group border border-dashed border-[var(--border-strong)] hover:border-[var(--brand-red)] rounded-[12px] transition-colors bg-[var(--surface-subtle)] hover:bg-[var(--surface)] overflow-hidden h-[60px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEventBgImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title={eventBgImage ? "Change background image" : "Upload background image"}
                  />
                  {eventBgImage ? (
                    <div className="flex items-center gap-3 px-3 h-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={eventBgImage} alt="Background" className="h-10 w-16 object-cover rounded-[6px] border border-[var(--border)]" />
                      <span className="text-[12px] text-[var(--text-muted)] flex-1">Overrides solid colour</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEventBgImage(null); }}
                        className="relative z-20 w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] hover:border-[var(--brand-red)] flex items-center justify-center transition-colors flex-shrink-0"
                        title="Remove background image"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 h-full text-[var(--text-muted)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span className="text-[13px] font-medium">Click to upload background image</span>
                    </div>
                  )}
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

            {/* Service Watermarks */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Service Watermark</span>
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

                      {showDocumentary && (
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
                      )}

                      {showDocumentary && <div className="h-px bg-[var(--border)] mx-3 my-1"></div>}

                      <button
                        onClick={() => openMultiSelect('zip')}
                        disabled={!topic.trim()}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Campuses (ZIP)</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Export all or select specific {organizationType === 'cellChurch' ? 'cell churches' : 'campuses'}</div>
                        </div>
                      </button>

                      <div className="h-px bg-[var(--border)] mx-3 my-1"></div>

                      <button
                        onClick={() => openMultiSelect('drive')}
                        disabled={!topic.trim()}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[6px] hover:bg-[var(--surface-subtle)] active:scale-[0.98] transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-[18px] h-[18px] flex items-center justify-center">
                          <img src="/google-drive-logo.svg" alt="Google Drive" className="w-full h-full" />
                        </div>
                        <div>
                          <div className="font-medium text-[13px] text-[var(--text)]">Campuses (Google Drive)</div>
                          <div className="text-[12px] text-[var(--text-muted)]">Export all or select specific {organizationType === 'cellChurch' ? 'cell churches' : 'campuses'}</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Multi-Campus Selection Modal */}
            {showMultiSelectModal && (
                <>
                  <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
                    onClick={closeMultiSelect}
                  >
                    <div
                      className="relative w-full max-w-[400px] bg-[var(--surface)] rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden border border-[var(--border-strong)] animate-modal"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--border)]">
                        <div>
                          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text)]">Select {isCellChurch ? 'Cell Churches' : 'Campuses'}</h3>
                          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{selectedCount} of {allOrgs.length} selected</p>
                        </div>
                        <button
                          onClick={closeMultiSelect}
                          className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors active:scale-95"
                          aria-label="Close"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>

                      {/* Search + Select All */}
                      <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-[var(--border)]">
                        <div className="relative flex-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          <input
                            type="text"
                            placeholder={`Search ${orgLabel}...`}
                            value={multiSelectSearch}
                            onChange={(e) => setMultiSelectSearch(e.target.value)}
                            className="w-full h-9 pl-8 pr-3 bg-[var(--surface-subtle)] border border-transparent rounded-[8px] text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand-red)] focus:ring-[2px] focus:ring-[var(--brand-red)]/20 transition-all"
                          />
                        </div>
                        <button
                          onClick={toggleAll}
                          className="shrink-0 h-9 px-3 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface-subtle)] border border-[var(--border)] rounded-[8px] hover:border-[var(--brand-red)] transition-all active:scale-95"
                        >
                          {allSelected ? 'None' : 'All'}
                        </button>
                      </div>

                      {/* Midweek default hint */}
                      {midweekCampusMode && !multiSearchQuery && (
                        <div className="px-4 py-2 text-[11px] leading-relaxed text-[var(--text-muted)] bg-[var(--surface-subtle)] border-b border-[var(--border)]">
                          Showing the campuses that run midweek services — search to add any other campus.
                        </div>
                      )}

                      {/* Campus list */}
                      <div className="max-h-[280px] overflow-y-auto py-1">
                        {filteredOrgs.length > 0 ? filteredOrgs.map((org) => {
                          const checked = selectedCampusIds.has(org.id);
                          const defaultAddr = resolveAddress(org, serviceType, organizationType);
                          const currentAddr = addressOverrides[org.id] ?? defaultAddr;
                          const addrEdited = addressOverrides[org.id] !== undefined && addressOverrides[org.id] !== defaultAddr;
                          return (
                            <div
                              key={org.id}
                              className="px-4 py-2 transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              <div
                                className="flex items-center gap-3 cursor-pointer py-0.5"
                                onClick={() => toggleOne(org.id)}
                              >
                                <span
                                  className={`w-4 h-4 shrink-0 rounded-[4px] border flex items-center justify-center transition-colors ${
                                    checked
                                      ? 'bg-[var(--brand-red)] border-[var(--brand-red)]'
                                      : 'border-[var(--border-strong)] bg-[var(--surface)]'
                                  }`}
                                >
                                  {checked && (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-[var(--text)] truncate flex items-center gap-1.5">
                                    {org.name}
                                    {addrEdited && (
                                      <span
                                        className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--brand-red)]"
                                        title="Address edited for this export"
                                      />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-muted)] truncate">{org.cityLabel}</div>
                                </div>
                              </div>
                              {checked && (
                                <div
                                  className="flex items-center gap-1 mt-1 pl-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--text-faint)]">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                  </svg>
                                  <input
                                    type="text"
                                    value={currentAddr}
                                    onChange={(e) => setAddressOverrides((prev) => ({ ...prev, [org.id]: e.target.value }))}
                                    placeholder="Venue address..."
                                    title="Edit the venue address used for this campus in this export"
                                    className="flex-1 min-w-0 bg-transparent text-[11px] text-[var(--text-muted)] px-1.5 py-1 rounded-[5px] border border-transparent hover:border-[var(--border)] focus:border-[var(--brand-red)] focus:bg-[var(--surface)] focus:text-[var(--text)] outline-none transition-colors"
                                  />
                                  {addrEdited && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAddressOverrides((prev) => {
                                          const next = { ...prev };
                                          delete next[org.id];
                                          return next;
                                        })
                                      }
                                      title="Reset to default address"
                                      className="shrink-0 p-1 text-[var(--text-faint)] hover:text-[var(--brand-red)] transition-colors active:scale-90"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="1 4 1 10 7 10"></polyline>
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">No {orgLabel} found</div>
                        )}
                      </div>

                      {/* Footer CTA */}
                      <div className="px-4 pb-4 pt-3 border-t border-[var(--border)]">
                        <button
                          onClick={() => {
                            if (showMultiSelectModal === 'zip') handleDownloadSelectedCampuses();
                            else handleDriveExportSelected();
                          }}
                          disabled={selectedCount === 0}
                          className="w-full h-10 bg-[var(--brand-red)] text-white text-[13px] font-semibold rounded-[8px] hover:bg-[var(--brand-red-dark)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {showMultiSelectModal === 'drive' ? (
                            <img src="/google-drive-logo.svg" alt="" className="w-4 h-4 brightness-0 invert" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          )}
                          {selectedCount === 0
                            ? `Select ${orgLabel} to export`
                            : `Export ${selectedCount} ${selectedCount === 1 ? orgLabel.slice(0, -1) : orgLabel} ${showMultiSelectModal === 'drive' ? 'to Drive' : '(ZIP)'}`
                          }
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
