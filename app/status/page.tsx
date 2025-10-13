// app/status/page.tsx
'use client';
import { useState } from 'react';
import { SITE } from '@/lib/config';

export default function StatusPage() {
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/public-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, tag, lastName }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Not found.');
      else setRes(j);
    } catch (e:any) {
      setErr(e?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Check Status</h1>
      <p style={{ opacity: .8, marginBottom: 16 }}>Use your Confirmation #, or Tag + Last Name.</p>

      <form onSubmit={lookup} style={{ display: 'grid', gap: 12 }}>
        <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Confirmation #" style={field}/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          <input value={tag} onChange={e=>setTag(e.target.value)} placeholder="Tag" style={field}/>
          <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last Name" style={field}/>
        </div>
        <button disabled={loading} style={btn}>{loading ? 'Checking...' : 'Check status'}</button>
      </form>

      {err ? <div style={errBox}>{err}</div> : null}

      {res ? (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            Status: {res.status}
          </div>

          <div>Tag: {res.tag || '—'}</div>
          <div>Confirmation: {res.confirmation || '—'}</div>

          {/* Extra tracks (only show when present) */}
          <div style={{ marginTop: 10, opacity: .95 }}>
            {res.tracks?.regularStatus ? (
              <div><b>Processing:</b> {res.tracks.regularStatus}</div>
            ) : null}
            {res.tracks?.capeStatus ? (
              <div><b>Cape:</b> {res.tracks.capeStatus}</div>
            ) : null}
            {res.tracks?.webbsStatus ? (
              <div><b>Webbs/Euro:</b> {res.tracks.webbsStatus}</div>
            ) : null}
            {res.tracks?.specialtyStatus ? (
              <div><b>Specialty:</b> {res.tracks.specialtyStatus}</div>
            ) : null}
          </div>

          <div style={{ marginTop: 12, fontSize: 14, opacity: .9 }}>
            <div><b>Pickup hours:</b> {SITE.hours.map(h => `${h.label} ${h.value}`).join(' · ')}</div>
            <div><b>Address:</b> <a href={SITE.mapsUrl} target="_blank" rel="noreferrer">{SITE.address}</a></div>
            <div><b>Phone:</b> {SITE.phone}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const field: React.CSSProperties = { padding:'10px 12px', border:'1px solid #1f2937', borderRadius:10, background:'#0b0f12', color:'#e5e7eb' };
const btn: React.CSSProperties = { padding:'10px 14px', border:'1px solid #1f2937', borderRadius:10, background:'#121821', color:'#e5e7eb', fontWeight:800 };
const card: React.CSSProperties = { marginTop:16, padding:16, border:'1px solid #1f2937', borderRadius:12, background:'#0b0f12', color:'#e5e7eb' };
const errBox: React.CSSProperties = { marginTop:12, padding:12, border:'1px solid #7f1d1d', borderRadius:10, background:'rgba(127,29,29,.15)', color:'#fecaca' };

