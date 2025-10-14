import 'server-only';
import Image from 'next/image';

// Falls back to your central SITE config if present
let SITE: any = {
  name: 'McAfee Custom Deer Processing',
  address: '3172 W 1100 N, Delphi, IN 46923',
  lat: 40.6436,
  lng: -86.6754,
  phone: '(765) 564-0048',
  phoneE164: '+17655640048',
  mapsUrl: 'https://maps.google.com/?q=3172%20W%201100%20N%2C%20Delphi%2C%20IN%2046923',
};
try {
  // @ts-ignore
  const cfg = require('@/lib/config'); SITE = cfg.SITE ?? SITE;
} catch {}

export default function ContactPage() {
  const tel = SITE?.phoneE164 || (SITE?.phone ? 'tel:' + String(SITE.phone).replace(/\D+/g, '') : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main>
      <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Contact</h1>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: '1fr',
          }}
        >
          {/* Info card */}
          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: 12,
              background: '#0b0f12',
              color: '#e5e7eb',
              padding: 14,
            }}
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <b>Phone:</b>{' '}
                <a href={phoneHref} style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
                  {SITE.phone}
                </a>
              </div>
              <div>
                <b>Address:</b>{' '}
                <a href={SITE.mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
                  {SITE.address}
                </a>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '10px 12px',
                  border: '1px solid #1f2937',
                  borderRadius: 10,
                  background: '#121821',
                  color: '#e5e7eb',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Open in Google Maps
              </a>
              <a
                href={phoneHref}
                style={{
                  display: 'inline-block',
                  padding: '10px 12px',
                  border: '1px solid #1f2937',
                  borderRadius: 10,
                  background: 'transparent',
                  color: '#e5e7eb',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Call {SITE.phone}
              </a>
            </div>
          </div>

          {/* Aerial image */}
          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#0b0f12',
            }}
          >
            <Image
              src="/property-overview.jpg" // <-- place your image at public/images/property-aerial.jpg
              alt="Aerial view of the McAfee drop-off entrance and cooler"
              width={1600}
              height={1000}
              priority
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
