import 'server-only';
import Image from 'next/image';
import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function ContactPage() {
  const settings = await getPublicSiteSettings();
  const branding = settings.branding;
  const tel = branding.phoneE164 || (branding.phoneDisplay ? `tel:${String(branding.phoneDisplay).replace(/\D+/g, '')}` : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main className="app-frame" style={{ maxWidth: 1040 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Public Contact</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 5vw, 38px)' }}>Get in Touch</h1>
            <p className="app-copy">
              Reach {branding.name} for pickup questions, directions, or general help. The fastest way to check an order is still the status page, but this page gives customers a cleaner way to call, email, or open directions.
            </p>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>Best use</div>
            <div style={{ color: 'rgba(245,236,216,.84)', lineHeight: 1.55 }}>
              Use the status page first for order updates. Use this page when you need directions, need to call the shop, or want to send a direct question.
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 16 }}>
        <div className="app-section-head">
          <div className="app-section-title">Contact Options</div>
          <div className="app-section-copy">
            The most important ways for customers to reach the processor, all in one place.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'start' }}>
          <div
            style={{
              border: '1px solid #dbe4ee',
              borderRadius: 16,
              background: '#ffffff',
              color: '#0f172a',
              padding: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Phone</div>
                <a href={phoneHref} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 900, fontSize: 18 }}>
                  {branding.phoneDisplay}
                </a>
              </div>

              {branding.email ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Email</div>
                  <a href={`mailto:${branding.email}`} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                    {branding.email}
                  </a>
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Address</div>
                <a href={branding.mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800, lineHeight: 1.5 }}>
                  {branding.address}
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <a
                href={branding.mapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '11px 14px',
                  border: '1px solid #dbe4ee',
                  borderRadius: 12,
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                Open Directions
              </a>
              <a
                href={phoneHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '11px 14px',
                  border: '1px solid #2f6f3f',
                  borderRadius: 12,
                  background: '#2f6f3f',
                  color: '#ffffff',
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
              border: '1px solid #dbe4ee',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#ffffff',
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
      </section>
    </main>
  );
}
