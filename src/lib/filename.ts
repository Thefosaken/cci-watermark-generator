import { ServiceType } from '@/types/watermark';

/** Collapse runs of whitespace into a single hyphen for safe, readable filenames. */
function slug(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

export function generateFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape',
  serviceName?: string
): string {
  const name = serviceName ? `${campusName} ${serviceName}` : campusName;
  return `${slug(name)}-${slug(topic)}-${orientation}.png`;
}

export function generateDocumentaryFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape',
  serviceName?: string
): string {
  const prefix = serviceName
    ? `${slug(campusName)}-Documentary-${slug(serviceName)}`
    : `${slug(campusName)}-Documentary`;
  return `${prefix}-${slug(topic)}-${orientation}.png`;
}
