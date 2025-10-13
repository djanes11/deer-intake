// app/page.tsx
export const dynamic = 'force-dynamic'; // ensure env is read at request-time

import Link from 'next/link';

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

export default function Home() {
  return IS_PUBLIC ? <PublicLanding /> : <StaffHome />;
}

/* ──────────────────────────────────────────────────────────────────────────
   PUBLIC LANDING (shown when PUBLIC_MODE=1)
   ────────────────────────────────────────────────────────────────────────── */
function PublicLanding() {
  const shell: React.CSSProperties = {
    maxWidth: 900,
    margin: '26px auto',
    padding: '0 16px 40px',
  };
  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.1,
    fontWeight: 900,
  };
  const subtitle: React.CSSProperties = { margin: '6px 0 16px', opacity: 0.9 };

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
  };

  const tile: React.CSSProperties = {
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    padding: '14px 16px',
    border: '1px solid rgba(255,255,255,.08)',
    background: 'rgba(18,24,22,.95)',
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 18,
    textAlign: 'center',
  };

  return (
    <main style={shell}>
      <div style={{ color: '#89c096', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12, marginBottom: 6 }}>
        Welcome
      </div>
      <h1 style={title}>McAfee Custom Deer Processing</h1>
      <p style={subtitle}>Fast, clean processing. Check your status or start an after-hours drop.</p>

      <div style={grid}>
        <Link href="/status" style={tile}>Check Status</Link>
        <Link href="/drop" style={tile}>Overnight Drop</Link>
        <Link href="/faq-public" style={tile}>FAQ</Link>
        <Link href="/hours" style={tile}>Hours &amp; Location</Link>
        <Link href="/contact" style={tile}>Contact</Link>
      </div>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   STAFF HOME (unchanged content from your current file)
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
