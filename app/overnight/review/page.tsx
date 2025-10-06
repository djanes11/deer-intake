'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_GAS_BASE || '/api';
const USE_PROXY = !String(API_BASE || '').startsWith('http');

// Single place to control columns for both header and rows
const GRID = '2fr 0.9fr 1.2fr 1.1fr 1.3fr 0.8fr';

type Row = {
  row: number;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;            // may be blank here (that’s the point)
  confirmation?: string;   // <-- supplied by API now
};

async function apiNeedsTag() {
  const url = USE_PROXY ? '/api' : String(API_BASE);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'needsTag' })
  });
  const data = await r.json();
  if (!data?.ok) throw new Error(data?.error || 'search failed');
  return (data.rows || []) as Row[];
}

async function apiSetTag(row: number, tag: string) {
  const url = USE_PROXY ? '/api' : String(API_BASE);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'setTag', row, tag })
  });
  const data = await r.json();
  if (!data?.ok) throw new Error(data?.error || 'setTag failed');
  return data;
}

export default function OvernightReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const res = await apiNeedsTag();
      setRows(res);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const hasRows = rows.length > 0;

  async function assign(row: number, tag: string) {
    const clean = tag.trim();
    if (!clean) return;
    await apiSetTag(row, clean);
    await load();
  }

  return (
    <main className="light-page watermark" style={{ maxWidth: 980, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Overnight Drop — Needs Tag</h2>
          <button onClick={load} className="btn" style={{ minWidth: 110 }}>Refresh</button>
        </div>

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}

        {loading ? (
          <div style={{ marginTop: 12 }}>Loading…</div>
        ) : (
          <div className="table like" style={{ marginTop: 12 }}>
            {/* Header */}
            <div
              className="thead grid"
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 10,
                fontWeight: 700,
                alignItems: 'center'
              }}
            >
              <div>Name</div>
              <div>Conf. #</div>
              <div>Phone</div>
              <div>Drop-off</div>
              <div style={{ textAlign: 'center' }}>Assign Tag</div>
              <div style={{ textAlign: 'center' }}>Open</div>
            </div>

            {/* Body */}
            <div className="tbody">
              {hasRows ? rows.map(r => (
                <div
                  key={r.row}
                  className="grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    gap: 10,
                    alignItems: 'center',
                    margin: '8px 0'
                  }}
                >
                  <div>{r.customer || ''}</div>
                  <div>{r.confirmation || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div>{r.dropoff || ''}</div>

                  {/* Assign column */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Tag #"
                      id={`t-${r.row}`}
                      style={{ width: '100%' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const el = document.getElementById(`t-${r.row}`) as HTMLInputElement | null;
                          assign(r.row, el?.value || '');
                        }
                      }}
                    />
                    <button
                      className="btn"
                      onClick={() => {
                        const el = document.getElementById(`t-${r.row}`) as HTMLInputElement | null;
                        assign(r.row, el?.value || '');
                      }}
                    >
                      Assign
                    </button>
                  </div>

                  {/* Open column */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      className="btn"
                      onClick={() => {
                        // Open the intake form. If there is no tag yet, open search prefilled by phone/confirmation.
                        const base = typeof window !== 'undefined' ? window.location.origin : '';
                        if (r.tag) {
                          window.open(`/intake/${encodeURIComponent(r.tag)}`, '_blank');
                        } else {
                          const q = new URLSearchParams({
                            q: (r.confirmation || r.phone || '').trim()
                          }).toString();
                          window.open(`/search?${q}`, '_blank');
                        }
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              )) : (
                <div className="muted" style={{ marginTop: 8 }}>No untagged overnight intakes.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

