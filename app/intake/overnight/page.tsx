'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_GAS_BASE || '/api'; // falls back to your Next proxy
const USE_PROXY = !String(API_BASE || '').startsWith('http');

function nowISODate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

export default function OvernightIntake() {
  const [form, setForm] = useState({
    customer: '',
    phone: '',
    phoneLast4: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    county: '',
    sex: '',
    processType: 'Standard Processing',
    beefFat: false,
    webbsOrder: false,
    specialtyProducts: false,
    summerSausageLbs: '',
    summerSausageCheeseLbs: '',
    slicedJerkyLbs: '',
    notes: '',
    dropoff: nowISODate(),
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string|undefined>(undefined);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]){
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      if (!form.customer.trim()) throw new Error('Name on tag is required');
      const last4 = (form.phoneLast4 || '').replace(/\D+/g,'');
      if (last4.length !== 4) throw new Error('Phone last-4 is required');
      if (!form.phone.trim() || !form.email.trim()) throw new Error('Phone and Email are required');
      if (!form.processType) throw new Error('Process Type is required');

      const job = {
        // No tag here — staff will assign later
        customer: form.customer.trim(),
        phone: form.phone.trim(),
        phoneLast4: last4,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        county: form.county.trim(),
        sex: form.sex.trim(),
        processType: form.processType,
        beefFat: !!form.beefFat,
        webbsOrder: !!form.webbsOrder,
        specialtyProducts: !!form.specialtyProducts,
        summerSausageLbs: form.summerSausageLbs,
        summerSausageCheeseLbs: form.summerSausageCheeseLbs,
        slicedJerkyLbs: form.slicedJerkyLbs,
        notes: form.notes,
        dropoff: form.dropoff,
        status: 'Dropped Off',
        requiresTag: true,
      };

      const url = USE_PROXY ? '/api' : String(API_BASE);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'save', job }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || 'Save failed');
      setDone(true);
    } catch (err:any) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <main className="light-page watermark" style={{ maxWidth: 780, margin: '18px auto', padding: '0 14px 40px' }}>
        <div className="form-card" style={{ padding: 14 }}>
          <h1>Thanks — we’ve got your info</h1>
          <p className="muted">Please make sure the deer’s <b>paper tag</b> shows your <b>full name</b> and the <b>last 4 digits</b> of your phone number so we can match it.</p>
          <a href="/" className="btn" style={{ display:'inline-block', marginTop:10 }}>Return Home</a>
        </div>
      </main>
    );
  }

  return (
    <main className="light-page watermark" style={{ maxWidth: 860, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14 }}>
        <h2 style={{margin:'6px 0 10px'}}>Overnight Drop — Intake</h2>
        <p className="muted" style={{marginTop:0}}>Fill this out when using the 24‑hour drop. Do <b>not</b> enter a tag number — staff will assign it at opening.</p>

        {error && <div className="err" role="alert" style={{marginBottom:8}}>{error}</div>}

        <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
          <div style={{gridColumn:'span 6'}}>
            <label>Name on tag</label>
            <input value={form.customer} onChange={e=>set('customer', e.target.value)} />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <label>Phone (last‑4 for the tag)</label>
            <input value={form.phoneLast4} onChange={e=>set('phoneLast4', e.target.value)} inputMode="numeric" />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <label>Phone</label>
            <input value={form.phone} onChange={e=>set('phone', e.target.value)} />
          </div>
          <div style={{gridColumn:'span 6'}}>
            <label>Email</label>
            <input value={form.email} onChange={e=>set('email', e.target.value)} />
          </div>
          <div style={{gridColumn:'span 6'}}>
            <label>Drop‑off Date</label>
            <input type="date" value={form.dropoff} onChange={e=>set('dropoff', e.target.value)} />
          </div>

          <div style={{gridColumn:'span 6'}}>
            <label>County Killed</label>
            <input value={form.county} onChange={e=>set('county', e.target.value)} />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <label>Deer Sex</label>
            <input value={form.sex} onChange={e=>set('sex', e.target.value)} />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <label>Process Type</label>
            <select value={form.processType} onChange={e=>set('processType', e.target.value)}>
              <option>Standard Processing</option>
              <option>Caped</option>
              <option>Skull-Cap</option>
              <option>European</option>
              <option>Donate</option>
              <option>Cape & Donate</option>
            </select>
          </div>

          <div style={{gridColumn:'span 12'}}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={e=>set('notes', e.target.value)} rows={3}/>
          </div>
        </div>

        <div style={{marginTop:12, display:'flex', gap:10, alignItems:'center'}}>
          <button disabled={saving} onClick={submit} className="btn">{saving ? 'Saving…' : 'Submit'}</button>
          <span className="muted">Staff will attach the tag in the morning.</span>
        </div>
      </div>
    </main>
  );
}
