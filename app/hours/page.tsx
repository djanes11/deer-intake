import 'server-only';

// Falls back to local defaults; will use central config if available
let SITE: any = {
  hours: [
    { label: 'Mon–Fri', value: '6–8 pm' },
    { label: 'Sat', value: '9–5' },
    { label: 'Sun', value: '9–12' },
  ],
  phone: '(765) 564-0048',
  phoneE164: '+17655640048',
  address: '3172 W 1100 N, Delphi, IN 46923',
  mapsUrl: 'https://maps.google.com/?q=3172%20W%201100%20N%2C%20Delphi%2C%20IN%2046923',
};
try {
  // @ts-ignore
  const cfg = require('@/lib/config'); SITE = cfg.SITE ?? SITE;
} catch {}

export default function HoursPage() {
  const tel = SITE?.phoneE164 || (SITE?.phone ? 'tel:' + String(SITE.phone).replace(/\D+/g, '') : '');
  const phoneHref = String(tel).startsWith('tel:') ? tel : `tel:${tel}`;

  return (
    <main>
      <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Season Pickup Hours</h1>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {(SITE.hours as ReadonlyArray<{ label: string; value: string }>).map((h) => (
            <li
              key={h.label}
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
