'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchJobs } from '@/lib/api';

type Row = {
  row: number;
  tag: string;
  customer?: string;
  phone?: string;
  status?: string;
  dropoff?: string;
};

const REFRESH_MS = 5000;

export default function ReadyBoard() {
  const [processing, setProcessing] = useState<Row[]>([]);
  const [finished, setFinished] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Poll GAS every few seconds
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        setErr('');
        const [p, f] = await Promise.all([
          searchJobs({ status: 'Processing', limit: 200 }),
          searchJobs({ status: 'Finished', limit: 200 }),
        ]);
        if (!alive) return;
        if (!p?.ok || !f?.ok) throw new Error(p?.error || f?.error || 'Board fetch failed');

        const proc = (p.rows || []).map((r:any) => ({ ...r, customer: r.customer || r.name }));
        const fin  = (f.rows || []).map((r:any) => ({ ...r, customer: r.customer || r.name }));

        setProcessing(proc);
        setFinished(fin);
      } catch (e:any) {
        if (alive) setErr(e?.message || 'Board fetch failed');
      } finally {
        if (alive) setLoading(false);
      }
    };

    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Fancy fullscreen + wake lock for TVs
  const wakeRef = useRef<any>(null);
  const goFullscreen = async () => {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch {}
    try {
      // @ts-ignore
      if (!wakeRef.current && navigator.wakeLock?.request) {
        // @ts-ignore
        wakeRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {}
  };

  const Section = ({ title, rows, color }:{ title:string; rows:Row[]; color:string }) => (
    <section className="card">
      <header className="head" style={{ borderColor: color }}>
        <h2 style={{ color }}>{title}</h2>
        <div className="count" style={{ color }}>{rows.length}</div>
      </header>
      <div className="grid">
        {rows.length === 0 && <div className="empty">—</div>}
        {rows.map((r) => (
          <div key={`${r.tag}-${r.row}`} className="item">
            <div className="tag">{r.tag}</div>
            <div className="name">{r.customer || '—'}</div>
            <div className="meta">{r.dropoff || ''}</div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <main className="board-wrap">
      <div className="topbar">
        <div className="title">Butcher Board</div>
        <div className="spacer" />
        <button className="btn" onClick={goFullscreen}>Fullscreen</button>
      </div>

      {err && <div className="err">{err}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && (
        <div className="cols">
          <Section title="Now Processing" rows={processing} color="#2563eb" />
          <Section title="Finished & Ready" rows={finished} color="#16a34a" />
        </div>
      )}

      <style jsx>{`
        .board-wrap{ max-width:1400px; margin:10px auto; padding:10px; font-family:Arial, sans-serif; }
        .topbar{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .title{ font-weight:900; font-size:28px; letter-spacing:.5px; }
        .spacer{ flex:1; }
        .btn{ padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:#155acb; color:#fff; font-weight:800; }

        .cols{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .card{ background:#fff; border:1px solid var(--border); border-radius:14px; padding:12px; }
        .head{ display:flex; align-items:center; gap:10px; border-left:4px solid; padding-left:8px; margin-bottom:10px; }
        h2{ margin:0; font-size:20px; }
        .count{ font-weight:900; margin-left:auto; }
        .grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; }
        .item{ border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#fbfdff; display:grid; gap:4px; }
        .item .tag{ font-size:22px; font-weight:900; letter-spacing:.5px; }
        .item .name{ font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .item .meta{ color:#6b7280; font-size:12px; }
        .empty{ color:#6b7280; font-size:14px; }

        @media (max-width: 1100px){ .grid{ grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 740px){ .grid{ grid-template-columns: 1fr; } .cols{ grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
