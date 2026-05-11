export type ServiceType = 'midweek' | 'sunday' | 'event';

export interface Campus {
  id: string;
  name: string;
  cityLabel: string;
  address: string;
  sundayAddress?: string;
  midweekAddress?: string;
  country?: string;
  region?: string;
  active: boolean;
}

export interface WatermarkPayload {
  serviceType: ServiceType;
  topic: string;
  campusName: string;
  cityLabel: string;
  address: string;
  eventLogoUrl?: string;
}

export interface WatermarkRenderResult {
  portraitBlob: Blob;
  landscapeBlob: Blob;
  portraitPreviewUrl: string;
  landscapePreviewUrl: string;
}
