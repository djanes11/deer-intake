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

function pill(text: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: '#0b2c28',
        color: '#c7fff1',
        fontWeight: 700,
        fontSize: 13,
        lineHeight: 1,
        letterSpacing: 0.2,
      }}
    >
      {text}
    </span>
  );
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

      // Called rows (we’ll split by track status)
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

  const statBox = (label: string, value: number) => (
    <div
      style={{
        background: '#0d131a',
        border: '1px solid #1f2a35',
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 140,
      }}
      aria-label={label}
      title={label}
    >
      <div style={{ fontSize: 12, color: '#a7b2bd' }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 22, color: '#e7edf3' }}>{value}</div>
    </div>
  );

  const card = (href: string, title: string, desc: string, extra?: React.ReactNode) => (
    <Link
      href={href}
      className="home-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#0d131a',
        border: '1px solid #1f2a35',
        borderRadius: 18,
        padding: 18,
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#e7edf3' }}>{title}</div>
        {extra}
      </div>
      <div style={{ color: '#a7b2bd' }}>{desc}</div>
    </Link>
  );

  return (
    <main className="light-page watermark" style={{ maxWidth: 1200, margin: '16px auto', padding: '0 18px 40px' }}>
      <h1 style={{ margin: '10px 0 16px', fontSize: 42, lineHeight: 1.1 }}>McAfee Deer Processing</h1>
      <p style={{ margin: '0 0 20px', color: '#a7b2bd' }}>
        Pick what you want to do. Quick access to the most common actions.
      </p>

      {/* Today at a glance */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'stretch',
          marginBottom: 18,
        }}
      >
        {statBox('Needs Tag', needTag)}
        {statBox('Called — Meat', calledMeat)}
        {statBox('Called — Cape', calledCape)}
        {statBox('Called — Webbs', calledWebbs)}
        <button onClick={refresh} className="btn" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          Refresh
        </button>
      </div>

      {err && (
        <div className="err" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {card('/intake', 'New Intake form', 'Start a new Intake Form')}
        {card('/scan', 'Scan Tags', 'Update status by scanning a barcode')}
        {card('/search', 'Search', 'Find jobs by name, tag, or phone #')}

        {/* Reports with live counts */}
        <div
          className="home-card"
          style={{
            background: '#0d131a',
            border: '1px solid #1f2a35',
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e7edf3' }}>Reports</div>
            {!loading && pill('Live')}
          </div>

          <Link href="/reports/calls" className="row-link" style={{ color: '#cfe6ff', textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>Call Report</span>
              <span style={{ opacity: 0.8 }}>—</span>
            </div>
          </Link>

          <Link href="/overnight/review" className="row-link" style={{ color: '#cfe6ff', textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>Overnight — Missing Tag</span>
              <span>{pill(String(needTag))}</span>
            </div>
          </Link>

          <Link href="/reports/called" className="row-link" style={{ color: '#cfe6ff', textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>Called — Pickup Queue</span>
              <span>
                {pill(`Meat ${calledMeat}`)}{' '}
                <span style={{ display: 'inline-block', width: 6 }} />
                {pill(`Cape ${calledCape}`)}{' '}
                <span style={{ display: 'inline-block', width: 6 }} />
                {pill(`Webbs ${calledWebbs}`)}
              </span>
            </div>
          </Link>
        </div>

        {card('/tips', 'Tip Sheet', 'Short reminders for staff')}
        {card('/faq', 'FAQ', 'Customer questions & answers')}
      </div>
    </main>
  );
}
