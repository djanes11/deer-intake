// lib/config.ts (only the additions shown)
const env = (k: string, d = '') =>
  (process.env[k] ?? '').toString().trim() || d;

export const SITE = {
  name: 'McAfee Custom Deer Processing',
  address: env('NEXT_PUBLIC_ADDRESS', '10977 Buffalo Trace Rd NW, Palmyra, IN 47164'),
  mapsUrl: env('NEXT_PUBLIC_MAPS_URL', ''),
  lat: Number(env('NEXT_PUBLIC_LAT', '')),
  lng: Number(env('NEXT_PUBLIC_LNG', '')),
  phone: env('NEXT_PUBLIC_PHONE_DISPLAY', '(502) 643-3916'),
  phoneE164: env('NEXT_PUBLIC_PHONE_E164', '+15026433916'),
  /** ADD THIS: */
  email: env('NEXT_PUBLIC_EMAIL', 'mcafeedeerprocessing@gmail.com'),
  hours: [
    { label: 'Mon–Fri', value: '6–8 pm' },
    { label: 'Sat',     value: '9–5'    },
    { label: 'Sun',     value: '9–12'   },
  ],
} as const;
