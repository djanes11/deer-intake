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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [needTag, setNeedTag] = useState(0);
  const [calledMeat, setCalledMeat] = useState(0);
  const [calledCape, setCalledCape] = useState(0);
  const [calledWebbs, setCalledWebbs] = useState(0);

  async function refresh() {
    setLoading(true);
    setErr(undefined);
    try {
      // Needs Tag
      const needs = await postJSON({ action: 'needsTag', limit: 999 });
      const needRows = Array.isArray(needs?.rows) ? needs.rows : [];
      setNeedTag(needRows.length);

      // Called rows (split by track status)
      const recall = await postJSON({ action: 'search', q: '@recall' });
      const rows = Array.isArray(recall?.rows) ? recall.rows : [];
      const toLC = (v: any) => String(v ?? '').trim().toLowerCase();
      setCalledMeat(rows.filter((r: AnyRec) => toLC(r.status) === 'called').length);
      setCalledCape(rows.filter((r: AnyRec) => toLC(r.capingStatus) === 'called').length);
      setCalledWebbs(rows.filter((r: AnyRec) => toLC(r.webbsStatus) === 'called').length);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <main className="watermark" style={{ maxWidth: 1040, margin: '16px auto', padding: '0 18px 40px' }}>
      {/* Hero */}
      <section className="hero">
        <div className="hero-kicker">Welcome</div>
        <h1 className="hero-title">McAfee Deer Processing</h1>
        <p className="hero-sub">Pick what you want to do. Quick access to the most common actions.</p>
      </section>

      {/* Today at a glance */}
      <section className="stat-group" style={{ marginTop: 12, marginBottom: 16 }}>
        <div className="stat">
          <div className="label">Needs Tag</div>
          <div className="value">{needTag}</div>
        </div>
        <div className="stat">
          <div className="label">Called — Meat</div>
          <div className="value">{calledMeat}</div>
        </div>
        <div className="stat">
          <div className="label">Called — Cape</div>
          <div className="value">{calledCape}</div>
        </div>
        <div className="stat">
          <div className="label">Called — Webbs</div>
          <div className="value">{calledWebbs}</div>
        </div>
        <button onClick={refresh} className="btn" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          Refresh
        </button>
      </section>

      {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

      {/* Tile grid */}
      <section className="tile-grid">
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

        {/* Reports (with live chips) */}
        <div className="tile tile-alt" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="tile-emoji">📊</div>
            <div className="tile-title" style={{ marginRight: 'auto' }}>Reports</div>
            {!loading && <span className="chip live">Live</span>}
          </div>

          <Link href="/reports/calls" className="row-link" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Call Report</span>
              <span className="chip">—</span>
            </div>
          </Link>

          <Link href="/overnight/review" className="row-link" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Overnight — Missing Tag</span>
              <span className="chip">{needTag}</span>
            </div>
          </Link>

          <Link href="/reports/called" className="row-link" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Called — Pickup Queue</span>
              <span>
                <span className="chip">Meat {calledMeat}</span>
                <span style={{ display: 'inline-block', width: 6 }} />
                <span className="chip">Cape {calledCape}</span>
                <span style={{ display: 'inline-block', width: 6 }} />
                <span className="chip">Webbs {calledWebbs}</span>
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
