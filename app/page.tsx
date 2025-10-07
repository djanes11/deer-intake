'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Trio = { meat: number; cape: number; webbs: number };
type Counts = {
  ok: boolean;
  needsTag: number;
  ready: Trio;   // Call Report (Ready to Call)
  called: Trio;  // Pickup Queue
};

const lc = (v: any) => String(v ?? '').trim().toLowerCase();

/* Treat these as "ready to call" (exclude anything that contains 'called') */
function isReadyToCall(s?: any) {
  const v = lc(s);
  if (!v) return false;
  if (v.includes('called')) return false;
  return (
    v.includes('ready') ||
    v.includes('finish') ||
    v.includes('finished') ||
    v.includes('& ready') || // “Finished & Ready” style strings
    v.includes('ready for pickup')
  );
}

/* Pull a field from common aliases */
const get = (r: any, ...keys: string[]) => {
  for (const k of keys) {
    if (r?.[k] != null) return r[k];
  }
  return undefined;
};

export default function Home() {
  const [counts, setCounts] = useState<Counts>({
    ok: true,
    needsTag: 0,
    ready: { meat: 0, cape: 0, webbs: 0 },
    called: { meat: 0, cape: 0, webbs: 0 },
  });
  const [busy, setBusy] = useState(false);

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

  // Fallback: compute “ready” from @callreport
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

  // Fallback: compute “called/pickup queue” from @recall
  async function computeCalledFallback(current: Counts): Promise<Counts> {
    const allZero = (t: Trio) => (t.meat | t.cape | t.webbs) === 0;
    if (!allZero(current.called)) return current;

    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'search', q: '@recall' }),
        cache: 'no-store',
      });
      const j = await r.json();
      const rows: any[] = Array.isArray(j?.rows) ? j.rows : Array.isArray(j) ? j : [];

      // “Called” for each track -> show in pickup queue chips
      const isCalled = (s?: any) => lc(s) === 'called' || lc(s).startsWith('called'); // handle “Called 10/6”
      let meat = 0, cape = 0, webbs = 0;

      for (const row of rows) {
        if (isCalled(get(row, 'status', 'Status'))) meat++;
        if (isCalled(get(row, 'capingStatus', 'Caping Status'))) cape++;
        if (isCalled(get(row, 'webbsStatus', 'Webbs Status'))) webbs++;
      }
      return { ...current, called: { meat, cape, webbs } };
    } catch {
      return current;
    }
  }

  async function refresh() {
    setBusy(true);
    const base = await fetchDashboardCounts();
    const withReady = await computeReadyFallback(base);
    const full = await computeCalledFallback(withReady);
    setCounts(full);
    setBusy(false);
  }

  useEffect(() => { refresh(); }, []);

  /* ---------------- styles ---------------- */
  const shell: React.CSSProperties = { maxWidth: 1100, margin: '26px auto', padding: '0 16px 40px' };
  const trio: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };
  const card: React.CSSProperties = {
    background: 'rgba(18,24,22,.95)',
    border: '1px solid rgba(255,255,255,.08)',
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
    borderTop: '1px solid rgba(255,255,255,.07)',
  };
  const rowFirst: React.CSSProperties = { ...row, borderTop: 'none', paddingTop: 6 };

  const mini: React.CSSProperties = { fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.9 };

  const chip = (label: string, n: number, tint: 'green' | 'amber' | 'purple' = 'green') => {
    const map = {
      green: { bg: 'rgba(51,117,71,.20)', bd: 'rgba(51,117,71,.50)' },
      amber: { bg: 'rgba(167,115,18,.18)', bd: 'rgba(167,115,18,.45)' },
      purple: { bg: 'rgba(115,75,170,.20)', bd: 'rgba(115,75,170,.45)' },
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
          minWidth: 84,
          justifyContent: 'center',
        }}
        aria-label={`${label}: ${n}`}
      >
        {label} <span style={{ opacity: 0.92 }}>{n}</span>
      </span>
    );
  };

  const linkStyle: React.CSSProperties = { textDecoration: 'none', color: 'inherit' };

  const busyOverlay: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,.25)',
    borderRadius: 14,
    backdropFilter: 'blur(1px)',
    fontWeight: 900,
    letterSpacing: '.04em',
  };

  const ReportsCard = useMemo(() => (
    <div style={{ position: 'relative' }}>
      <div style={{ ...card, gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Reports</div>
          <button
            onClick={refresh}
            className="btn"
            aria-label="Refresh dashboard"
            title="Refresh"
            disabled={busy}
            style={{ padding: '6px 12px', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div style={rowFirst}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(51,117,71,.85)' }} />
          <Link href="/reports/calls" style={linkStyle}>
            <div style={{ fontWeight: 800 }}>Call Report — Ready to Call</div>
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            {chip('Meat', counts.ready.meat, 'green')}
            {chip('Cape', counts.ready.cape, 'amber')}
            {chip('Webbs', counts.ready.webbs, 'purple')}
          </div>
        </div>

        <div style={row}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(167,115,18,.9)' }} />
          <Link href="/overnight/review" style={linkStyle}>
            <div style={{ fontWeight: 800 }}>Overnight — Missing Tag</div>
          </Link>
          {chip('Open', counts.needsTag, 'amber')}
        </div>

        <div style={row}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: 'rgba(115,75,170,.95)' }} />
          <Link href="/reports/called" style={linkStyle}>
            <div style={{ fontWeight: 800 }}>Called — Pickup Queue</div>
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            {chip('Meat', counts.called.meat, 'green')}
            {chip('Cape', counts.called.cape, 'amber')}
            {chip('Webbs', counts.called.webbs, 'purple')}
          </div>
        </div>
      </div>
      {busy && <div style={busyOverlay}>Refreshing…</div>}
    </div>
  ), [busy, counts]);

  return (
    <main className="watermark" style={shell}>
      {/* header */}
      <div style={header}>
        <div style={{ color: '#89c096', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 12, marginBottom: 6 }}>
          Welcome
        </div>
        <h1 style={title}>McAfee Deer Processing</h1>
        <p style={subtitle}>Pick what you want to do. Quick access to the most common actions.</p>
      </div>

      {/* quick actions */}
      <div style={{ ...trio, marginBottom: 16 }}>
        <Link href="/intake" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={card}>
            <div style={mini}>Intake</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>New Intake form</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Start a new Intake Form</div>
          </div>
        </Link>
        <Link href="/scan" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={card}>
            <div style={mini}>Scan</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Scan Tags</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Update status by scanning a barcode</div>
          </div>
        </Link>
        <Link href="/search" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={card}>
            <div style={mini}>Search</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Search Jobs</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>Find by name, tag, or phone #</div>
          </div>
        </Link>
      </div>

      {/* reports + help */}
      <div style={trio}>
        {ReportsCard}

        <div style={card}>
          <div style={mini}>Help</div>
          <Link href="/tips" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Tip Sheet</div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Short reminders for staff</div>

          <div style={{ height: 10 }} />

          <Link href="/faq" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>FAQ</div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Customer questions &amp; answers</div>
        </div>
      </div>
    </main>
  );
}
