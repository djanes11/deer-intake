// app/status/page.tsx
'use client';
import React, { useState } from 'react';

type Tracks = {
  capeStatus?: string;
  webbsStatus?: string;
  specialtyStatus?: string;
};

type StatusResp = {
  ok: boolean;
  error?: string;
  notFound?: boolean;
  customer?: string;
  tag?: string;
  confirmation?: string;
  status?: string;
  tracks?: Tracks;
  priceProcessing?: number;
  priceSpecialty?: number;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
  paid?: boolean;
};

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 6 }}>
      <div style={{ color: '#90a4ae' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Track({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#121517', border: '1px solid #22303a' }}>
      <div style={{ fontSize: 12, color: '#90a4ae' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function StatusPage() {
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');
  const [res, setRes] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch('/api/public-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, tag, lastName }),
      });
      const data = (await r.json()) as StatusResp;
      setRes(data);
    } catch (err: any) {
      setRes({ ok: false, error: err?.message || 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Order Status</h1>
      <p style={{ color: '#90a4ae', marginTop: 0 }}>
        Search by <b>Confirmation #</b> (best), or <b>Tag + Last Name</b>.
      </p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Confirmation #"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          inputMode="numeric"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input
            placeholder="Tag #"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <input
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#0d6efd', color: 'white', cursor: 'pointer' }}
        >
          {loading ? 'Searching…' : 'Check Status'}
        </button>
      </form>

      {res && (
        <div style={{ border: '1px solid #22303a', borderRadius: 12, padding: 16 }}>
          {!res.ok && res.notFound && <div>No match. Double‑check your confirmation # or your tag+last name.</div>}
          {!res.ok && !res.notFound && <div>{res.error || 'Error'}</div>}

          {res.ok && (
            <div style={{ display: 'grid', gap: 12 }}>
              <Row label="Customer" value={res.customer} />
              <Row label="Confirmation #" value={res.confirmation} />
              <Row label="Tag" value={res.tag || '—'} />

              {/* Overall Status (Meat) — show once here */}
              <Row label="Overall Status (Meat)" value={res.status || '—'} />

              {/* Other tracks only; do NOT render a duplicate Meat line */}
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {res.tracks?.capeStatus ? <Track label="Cape" value={res.tracks.capeStatus} /> : null}
                {res.tracks?.webbsStatus ? <Track label="Webbs" value={res.tracks.webbsStatus} /> : null}
                {res.tracks?.specialtyStatus ? <Track label="Specialty" value={res.tracks.specialtyStatus} /> : null}
              </div>

              {/* Optional $/paid if present */}
              {(res.priceProcessing !== undefined || res.priceSpecialty !== undefined) && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <Row label="Processing Price" value={res.priceProcessing !== undefined ? `$${res.priceProcessing.toFixed(2)}` : undefined} />
                  <Row label="Specialty Price" value={res.priceSpecialty !== undefined ? `$${res.priceSpecialty.toFixed(2)}` : undefined} />
                </div>
              )}
              {(res.paidProcessing !== undefined || res.paidSpecialty !== undefined || res.paid !== undefined) && (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <Row label="Paid (Processing)" value={res.paidProcessing === undefined ? undefined : (res.paidProcessing ? 'Yes' : 'No')} />
                  <Row label="Paid (Specialty)" value={res.paidSpecialty === undefined ? undefined : (res.paidSpecialty ? 'Yes' : 'No')} />
                  <Row label="Paid (Overall)" value={res.paid === undefined ? undefined : (res.paid ? 'Yes' : 'No')} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
