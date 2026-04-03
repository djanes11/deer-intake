import 'server-only';
import Image from 'next/image';
import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function ContactPage() {
  const settings = await getPublicSiteSettings();
  const branding = settings.branding;
  const tel = branding.phoneE164 || (branding.phoneDisplay ? `tel:${String(branding.phoneDisplay).replace(/\D+/g, '')}` : '');
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
                  {branding.phoneDisplay}
                </a>
              </div>
              {branding.email ? (
                <div>
                  <b>Email:</b>{' '}
                  <a href={`mailto:${branding.email}`} style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
                    {branding.email}
                  </a>
                </div>
              ) : null}
              <div>
                <b>Address:</b>{' '}
                <a href={branding.mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
                  {branding.address}
                </a>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={branding.mapsUrl}
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
                Call {branding.phoneDisplay}
              </a>
            </div>
          </div>

          <div
            style={{
              border: '1px solid #1f2937',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#0b0f12',
            }}
          >
            <Image
              src="/property-overview.jpg"
              alt={`Aerial view of the ${branding.name} drop-off entrance and cooler`}
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
