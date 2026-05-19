import { Campus, CellChurch, ServiceType, OrganizationType } from '@/types/watermark';

/**
 * Resolves the venue address for an organization, applying the service-type
 * fallback: Sunday uses `sundayAddress`, Midweek uses `midweekAddress`, and
 * everything else falls back to the default `address`. Cell churches only ever
 * carry a single `address`.
 *
 * This is the single source of truth for that fallback — previously it was
 * hand-duplicated across the form and both bulk exports.
 */
export function resolveAddress(
  org: Campus | CellChurch,
  serviceType: ServiceType,
  organizationType: OrganizationType,
): string {
  if (organizationType === 'cellChurch') {
    return org.address;
  }
  const campus = org as Campus;
  if (serviceType === 'midweek' && campus.midweekAddress) {
    return campus.midweekAddress;
  }
  if (serviceType === 'sunday' && campus.sundayAddress) {
    return campus.sundayAddress;
  }
  return campus.address;
}
