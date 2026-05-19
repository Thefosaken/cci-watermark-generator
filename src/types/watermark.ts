export type ServiceType = 'midweek' | 'sunday' | 'event';

export type OrganizationType = 'campus' | 'cellChurch';

export interface Campus {
  id: string;
  name: string;
  cityLabel: string;
  address: string;
  sundayAddress?: string;
  midweekAddress?: string;
  hasMidweek?: boolean;
  country?: string;
  region?: string;
  active: boolean;
}

export interface CellChurch {
  id: string;
  name: string;
  cityLabel: string;
  address: string;
  active: boolean;
}

export interface WatermarkPayload {
  serviceType: ServiceType;
  topic: string;
  campusName: string;
  cityLabel: string;
  address: string;
  eventLogoUrl?: string;
  eventBgColor?: string;
  eventLogoScale?: number;
  isCellChurch?: boolean;
}

export interface WatermarkRenderResult {
  portraitBlob: Blob;
  landscapeBlob: Blob;
  portraitPreviewUrl: string;
  landscapePreviewUrl: string;
}
