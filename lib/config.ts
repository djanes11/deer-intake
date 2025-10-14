// lib/config.ts
/**
 * Public site config.
 * NOTE: Anything used by client components must come from NEXT_PUBLIC_* envs.
 */

const env = (k: string, d = '') =>
  (process.env[k] ?? '').toString().trim() || d;

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export const SITE = {
  name: 'McAfee Custom Deer Processing',

  // Address text the customer sees
  address: env('NEXT_PUBLIC_ADDRESS', '1234 County Rd, Louisville, KY'),

  // Optional explicit Google Maps URL (overrides lat/lng/address)
  mapsUrl: env('NEXT_PUBLIC_MAPS_URL', ''),

  // If you set both, we’ll prefer lat/lng for accuracy
  lat: num(env('NEXT_PUBLIC_LAT', '')),
  lng: num(env('NEXT_PUBLIC_LNG', '')),

  // Phone
  phone: env('NEXT_PUBLIC_PHONE_DISPLAY', '(502) 643-3916'),
  phoneE164: env('NEXT_PUBLIC_PHONE_E164', '+15026433916'),

  // Hours shown on status page (edit here or wire to env if you prefer)
  hours: [
    { label: 'Mon–Fri', value: '6–8 pm' },
    { label: 'Sat',     value: '9–5'    },
    { label: 'Sun',     value: '9–12'   },
  ],

  // Any other bits you already had…
} as const;
