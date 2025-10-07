'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Trio = { meat: number; cape: number; webbs: number };
type Counts = {
  ok: boolean;
  needsTag: number;
  ready: Trio;   // Call Report (Ready to Call)
  called: Trio;  // Pickup Queue (optional from API; fallback to zeros)
};

export default function Home() {
  const [counts, setCounts] = useState<Counts>({
    ok: true,
    needsTag: 0,
    ready: { meat: 0, cape: 0, webbs: 0 },
    called: { meat: 0, cape: 0, webbs: 0 },
  });

  async function refresh() {
    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'dashboardcounts' }),
        cache: 'no-store',
      });
      const json = await r.json();

      // Defensive mapping: support either {ready} and/or {called}
      const ready = {
        meat: Number(json?.ready?.meat || 0),
        cape: Number(json?.ready?.cape || 0),
        webbs: Number(json?.ready?.webbs || 0),
      };
      const called = {
        meat: Number(json?.called?.meat || 0),
        cape: Number(json?.called?.cape || 0),
        webbs: Number(json?.called?.webbs || 0),
      };

      setCounts({
        ok: !!json?.ok,
        needsTag: Number(json?.needsTag || 0),
        ready,
        called,
      });
    } catch {
      setCounts((c) => ({ ...c, ok: false }));
    }
  }

  useEffect(() => { refresh(); }, []);

  const card: React.CSSProperties = {
    background: 'rgba(12,20,18,.92)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16,
    padding: 16,
  };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 14,
    alignItems: 'center',
    padding: '10px 0',
    borderTop: '1px solid rgba(255,255,255,.06)',
  };

  const grid3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  };

  const chip = (label: string, n: number) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(47,111,63,.38)',
        border: '1px solid rgba(47,111,63,.6)',
        fontWeight: 800,
      }}
    >
      {label} <span style={{ opacity: 0.9 }}>{n}</span>
    </span>
  );

  return (
    <main className="watermark" style={{ maxWidth: 1040, margin: '28px auto', padding: '0 14px 36px' }}>
      {/* Hero */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#89c096', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12, marginBottom: 6 }}>
          Welcome
        </div>
        <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.1 }}>McAfee Deer Processing</h1>
        <p style={{ margin: '6px 0 0', opacity: 0.85 }}>
          Pick what you want to do. Quick access to the most common actions.
        </p>
      </div>

      {/* Action tiles */}
      <div style={{ ...grid3, marginBottom: 16 }}>
        <Link href="/intake" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>New Intake form</div>
            <div style={{ opacity: 0.8 }}>Start a new Intake Form</div>
          </div>
        </Link>

        <Link href="/scan" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Scan Tags</div>
            <div style={{ opacity: 0.8 }}>Update status by scanning a barcode</div>
          </div>
        </Link>

        <Link href="/search" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Search</div>
            <div style={{ opacity: 0.8 }}>Find jobs by name, tag, or phone #</div>
          </div>
        </Link>
      </div>

      {/* Reports card (all KPIs live here) */}
      <div style={grid3}>
        <div style={{ ...card, gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Reports</div>
          </div>

          {/* Call Report — show Ready chips (from json.ready) */}
          <div style={row}>
            <Link href="/reports/calls" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 800 }}>Call Report (Ready to Call)</div>
            </Link>
            <div style={{ display: 'flex', gap: 10 }}>
              {chip('Meat', counts.ready.meat)}
              {chip('Cape', counts.ready.cape)}
              {chip('Webbs', counts.ready.webbs)}
            </div>
          </div>

          {/* Overnight — Missing Tag */}
          <div style={row}>
            <Link href="/overnight/review" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 800 }}>Overnight — Missing Tag</div>
            </Link>
            {chip('Open', counts.needsTag)}
          </div>

          {/* Called — Pickup Queue (optional chips if API provides `called`) */}
          <div style={row}>
            <Link href="/reports/called" style={{ textDecoration: 'none' }}>
              <div style={{ fontWeight: 800 }}>Called — Pickup Queue</div>
            </Link>
            <div style={{ display: 'flex', gap: 10 }}>
              {chip('Meat', counts.called.meat)}
              {chip('Cape', counts.called.cape)}
              {chip('Webbs', counts.called.webbs)}
            </div>
          </div>
        </div>

        {/* Tip Sheet */}
        <Link href="/tips" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Tip Sheet</div>
            <div style={{ opacity: 0.8 }}>Short reminders for staff</div>
          </div>
        </Link>

        {/* FAQ */}
        <Link href="/faq" style={{ textDecoration: 'none' }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>FAQ</div>
            <div style={{ opacity: 0.8 }}>Customer questions &amp; answers</div>
          </div>
        </Link>
      </div>
    </main>
  );
}

