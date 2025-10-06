'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AnyRec = Record<string, any>;
const API = '/api/gas2';

async function postJSON(body: any) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let json: any;
  try { json = JSON.parse(t); } catch { json = { __raw: t }; }
  if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}`);
  return json;
}

const lc = (v: any) => String(v ?? '').trim().toLowerCase();

// “Ready to call” = contains ready/finish and NOT already called
function isReady(s?: any) {
  const v = lc(s);
  return (v.includes('ready') || v.includes('finish')) && !v.includes('called');
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();

  // KPIs
  const [needsTag, setNeedsTag] = useState(0);
  const [readyMeat, setReadyMeat] = useState(0);
  const [readyCape, setReadyCape] = useState(0);
  const [readyWebbs, setReadyWebbs] = useState(0);

  async function refresh() {
    setLoading(true);
    setErr(undefined);
    try {
      // Needs Tag
      const needs = await postJSON({ action: 'needsTag', limit: 999 });
      setNeedsTag(Array.isArray(needs?.rows) ? needs.rows.length : 0);

      // Pull the same pool your Calls report uses
      // Prefer @readyTracks; fall back in order if GAS key differs.
      const queries = ['@readyTracks', '@callreport', '@calls', '@ready', '@recent', '@all'];
      let rows: AnyRec[] = [];
      for (const q of queries) {
        try {
          const res = await postJSON({ action: 'search', q });
          const r = Array.isArray(res?.rows) ? res.rows : [];
          if (r.length) { rows = r; break; }
        } catch { /* keep trying */ }
      }

      // Tally per track
      let m = 0, c = 0, w = 0;
      for (const r of rows) {
        if (isReady(r.status)) m++;
        if (isReady(r.capingStatus ?? r['Caping Status'])) c++;
        if (isReady(r.webbsStatus  ?? r['Webbs Status']))  w++;
      }
      setReadyMeat(m);
      setReadyCape(c);
      setReadyWebbs(w);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <main className="watermark" style={{ maxWidth: 1040, margin: '16px auto', padding: '0 16px 36px' }}>
      {/* Header */}
      <section className="hero" style={{ marginTop: 6, marginBottom: 8 }}>
        <div className="hero-kicker">WELCOME</div>
        <h1 className="hero-title" style={{ marginBottom: 4 }}>McAfee Deer Processing</h1>
        <p className="hero-sub">Pick what you want to do. Quick access to common actions.</p>
      </section>

      {/* Compact KPI strip */}
      <section
        className="kpi-grid"
        style={{
          display:'grid',
          gridTemplateColumns:'repeat(5, minmax(0,1fr))',
          gap:12,
          margin:'10px 0 16px'
        }}
      >
        <div className="kpi-card">
          <div className="kpi-label">Needs Tag</div>
          <div className="kpi-value">{needsTag}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ready — Meat</div>
          <div className="kpi-value">{readyMeat}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ready — Cape</div>
          <div className="kpi-value">{readyCape}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ready — Webbs</div>
          <div className="kpi-value">{readyWebbs}</div>
        </div>
        <button
          onClick={refresh}
          className="btn"
          style={{ height: '100%', minHeight: 0, alignSelf:'stretch' }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </section>

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Action tiles (dense, no scrolling) */}
      <section
        className="tile-grid"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap:12 }}
      >
        <Link href="/intake" className="tile">
          <div className="tile-emoji">📝</div>
          <div className="tile-title">New Intake form</div>
          <div className="tile-sub">Start a new Intake Form</div>
        </Link>

        <Link href="/scan" className="tile">
          <div className="tile-emoji">📷</div>
          <div className="tile-title">Scan Tags</div>
          <div className="tile-sub">Update status by scanning a barcode</div>
        </Link>

        <Link href="/search" className="tile">
          <div className="tile-emoji">🔎</div>
          <div className="tile-title">Search</div>
          <div className="tile-sub">Find jobs by name, tag, or phone #</div>
        </Link>

        {/* Reports block */}
        <div className="tile tile-alt">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="tile-emoji">📊</div>
            <div className="tile-title" style={{ marginRight:'auto' }}>Reports</div>
            <span className="chip live">Live</span>
          </div>

          <Link href="/reports/calls" className="row-link">
            <div className="row-line">
              <span>Call Report (Ready to Call)</span>
              <span>
                <span className="chip">Meat {readyMeat}</span>
                <span className="chip" style={{ marginLeft:6 }}>Cape {readyCape}</span>
                <span className="chip" style={{ marginLeft:6 }}>Webbs {readyWebbs}</span>
              </span>
            </div>
          </Link>

          <Link href="/overnight/review" className="row-link">
            <div className="row-line">
              <span>Overnight — Missing Tag</span>
              <span className="chip">{needsTag}</span>
            </div>
          </Link>

          <Link href="/reports/called" className="row-link">
            <div className="row-line">
              <span>Called — Pickup Queue</span>
              <span className="chip">Open queue</span>
            </div>
          </Link>
        </div>

        <Link href="/tips" className="tile">
          <div className="tile-emoji">💡</div>
          <div className="tile-title">Tip Sheet</div>
          <div className="tile-sub">Short reminders for staff</div>
        </Link>

        <Link href="/faq" className="tile">
          <div className="tile-emoji">❓</div>
          <div className="tile-title">FAQ</div>
          <div className="tile-sub">Customer questions &amp; answers</div>
        </Link>
      </section>
    </main>
  );
}

