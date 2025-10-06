'use client';

import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

type Row = {
  row: number;
  customer: string;
  confirmation: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;
};

const API = '/api/gas2';

// Name | Conf # | Phone | Drop-off | Assign
const GRID = '2fr 0.9fr 1.2fr 1fr 1.25fr';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { __raw: t }; }
}

function normRow(r: any): Row {
  return {
    row: Number(r?.row ?? r?.Row ?? 0) || 0,
    customer: String(r?.customer ?? r?.['Customer Name'] ?? r?.Customer ?? '') || '',
    confirmation: String(r?.confirmation ?? '') || '',
    phone: String(r?.phone ?? r?.Phone ?? '') || '',
    dropoff:
      String(
        r?.dropoff ?? r?.['Drop-off'] ?? r?.['Drop Off'] ??
        r?.['Drop-off Date'] ?? r?.['Drop Off Date'] ?? r?.['Date Dropped'] ?? ''
      ),
    status: String(r?.status ?? r?.Status ?? '') || '',
    tag: String(r?.tag ?? r?.Tag ?? '') || '',
  };
}

async function fetchNeedsTag(limit = 500): Promise<Row[]> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'needsTag', limit }),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map(normRow);
}

async function setTag(row: number, tag: string) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
  const [busyRow, setBusyRow] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const list = await fetchNeedsTag();
      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function assign(row: number, tagInput: string) {
    const t = tagInput.trim();
    if (!t) return;
    setBusyRow(row);
    try {
      await setTag(row, t); // server will also send the drop-off email
      await load();
    } finally {
      setBusyRow(null);
    }
  }

  const cell = { overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' };

  return (
    <main className="light-page watermark" style={{ maxWidth: 980, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14, color: '#0b0f12' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Overnight Drop — Needs Tag</h2>
          <button onClick={load} className="btn">Refresh</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:10, padding:'12px 14px' }}>
            No untagged overnight intakes.
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e6e9ec', borderRadius:10, padding:8 }}>
            {/* Header */}
            <div
              style={{
                display:'grid',
                gridTemplateColumns: GRID,
                gap:10,
                fontWeight:800,
                padding:'6px 4px',
                borderBottom:'1px solid #e6e9ec',
                alignItems:'center'
              }}
            >
              <div>Name</div>
              <div>Conf. #</div>
              <div>Phone</div>
              <div>Drop-off</div>
              <div style={{ textAlign:'center' }}>Assign Tag</div>
            </div>

            {/* Rows */}
            {rows.map(r => (
              <div
                key={r.row}
                style={{
                  display:'grid',
                  gridTemplateColumns: GRID,
                  gap:10,
                  alignItems:'center',
                  padding:'8px 4px',
                  borderBottom:'1px solid #f1f5f9'
                }}
              >
                <div style={{ ...cell }}>{r.customer || ''}</div>
                <div style={{ ...cell, fontVariantNumeric:'tabular-nums' as const }}>{r.confirmation || ''}</div>
                <div style={cell}>{r.phone || ''}</div>
                <div style={cell}>{r.dropoff || ''}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center', minWidth: 0 }}>
                  <input
                    placeholder="Tag #"
                    id={`t-${r.row}`}
                    disabled={busyRow === r.row}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') assign(r.row, (e.currentTarget as HTMLInputElement).value);
                    }}
                    style={{ flex:'1 1 auto', minWidth: 0 }}
                  />
                  <button
                    className="btn"
                    disabled={busyRow === r.row}
                    onClick={() => {
                      const el = document.getElementById(`t-${r.row}`) as HTMLInputElement | null;
                      assign(r.row, el?.value || '');
                    }}
                    style={{ whiteSpace:'nowrap' }}
                  >
                    {busyRow === r.row ? 'Saving…' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

