'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

// Always use our Next API proxy. Do NOT call GAS directly from the browser.
const API_BASE = '/api/gas2';

type Row = {
  row: number;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;
  phoneLast4?: string;
};

async function parseJsonSafe(r: Response) {
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { __raw: text }; }
}

async function apiSearch(q: string) {
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'search', q }),
    cache: 'no-store',
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    throw new Error(`search failed: ${msg}`);
  }
  // GAS returns { ok, rows } via our proxy
  return (data.rows || []) as Row[];
}

async function apiSetTag(row: number, tag: string) {
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'setTag', row, tag }),
    cache: 'no-store',
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    throw new Error(`setTag failed: ${msg}`);
  }
  return data;
}

export default function OvernightReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>(undefined);

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const res = await apiSearch('@needsTag'); // GAS should filter Requires Tag = TRUE
      setRows(res);
    } catch (e: any) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.customer?.toLowerCase().includes(needle) ||
        r.phone?.replace(/\D+/g, '').includes(needle)
    );
  }, [q, rows]);

  async function assign(row: number, tag: string) {
    if (!tag.trim()) return;
    await apiSetTag(row, tag.trim());
    await load();
  }

  return (
    <main className="light-page watermark" style={{ maxWidth: 980, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14 }}>
        <h2>Overnight Drop — Needs Tag</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <input
            placeholder="Search name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: '1 1 auto' }}
          />
          <button onClick={load} className="btn">Refresh</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="table like">
            <div
              className="thead grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 8,
                fontWeight: 700,
              }}
            >
              <div>Name</div>
              <div>Phone</div>
              <div>Drop-off</div>
              <div>Assign Tag</div>
            </div>

            <div className="tbody">
              {filtered.map((r) => (
                <div
                  key={r.row}
                  className="grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: 8,
                    alignItems: 'center',
                    margin: '8px 0',
                  }}
                >
                  <div>{r.customer || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div>{r.dropoff || ''}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="Tag #" id={`t-${r.row}`} />
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

              {filtered.length === 0 && (
                <div className="muted" style={{ marginTop: 8 }}>
                  No untagged overnight intakes.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
