import 'server-only';

import { getPublicSiteSettings } from '@/lib/siteSettings';

export default async function HoursPage() {
  const settings = await getPublicSiteSettings();
  const branding = settings.branding;
  const tel = branding.phoneE164 || (branding.phoneDisplay ? `tel:${String(branding.phoneDisplay).replace(/\D+/g, '')}` : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main className="app-frame" style={{ maxWidth: 920 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Public Hours</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 5vw, 38px)' }}>Season Pickup Hours</h1>
            <p className="app-copy">
              Check the current pickup schedule before heading over. This page keeps the customer-facing hours, location, and best contact information in one place.
            </p>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>Quick note</div>
            <div style={{ color: 'rgba(245,236,216,.84)', lineHeight: 1.55 }}>
              If something looks unclear, call ahead before pickup. Hours can vary during the season, so this is the best current reference for customers.
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 16 }}>
        <div className="app-section-head">
          <div className="app-section-title">Current Hours</div>
          <div className="app-section-copy">
            Pickup availability and contact details for customers coming to the shop.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {settings.hours.map((h) => (
            <div
              key={`${h.label}:${h.value}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'center',
                border: '1px solid #dbe4ee',
                borderRadius: 14,
                padding: '12px 14px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 700,
                flexWrap: 'wrap',
              }}
            >
              <span>{h.label}</span>
              <span style={{ fontWeight: 900 }}>{h.value}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 16,
            background: '#ffffff',
            color: '#0f172a',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
            Shop Details
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <b>Address:</b>{' '}
              <a href={branding.mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                {branding.address}
              </a>
            </div>
            <div>
              <b>Phone:</b>{' '}
              <a href={phoneHref} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                {branding.phoneDisplay}
              </a>
            </div>
            {branding.email ? (
              <div>
                <b>Email:</b>{' '}
                <a href={`mailto:${branding.email}`} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
                  {branding.email}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
