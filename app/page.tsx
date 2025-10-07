'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Counts = {
  ok: boolean;
  needsTag?: number;
  called?: { meat: number; cape: number; webbs: number };
};

export default function Home() {
  const [counts, setCounts] = useState<Counts>({ ok: true, needsTag: 0, called: { meat: 0, cape: 0, webbs: 0 } });
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'dashboardcounts' }),
        cache: 'no-store',
      });
      const json = await r.json();
      setCounts({
        ok: !!json?.ok,
        needsTag: Number(json?.needsTag || 0),
        called: {
          meat: Number(json?.called?.meat || 0),
          cape: Number(json?.called?.cape || 0),
          webbs: Number(json?.called?.webbs || 0),
        },
      });
    } catch {
      setCounts((c) => ({ ...c, ok: false }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const chip = (label: string, n: number) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontWeight: 700,
      }}
    >
      {label} <span style={{ opacity: 0.85 }}>{n}</span>
    </span>
  );

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
  };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 14,
    alignItems: 'center',
  };

  const sectionGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  };

  return (
    <main className="light-page watermark" style={{ maxWidth: 1200, margin: '28px auto', padding: '0 14px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>McAfee Deer Processing</h1>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ marginTop: 0, opacity: 0.85 }}>Pick what you want to do. Quick access to the most common actions.</p>

      {/* Top small KPIs row (only Needs Tag now) */}
      <div style={{ ...sectionGrid, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 800, opacity: 0.9, marginBottom: 6 }}>Needs Tag</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{counts.needsTag ?? 0}</div>
        </div>

        {/* spacer to keep layout tidy */}
        <div style={{ visibility: 'hidden' }} />
        <div style={{ visibility: 'hidden' }} />
      </div>

      {/* Action tiles */}
      <div style={{ ...sectionGrid, marginBottom: 16 }}>
        <Link href="/intake" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>New Intake form</div>
            <div style={{ opacity: 0.8 }}>Start a new Intake Form</div>
          </div>
        </Link>

        <Link href="/scan" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Scan Tags</div>
            <div style={{ opacity: 0.8 }}>Update status by scanning a barcode</div>
          </div>
        </Link>

        <Link href="/search" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Search</div>
            <div style={{ opacity: 0.8 }}>Find jobs by name, tag, or phone #</div>
          </div>
        </Link>
      </div>

      {/* Reports */}
      <div style={{ ...sectionGrid }}>
        <div style={{ ...card, gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Reports</div>
          </div>

          <div style={{ ...row, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link href="/reports/calls" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 700 }}>Call Report</div>
            </Link>
            {/* removed “Ready — Meat/Cape/Webbs” chips on purpose */}
          </div>

          <div style={{ ...row, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link href="/overnight/review" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 700 }}>Overnight — Missing Tag</div>
            </Link>
            {chip('Open', counts.needsTag ?? 0)}
          </div>

          <div style={{ ...row, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link href="/reports/called" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 700 }}>Called — Pickup Queue</div>
            </Link>
            <div style={{ display: 'flex', gap: 10 }}>
              {chip('Meat', counts.called?.meat ?? 0)}
              {chip('Cape', counts.called?.cape ?? 0)}
              {chip('Webbs', counts.called?.webbs ?? 0)}
            </div>
          </div>
        </div>

        {/* Tip Sheet */}
        <Link href="/tips" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Tip Sheet</div>
            <div style={{ opacity: 0.8 }}>Short reminders for staff</div>
          </div>
        </Link>

        {/* FAQ */}
        <Link href="/faq" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>FAQ</div>
            <div style={{ opacity: 0.8 }}>Customer questions & answers</div>
          </div>
        </Link>
      </div>
    </main>
  );
}

