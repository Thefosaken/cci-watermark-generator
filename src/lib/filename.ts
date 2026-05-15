import { ServiceType } from '@/types/watermark';

export function generateFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape'
): string {
  const safeTopic = topic.replace(/\s+/g, '');
  const safeCampus = campusName.replace(/\s+/g, '');
  return `${safeCampus}-${safeTopic}-${orientation}.png`;
}

export function generateDocumentaryFilename(
  campusName: string,
  _serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape'
): string {
  const safeTopic = topic.replace(/\s+/g, '');
  const safeCampus = campusName.replace(/\s+/g, '');
  return `${safeCampus}-Documentary-${safeTopic}-${orientation}.png`;
}