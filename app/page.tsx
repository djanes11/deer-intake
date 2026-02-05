// app/page.tsx
export const dynamic = 'force-dynamic'; // ensure env is read at request-time

import Link from 'next/link';

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

export default function Home() {
  return IS_PUBLIC ? <PublicLanding /> : <StaffHome />;
}

/* ──────────────────────────────────────────────────────────────────────────
   PUBLIC LANDING (shown when PUBLIC_MODE=1)
   — Header/Nav removed here to avoid duplicate with layout header
   ────────────────────────────────────────────────────────────────────────── */
function PublicLanding() {
  const colors = {
    bg: '#0b0f0d',
    panel: 'rgba(18,24,22,.95)',
    panelBorder: 'rgba(255,255,255,.08)',
    brand: '#89c096',
    text: '#e6ebe8',
    sub: 'rgba(230,235,232,.8)',
    accent: '#d4e7db',
    tileBg: 'rgba(18,24,22,.95)',
  } as const;

  const shell: React.CSSProperties = {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 16px 48px',
    color: colors.text,
  };

  const hero: React.CSSProperties = {
    marginTop: 10, // slight offset under the layout header
    borderRadius: 16,
    background: `linear-gradient(180deg, rgba(22,28,25,1) 0%, rgba(12,16,14,1) 100%)`,
    border: `1px solid ${colors.panelBorder}`,
    padding: 24,
  };
  const eyebrow: React.CSSProperties = {
    color: colors.brand, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12,
  };
  const title: React.CSSProperties = {
    margin: '6px 0 8px', fontSize: 40, lineHeight: 1.1, fontWeight: 900,
  };
  const subtitle: React.CSSProperties = { margin: '0 0 18px', color: colors.sub, maxWidth: 720 };

  const ctas: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 };
  const cta = (primary = false): React.CSSProperties => ({
    display: 'inline-block',
    padding: '10px 14px',
    borderRadius: 12,
    textDecoration: 'none',
    color: primary ? '#0b0f0d' : colors.text,
    background: primary ? colors.brand : colors.tileBg,
    border: primary ? '1px solid transparent' : `1px solid ${colors.panelBorder}`,
    fontWeight: 900,
    fontSize: 16,
  });

  const twoCol: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 12,
    marginTop: 16,
  };
  const panel: React.CSSProperties = {
    background: colors.panel,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: 14,
    padding: 16,
  };
  const h3: React.CSSProperties = { fontWeight: 900, fontSize: 18, marginBottom: 8, color: colors.accent };

  const list: React.CSSProperties = { display: 'grid', gap: 10, marginTop: 8 };
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 10,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.panelBorder}`,
    background: 'rgba(18,24,22,.92)',
  };
  const dot = (c: string): React.CSSProperties => ({ width: 10, height: 10, borderRadius: 999, background: c });

  const footer: React.CSSProperties = {
    marginTop: 28,
    paddingTop: 16,
    borderTop: `1px solid ${colors.panelBorder}`,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 8,
    fontSize: 13,
    color: colors.sub,
  };

  return (
    <main style={shell}>
      {/* Hero */}
      <section style={hero} aria-label="Hero">
        <div style={eyebrow}>Welcome</div>
        <h1 style={title}>Fast, clean, professional—done right.</h1>
        <p style={subtitle}>
          Drop off after-hours, choose your cuts and specialty products, and track progress online.
          We’ll notify you when it’s ready.
        </p>
        <div style={ctas}>
          <Link href="/overnight" style={cta(true)}>Start Overnight Drop</Link>
          <Link href="/status" style={cta(false)}>Check Your Status</Link>
        </div>
      </section>

      {/* Two-column: How it Works + Hours/Location */}
      <section style={twoCol} aria-label="Info">
        <div style={panel}>
          <div style={h3}>How it Works</div>
          <ol style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 1.6 }}>
            <li>Arrive during business hours or use our 24/7 Overnight Drop.</li>
            <li>Fill the simple intake form and choose your cuts/specialty items.</li>
            <li>Track progress on the Status page. We’ll also email updates.</li>
            <li>Pick up quickly when notified.</li>
          </ol>
          <div style={{ height: 12 }} />
          <Link href="/faq-public" style={cta(false)}>Read the FAQ</Link>
        </div>

        <aside style={panel} aria-label="Hours & Location">
          <div style={h3}>Pickup Hours</div>
          <div style={list}>
            <div style={row}><div style={dot('rgba(51,117,71,.9)')} /><div>Mon–Fri: 6:00 PM – 8:00 PM</div></div>
            <div style={row}><div style={dot('rgba(51,117,71,.9)')} /><div>Sat: 9:00 AM – 5:00 PM</div></div>
            <div style={row}><div style={dot('rgba(51,117,71,.9)')} /><div>Sun: 9:00 AM – 12:00 PM</div></div>
            <div style={row}><div style={dot('rgba(167,115,18,.9)')} /><div>After Hours: Overnight Drop Available</div></div>
          </div>
          <div style={{ height: 10 }} />
        </aside>
      </section>

      {/* Pricing (new) */}
      <section aria-label="Pricing" style={{ marginTop: 12 }}>
        <div style={panel}>
          <div style={h3}>Pricing</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li><strong>Standard Processing</strong>: $130</li>
            <li><strong>Caped (add-on)</strong>: +$20 &nbsp;<span style={{ opacity: 0.8 }}>(i.e., $150 total)</span></li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer style={footer} aria-label="Footer">
        <div>© {new Date().getFullYear()} McAfee Custom Deer Processing. All rights reserved.</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/faq-public">FAQ</Link>
          <Link href="/hours">Hours &amp; Location</Link>
          <Link href="/contact">Contact</Link>
          <span style={{ opacity: 0.6 }}>State &amp; local regulations followed.</span>
        </div>
      </footer>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STAFF HOME (unchanged except for adding State Form link under Reports)
   ────────────────────────────────────────────────────────────────────────── */
function StaffHome() {
  const shell: React.CSSProperties = {
    maxWidth: 1100,
    margin: '26px auto',
    padding: '0 16px 40px',
  };

  const header: React.CSSProperties = { marginBottom: 8 };
  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.1,
    fontWeight: 900,
  };
  const subtitle: React.CSSProperties = { margin: '6px 0 0', opacity: 0.85 };

  const trio: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  };

  const card: React.CSSProperties = {
    background: 'rgba(18,24,22,.95)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 14,
    padding: 16,
  };

  const mini: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    opacity: 0.9,
  };

  const linkStyle: React.CSSProperties = {
    textDecoration: 'none',
    color: 'inherit',
  };

  const list: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    marginTop: 8,
  };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 12,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,.08)',
    background: 'rgba(18,24,22,.92)',
  };

  const dot = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color,
  });

  return (
    <main className="watermark" style={shell}>
      <div style={header}>
        <div
          style={{
            color: '#89c096',
            fontWeight: 800,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          Welcome
        </div>
        <h1 style={title}>McAfee Deer Processing</h1>
        <p style={subtitle}>
          Pick what you want to do. Quick access to the most common actions.
        </p>
      </div>

      {/* Primary actions */}
      <div style={{ ...trio, marginBottom: 16 }}>
        <Link href="/intake" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Intake</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              New Intake form
            </div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Start a new Intake Form
            </div>
          </div>
        </Link>

        <Link href="/scan" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Scan</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              Scan Tags
            </div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Update status by scanning a barcode
            </div>
          </div>
        </Link>

        <Link href="/search" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Search</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              Search Jobs
            </div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Find by name, tag, or phone #
            </div>
          </div>
        </Link>
      </div>

      {/* Reports & Help */}
      <div style={trio}>
        {/* Reports (static links; no data calls) */}
        <div style={{ ...card, gridColumn: 'span 2' }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            Reports
          </div>

          <div style={list}>
            <Link href="/reports/calls" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(51,117,71,.9)')} />
                <div style={{ fontWeight: 800 }}>Call Report — Ready to Call</div>
              </div>
            </Link>

            <Link href="/reports/specialty" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(200,70,25,.9)')} />
                <div style={{ fontWeight: 800 }}>Specialty Totals — Open lbs</div>
              </div>
            </Link>


            <Link href="/overnight/review" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(167,115,18,.9)')} />
                <div style={{ fontWeight: 800 }}>Overnight — Missing Tag</div>
              </div>
            </Link>

            <Link href="/reports/called" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(115,75,170,.95)')} />
                <div style={{ fontWeight: 800 }}>Called — Pickup Queue</div>
              </div>
            </Link>

            {/* NEW: State Form report link */}
            <Link href="/reports/state-form" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(25,130,200,.9)')} />
                <div style={{ fontWeight: 800 }}>State Form — Page Builder</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Help */}
        <div style={card}>
          <div style={mini}>Help</div>
          <Link href="/tips" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              Tip Sheet
            </div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Short reminders for staff</div>
          <div style={{ height: 10 }} />
          <Link href="/faq" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              FAQ
            </div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Customer questions &amp; answers
          </div>
        </div>
      </div>
    </main>
  );
}
