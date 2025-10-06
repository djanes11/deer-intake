'use client';

import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

type Row = {
  row: number;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string; // will be blank for these
};

const API = '/api/gas2';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { __raw: t }; }
}

async function needsTagSearch(limit = 500) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'needsTag', limit }),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return (data.rows || []) as Row[];
}

async function setTag(row: number, tag: string) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'setTag', row, tag }),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
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
      const list = await needsTagSearch();
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function assign(row: number, tag: string) {
    if (!tag.trim()) return;
    await setTag(row, tag.trim());
    await load();
  }

  return (
    <main
      className="light-page watermark"
      style={{ maxWidth: 980, margin: '18px auto', padding: '0 14px 40px' }}
    >
      <div
        className="form-card"
        style={{
          padding: 14,
          color: '#0b0f12',              // ensure readable text
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Overnight Drop — Needs Tag</h2>
          <button onClick={load} className="btn">Refresh</button>
        </div>

        {err && (
          <div className="err" style={{ marginBottom: 8 }}>
            {err}
          </div>
        )}

        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div
            className="empty"
            style={{
              background: '#f8fafc',
              border: '1px solid #e6e9ec',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            No untagged overnight intakes. ✅
          </div>
        ) : (
          <div
            className="table like"
            style={{
              background: '#ffffff',           // solid white
              border: '1px solid #e6e9ec',
              borderRadius: 10,
              padding: 8,
            }}
          >
            {/* Header */}
            <div
              className="thead grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 8,
                fontWeight: 800,
                padding: '6px 4px',
                borderBottom: '1px solid #e6e9ec',
              }}
            >
              <div>Name</div>
              <div>Phone</div>
              <div>Drop-off</div>
              <div style={{ textAlign: 'left' }}>Assign Tag</div>
            </div>

            {/* Rows */}
            <div className="tbody">
              {rows.map((r) => (
                <div
                  key={r.row}
                  className="grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>{r.customer || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div>{r.dropoff || ''}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Tag #"
                      id={`t-${r.row}`}
                      style={{ background: '#fff' }}
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
