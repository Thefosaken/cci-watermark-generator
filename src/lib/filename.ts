import { ServiceType } from '@/types/watermark';

/** Collapse runs of whitespace into a single hyphen for safe, readable filenames. */
function slug(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

export function generateFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape'
): string {
  return `${slug(campusName)}-${slug(topic)}-${orientation}.png`;
}

export function generateDocumentaryFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape'
): string {
  return `${slug(campusName)}-Documentary-${slug(topic)}-${orientation}.png`;
}
