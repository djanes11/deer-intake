'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Trio = { meat: number; cape: number; webbs: number };
type Counts = {
  ok: boolean;
  needsTag: number;
  ready: Trio;   // Call Report (Ready to Call)
  called: Trio;  // Pickup Queue (optional; fallback to zeros)
};

/* ---------- tiny utils (client-side) ---------- */
const lc = (v: any) => String(v ?? '').trim().toLowerCase();
const isReadyToCall = (s?: any) => {
  const v = lc(s);
  return (v.includes('ready') || v.includes('finish')) && !v.includes('called');
};

// Pull a field from common aliases
const get = (r: any, ...keys: string[]) => {
  for (const k of keys) {
    if (r?.[k] != null) return r[k];
  }
  return undefined;
};

/* ---------- page ---------- */
export default function Home() {
  const [counts, setCounts] = useState<Counts>({
    ok: true,
    needsTag: 0,
    ready: { meat: 0, cape: 0, webbs: 0 },
    called: { meat: 0, cape: 0, webbs: 0 },
  });

  async function fetchDashboardCounts(): Promise<Counts> {
    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'dashboardcounts' }),
        cache: 'no-store',
      });
      const json = await r.json();

      const ready: Trio = {
        meat: Number(json?.ready?.meat || 0),
        cape: Number(json?.ready?.cape || 0),
        webbs: Number(json?.ready?.webbs || 0),
      };
      const called: Trio = {
        meat: Number(json?.called?.meat || 0),
        cape: Number(json?.called?.cape || 0),
        webbs: Number(json?.called?.webbs || 0),
      };
      return {
        ok: !!json?.ok,
        needsTag: Number(json?.needsTag || 0),
        ready,
        called,
      };
    } catch {
      return { ok: false, needsTag: 0, ready: { meat: 0, cape: 0, webbs: 0 }, called: { meat: 0, cape: 0, webbs: 0 } };
    }
  }

  // Fallback: derive "ready to call" counts from @callreport if API didn’t return (or returned zeros)
  async function computeReadyFallback(current: Counts): Promise<Counts> {
    const allZero = (t: Trio) => (t.meat | t.cape | t.webbs) === 0;
    if (!allZero(current.ready)) return current;

    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'search', q: '@callreport' }),
        cache: 'no-store',
      });
      const j = await r.json();
      const rows: any[] = Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];

      let meat = 0, cape = 0, webbs = 0;
      for (const row of rows) {
        if (isReadyToCall(get(row, 'status', 'Status'))) meat++;
        if (isReadyToCall(get(row, 'capingStatus', 'Caping Status'))) cape++;
        if (isReadyToCall(get(row, 'webbsStatus', 'Webbs Status'))) webbs++;
      }
      return { ...current, ready: { meat, cape, webbs } };
    } catch {
      return current;
    }
  }

  async function refresh() {
    const base = await fetchDashboardCounts();
    const withFallback = await computeReadyFallback(base);
    setCounts(withFallback);
  }

  useEffect(() => { refresh(); }, []);

  /* ---------- styles: compact, professional ---------- */
  const shell: React.CSSProperties = { maxWidth: 1100, margin: '26px auto', padding: '0 16px 40px' };
  const trio: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };
  const card: React.CSSProperties = {
    background: 'rgba(12,18,16,.92)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 14,
    padding: 16,
  };
  const header: React.CSSProperties = { marginBottom: 8 };
  const title: React.CSSProperties = { margin: 0, fontSize: 36, lineHeight: 1.1, fontWeight: 900 };
  const subtitle: React.CSSProperties = { margin: '6px 0 0', opacity: 0.85 };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 14,
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,.06)',
  };
  const rowFirst: React.CSSProperties = { ...row, borderTop: 'none', paddingTop: 6 };

  const mini: React.CSSProperties = { fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.9 };

  const softPill = (label: string, n: number, tint: 'green' | 'amber' | 'purple' = 'green') => {
    const map = {
      green: { bg: 'rgba(51,117,71,.28)', bd: 'rgba(51,117,71,.60)' },
      amber: { bg: 'rgba(167,115,18,.28)', bd: 'rgba(167,115,18,.58)' },
      purple: { bg: 'rgba(115,75,170,.30)', bd: 'rgba(115,75,170,.58)' },
    }[tint];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: map.bg,
          border: `1px solid ${map.bd}`,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          minWidth: 72,
          justifyContent: 'center',
        }}
        aria-label={`${label}: ${n}`}
      >
        {label} <span style={{ opacity: 0.92 }}>{n}</span>
      </span>
    );
  };

  const linkStyle: React.CSSProperties = { textDecoration: 'none', color: 'inherit' };

  return (
    <main className="watermark" style={shell}>
      {/* header */}
      <div style={header}>
        <div style={{ color: '#89c096', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12, marginBottom: 6 }}>
          Welcome
        </div>
        <h1 style={title}>McAfee Deer Processing</h1>
        <p style={subtitle}>Quick access to common actions and live reports.</p>
      </div>

      {/* quick actions */}
      <div style={{ ...trio, marginBottom: 16 }}>
        <Link href="/intake" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Intake</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>New Intake form</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Start a new Intake Form</div>
          </div>
        </Link>
        <Link href="/scan" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Scan</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Scan Tags</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Update status by scanning a barcode</div>
          </div>
        </Link>
        <Link href="/search" style={linkStyle}>
          <div style={card}>
            <div style={mini}>Search</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Search Jobs</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Find by name, tag, or phone #</div>
          </div>
        </Link>
      </div>

      {/* reports */}
      <div style={trio}>
        <div style={{ ...card, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Reports</div>
            <button
              onClick={refresh}
              className="btn"
              aria-label="Refresh dashboard"
              title="Refresh"
              style={{ padding: '6px 12px' }}
            >
              Refresh
            </button>
          </div>

          <div style={rowFirst}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(51,117,71,.8)' }} />
            <Link href="/reports/calls" style={linkStyle}>
              <div style={{ fontWeight: 800 }}>Call Report — Ready to Call</div>
            </Link>
            <div style={{ display: 'flex', gap: 10 }}>
              {softPill('Meat', counts.ready.meat, 'green')}
              {softPill('Cape', counts.ready.cape, 'amber')}
              {softPill('Webbs', counts.ready.webbs, 'purple')}
            </div>
          </div>

          <div style={row}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(167,115,18,.8)' }} />
            <Link href="/overnight/review" style={linkStyle}>
              <div style={{ fontWeight: 800 }}>Overnight — Missing Tag</div>
            </Link>
            {softPill('Open', counts.needsTag, 'amber')}
          </div>

          <div style={row}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(115,75,170,.9)' }} />
            <Link href="/reports/called" style={linkStyle}>
              <div style={{ fontWeight: 800 }}>Called — Pickup Queue</div>
            </Link>
            <div style={{ display: 'flex', gap: 10 }}>
              {softPill('Meat', counts.called.meat, 'green')}
              {softPill('Cape', counts.called.cape, 'amber')}
              {softPill('Webbs', counts.called.webbs, 'purple')}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={mini}>Help</div>
          <Link href="/tips" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Tip Sheet</div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Short reminders for staff</div>

          <div style={{ height: 10 }} />

          <Link href="/faq" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>FAQ</div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Customer questions &amp; answers</div>
        </div>
      </div>
    </main>
  );
}
