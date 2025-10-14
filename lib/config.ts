// lib/config.ts
const env = (k: string, d = '') => (process.env[k] ?? '').toString().trim() || d;
const num = (k: string) => {
  const v = parseFloat((process.env[k] ?? '').toString().trim());
  return Number.isFinite(v) ? v : NaN;
};

// Optional explicit maps URL. If not set, we’ll build one.
const EXPLICIT_MAPS = env('NEXT_PUBLIC_MAPS_URL', '');

// Address + coordinates you configured in Vercel
const ADDRESS = env('NEXT_PUBLIC_ADDRESS', '10977 Buffalo Trace Rd, Palmyra, IN 47164');
const LAT = num('NEXT_PUBLIC_LAT');     // e.g. 38.358984
const LNG = num('NEXT_PUBLIC_LNG');     // e.g. -86.134796

// Phones
const PHONE_DISPLAY = env('NEXT_PUBLIC_PHONE_DISPLAY', '(502) 643-3916');
const PHONE_E164    = env('NEXT_PUBLIC_PHONE_E164', '+15026433916'); // +1… format recommended

// Build a stable Google Maps URL. Priority: explicit → lat/lng → address.
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
  name: 'McAfee Custom Deer Processing',
  address: ADDRESS,
  lat: LAT,
  lng: LNG,
  phone: PHONE_DISPLAY,
  phoneE164: PHONE_E164,
  mapsUrl: buildMapsUrl(EXPLICIT_MAPS, LAT, LNG, ADDRESS),
  hours: [
    { label: 'Mon–Fri', value: '6–8 pm' },
    { label: 'Sat',     value: '9–5'    },
    { label: 'Sun',     value: '9–12'   },
  ] as const,
} as const;

// Clean “tap-to-call” href (prefers E.164, falls back to stripped display)
export const phoneHref =
  SITE.phoneE164 && SITE.phoneE164.startsWith('+')
    ? `tel:${SITE.phoneE164}`
    : `tel:${(SITE.phone || '').replace(/\D+/g, '')}`;
