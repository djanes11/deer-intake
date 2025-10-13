'use client';
import { useState } from 'react';
import { SITE } from '@/lib/config';

export default function DropPage() {
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [processType, setProcessType] = useState('Standard Processing');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setDone(null);
    try {
      const r = await fetch('/api/public-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, phone, email, processType, notes }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Submit failed.');
      else setDone(j);
    } catch (e:any) {
      setErr(e?.message || 'Submit failed');
    } finally { setLoading(false); }
  }

  if (done) {
    const conf = String(done.confirmation || '').trim();
    const last5 = conf ? conf.slice(-5) : '———';
    return (
      <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Overnight Drop - Steps</h1>
        <ol style={{ lineHeight: 1.6 }}>
          <li>Write the <b>last 5</b> of your confirmation ({last5}) <b>and your name</b> on a tag.</li>
          <li>Attach the tag to your deer.</li>
          <li>Place the deer in the overnight freezer.</li>
        </ol>
        <p style={{ marginTop: 12, opacity: .85 }}>{SITE.storagePolicy}</p>
        <div style={{ marginTop: 12 }}>
          <a href="/status" style={{ color:'#93c5fd', textDecoration:'underline' }}>You can check your status here later.</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Overnight Drop</h1>
      <p style={{ opacity: .8, marginBottom: 16 }}>Fill this out at the freezer. You’ll get a confirmation by email if provided.</p>

      <form onSubmit={submit} style={{ display:'grid', gap: 12 }}>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Full Name" style={field} required/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone" style={field}/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={field}/>
        </div>
        <select value={processType} onChange={e=>setProcessType(e.target.value)} style={field}>
          <option>Standard Processing</option>
          <option>Caped</option>
          <option>Skull-Cap</option>
          <option>European</option>
          <option>Cape & Donate</option>
          <option>Donate</option>
        </select>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)" rows={4} style={field}/>
        <button disabled={loading} style={btn}>{loading ? 'Submitting...' : 'Submit'}</button>
      </form>

      {err ? <div style={errBox}>{err}</div> : null}
    </main>
  );
}

const field: React.CSSProperties = { padding:'10px 12px', border:'1px solid #1f2937', borderRadius:10, background:'#0b0f12', color:'#e5e7eb' };
const btn: React.CSSProperties = { padding:'10px 14px', border:'1px solid #1f2937', borderRadius:10, background:'#121821', color:'#e5e7eb', fontWeight:800 };
const errBox: React.CSSProperties = { marginTop:12, padding:12, border:'1px solid #7f1d1d', borderRadius:10, background:'rgba(127,29,29,.15)', color:'#fecaca' };
