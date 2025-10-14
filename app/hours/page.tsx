// app/hours/page.tsx
'use client';

import CustomerHeader from '@/components/CustomerHeader';
import { SITE, phoneHref } from '@/lib/config';

const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_EMAIL || '').toString().trim();

export default function HoursPage() {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '0 12px 24px' }}>
      <CustomerHeader />

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '16px 0 10px' }}>Hours & Location</h1>

        <section style={card}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>Our Hours</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.9 }}>
                {SITE.hours.map((h, i) => (
                  <li key={i}>{h.label} {h.value}</li>
                ))}
              </ul>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>Address</div>
              <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" style={link}>
                {SITE.address}
              </a>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>Phone</div>
              <a href={phoneHref} style={link}>{SITE.phone}</a>
            </div>

            {CONTACT_EMAIL ? (
              <div>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Email</div>
                <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>
              </div>
            ) : null}
          </div>
        </section>

        <p style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
          Tap the phone number on mobile to call, or open our address in Google Maps for directions.
        </p>
      </div>
    </main>
  );
}

/* styles */
const card: React.CSSProperties = {
  padding: 16,
  border: '1px solid #1f2937',
  borderRadius: 12,
  background: '#0b0f12',
  color: '#e5e7eb',
};

const link: React.CSSProperties = {
  color: '#a7e3ba',
  textDecoration: 'underline',
  wordBreak: 'break-word',
};
