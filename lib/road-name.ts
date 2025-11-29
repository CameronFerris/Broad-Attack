import type { LocationGeocodedAddress } from 'expo-location';

const ROAD_KEYWORDS = [
  'road',
  'street',
  'avenue',
  'lane',
  'drive',
  'way',
  'boulevard',
  'highway',
  'route',
  'expressway',
  'motorway',
  'parkway',
  'circuit',
  'track',
  'speedway',
  'raceway',
  'causeway',
  'arterial',
  'turnpike',
  'pass',
  'trail',
].map((keyword) => keyword.toLowerCase());

const PRIVACY_BLOCKLIST = [
  'house',
  'cottage',
  'villa',
  'suite',
  'apartment',
  'apartments',
  'flat',
  'building',
  'residence',
  'bungalow',
  'manor',
  'lodge',
  'farm',
  'estate',
  'hall',
  'barn',
  'chalet',
  'homestead',
  'villa',
  'studio',
  'warehouse',
].map((keyword) => keyword.toLowerCase());

const ROUTE_CODE_PATTERNS = [
  /^I-?\d{1,3}[A-Z]?$/,
  /^US-?\d{1,3}$/,
  /^[A-Z]{1,2}\d{1,3}[A-Z]?$/,
  /^SR-?\d{1,3}$/,
  /^PR-?\d{1,3}$/,
  /^CR-?\d{1,3}$/,
  /^M\d{1,3}$/,
  /^A\d{1,3}$/,
  /^B\d{1,3}$/,
] as const;

const sanitizeSegment = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  let segment = value.split(',')[0]?.trim() ?? '';
  if (!segment) {
    return null;
  }
  segment = segment.replace(/^(?:no\.?|number|#)\s*/i, '');
  segment = segment.replace(/^[\s]*(\d+)(?!(st|nd|rd|th)\b)[A-Za-z]?\s*/i, '');
  segment = segment.replace(/\s+/g, ' ').trim();
  if (!segment) {
    return null;
  }
  const lower = segment.toLowerCase();
  if (PRIVACY_BLOCKLIST.some((term) => lower.includes(term))) {
    return null;
  }
  const hasRoadKeyword = ROAD_KEYWORDS.some((keyword) => lower.includes(keyword));
  const matchesRouteCode = segment
    .split(/\s+/)
    .some((token) => {
      const normalized = token.replace(/[()]/g, '').toUpperCase();
      return ROUTE_CODE_PATTERNS.some((pattern) => pattern.test(normalized));
    });
  if (!hasRoadKeyword && !matchesRouteCode) {
    return null;
  }
  return segment;
};

export const sanitizeRoadLabel = (value: string | null | undefined): string | null => sanitizeSegment(value);

export const getDisplayRoadName = (geocode: LocationGeocodedAddress): string => {
  const candidates = [
    geocode.street,
    geocode.name,
    geocode.district,
    geocode.subregion,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeSegment(candidate);
    if (sanitized) {
      return sanitized;
    }
  }
  return 'Unknown Road';
};
