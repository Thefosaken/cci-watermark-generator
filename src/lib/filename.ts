import { ServiceType } from '@/types/watermark';

export function generateFilename(
  campusName: string,
  serviceType: ServiceType,
  topic: string,
  orientation: 'Portrait' | 'Landscape'
): string {
  const safeTopic = topic
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  
  const safeCampus = campusName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  
  const serviceTypeStr = serviceType === 'event' ? 'Special' : serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  
  return `CCI_${safeCampus}_${serviceTypeStr}_${safeTopic}_${orientation}.png`;
}