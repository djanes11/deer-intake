// app/contact/page.tsx
'use client';

import { SITE, phoneHref } from '@/lib/config';

const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_EMAIL || '').toString().trim();

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Contact</h1>

      <section style={card}>
        <div style={{ display: 'grid', gap: 10 }}>
          <Row label="Phone">
            <a href={phoneHref} style={link}>
              {SITE.phone}
            </a>
          </Row>

          {CONTACT_EMAIL ? (
            <Row label="Email">
              <a href={`mailto:${CONTACT_EMAIL}`} style={link}>
                {CONTACT_EMAIL}
              </a>
            </Row>
          ) : null}

          <Row label="Address">
            <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" style={link}>
              {SITE.address}
            </a>
          </Row>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Hours</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.9 }}>
              {SITE.hours.map((h, i) => (
                <li key={i}>
                  {h.label} {h.value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <p style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
        Tap the phone number on mobile to call, or open our address in Google Maps for directions.
      </p>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={valueBox}>{children}</div>
    </div>
  );
}

/* ---------- styles ---------- */

const card: React.CSSProperties = {
  padding: 16,
  border: '1px solid #1f2937',
  borderRadius: 12,
  background: '#0b0f12',
  color: '#e5e7eb',
};

const valueBox: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #1f2937',
  borderRadius: 10,
  background: '#0b0f12',
  color: '#e5e7eb',
  fontWeight: 800,
  wordBreak: 'break-word',
};

const link: React.CSSProperties = {
  color: '#a7e3ba',
  textDecoration: 'underline',
};
