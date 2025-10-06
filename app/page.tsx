'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();

  const [needsTag, setNeedsTag] = useState(0);
  const [ready, setReady] = useState({ meat: 0, cape: 0, webbs: 0 });
  const [called, setCalled] = useState({ meat: 0, cape: 0, webbs: 0 });

  async function refresh() {
    setLoading(true);
    setErr(undefined);
    try {
      const data = await postJSON({ action: 'dashboardcounts' });
      setNeedsTag(Number(data?.needsTag || 0));
      setReady({
        meat: Number(data?.ready?.meat || 0),
        cape: Number(data?.ready?.cape || 0),
        webbs: Number(data?.ready?.webbs || 0),
      });
      setCalled({
        meat: Number(data?.called?.meat || 0),
        cape: Number(data?.called?.cape || 0),
        webbs: Number(data?.called?.webbs || 0),
      });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <main className="watermark" style={{ maxWidth: 1040, margin: '16px auto', padding: '0 16px 36px' }}>
      <section className="hero" style={{ marginTop: 6, marginBottom: 8 }}>
        <div className="hero-kicker">WELCOME</div>
        <h1 className="hero-title" style={{ marginBottom: 4 }}>McAfee Deer Processing</h1>
        <p className="hero-sub">Pick what you want to do. Quick access to common actions.</p>
      </section>

      {/* KPI strip */}
      <section
        className="kpi-grid"
        style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:12, margin:'10px 0 16px' }}
      >
        <div className="kpi-card"><div className="kpi-label">Needs Tag</div><div className="kpi-value">{needsTag}</div></div>
        <div className="kpi-card"><div className="kpi-label">Ready — Meat</div><div className="kpi-value">{ready.meat}</div></div>
        <div className="kpi-card"><div className="kpi-label">Ready — Cape</div><div className="kpi-value">{ready.cape}</div></div>
        <div className="kpi-card"><div className="kpi-label">Ready — Webbs</div><div className="kpi-value">{ready.webbs}</div></div>
        <button onClick={refresh} className="btn" style={{ height:'100%', minHeight:0 }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </section>

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Tiles */}
      <section className="tile-grid" style={{ gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12 }}>
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

        {/* Reports */}
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
                <span className="chip">Meat {ready.meat}</span>
                <span className="chip" style={{ marginLeft:6 }}>Cape {ready.cape}</span>
                <span className="chip" style={{ marginLeft:6 }}>Webbs {ready.webbs}</span>
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
              <span>
                <span className="chip">Meat {called.meat}</span>
                <span className="chip" style={{ marginLeft:6 }}>Cape {called.cape}</span>
                <span className="chip" style={{ marginLeft:6 }}>Webbs {called.webbs}</span>
              </span>
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

