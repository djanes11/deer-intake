import 'server-only';

import { SITE } from '@/lib/config';
import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function HoursPage() {
  const settings = await getPublicSiteSettings();
  const tel = SITE.phoneE164 || (SITE.phone ? `tel:${String(SITE.phone).replace(/\D+/g, '')}` : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main>
      <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Season Pickup Hours</h1>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {settings.hours.map((h) => (
            <li
              key={`${h.label}:${h.value}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                border: '1px solid #1f2937',
                borderRadius: 10,
                padding: '10px 12px',
                background: '#0b0f12',
                color: '#e5e7eb',
                fontWeight: 700,
              }}
            >
              <span>{h.label}</span>
              <span style={{ fontWeight: 800 }}>{h.value}</span>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 14,
            border: '1px solid #1f2937',
            borderRadius: 10,
            padding: '10px 12px',
            background: '#0b0f12',
            color: '#e5e7eb',
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <b>Address:</b>{' '}
            <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
              {SITE.address}
            </a>
          </div>
          <div>
            <b>Phone:</b>{' '}
            <a href={phoneHref} style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
              {SITE.phone}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
