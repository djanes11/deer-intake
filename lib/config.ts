// lib/config.ts
const env = (k: string, d = '') => (process.env[k] ?? '').toString().trim() || d;
const num = (k: string) => {
  const v = parseFloat((process.env[k] ?? '').toString().trim());
  return Number.isFinite(v) ? v : NaN;
};

// Optional explicit maps URL. If not set, we'll build one.
const EXPLICIT_MAPS = env('NEXT_PUBLIC_MAPS_URL', '');

// Address + coordinates you configured in Vercel
const ADDRESS = env('NEXT_PUBLIC_ADDRESS', '10977 Buffalo Trace Rd, Palmyra, IN 47164');
const LAT = num('NEXT_PUBLIC_LAT');
const LNG = num('NEXT_PUBLIC_LNG');

// Phones / branding
const PHONE_DISPLAY = env('NEXT_PUBLIC_PHONE_DISPLAY', '(502) 643-3916');
const PHONE_E164 = env('NEXT_PUBLIC_PHONE_E164', '+15026433916');
const SITE_NAME = env('NEXT_PUBLIC_SITE_NAME', 'Game Butcher Board');
const LOGO_URL = env('NEXT_PUBLIC_LOGO_SRC', '/wgbb-logo.png');
const LOCATION_LABEL = env('NEXT_PUBLIC_LOCATION_LABEL', 'Palmyra, IN');
const PUBLIC_TAGLINE = env('NEXT_PUBLIC_PUBLIC_TAGLINE', 'Wild game intake, tracking, and processor operations in one place.');

function buildMapsUrl(explicit: string, lat: number, lng: number, address: string) {
  if (explicit) return explicit;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps';
}

export const SITE = {
  name: SITE_NAME,
  locationLabel: LOCATION_LABEL,
  publicTagline: PUBLIC_TAGLINE,
  logoUrl: LOGO_URL,
  address: ADDRESS,
  lat: LAT,
  lng: LNG,
  phone: PHONE_DISPLAY,
  phoneE164: PHONE_E164,
  mapsUrl: buildMapsUrl(EXPLICIT_MAPS, LAT, LNG, ADDRESS),
  hours: [
    { label: 'Mon-Fri', value: '6-8 pm' },
    { label: 'Sat', value: '9-5' },
    { label: 'Sun', value: '9-12' },
  ] as const,
} as const;

export const phoneHref =
  SITE.phoneE164 && SITE.phoneE164.startsWith('+')
    ? `tel:${SITE.phoneE164}`
    : `tel:${(SITE.phone || '').replace(/\D+/g, '')}`;
