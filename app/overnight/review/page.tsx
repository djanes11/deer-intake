'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

type Row = {
  row: number;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;
  confirmation?: string; // optional; only shown if present in any row
};

const API = '/api/gas2';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { __raw: t }; }
}

// Normalize whatever GAS returns into our Row shape.
// If your sheet adds a true “Confirmation #” later, this will pick it up.
function normRow(r: any): Row {
  const confirmation =
    (r?.confirmation != null && String(r.confirmation)) ||
    (r?.['Confirmation #'] != null && String(r['Confirmation #'])) ||
    (r?.['Confirmation'] != null && String(r['Confirmation'])) ||
    (r?.['Confirm #'] != null && String(r['Confirm #'])) ||
    (r?.confirm != null && String(r.confirm)) ||
    '';
  return {
    row: Number(r?.row ?? r?.Row ?? 0) || 0,
    customer: String(r?.customer ?? r?.['Customer Name'] ?? r?.Customer ?? '') || '',
    phone: String(r?.phone ?? r?.Phone ?? '') || '',
    dropoff:
      String(
        r?.dropoff ??
          r?.['Drop-off'] ??
          r?.['Drop Off'] ??
          r?.['Drop-off Date'] ??
          r?.['Drop Off Date'] ??
          r?.['Date Dropped'] ??
          ''
      ),
    status: String(r?.status ?? r?.Status ?? '') || '',
    tag: String(r?.tag ?? r?.Tag ?? '') || '',
    confirmation,
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

  const hasConfirmation = useMemo(
    () => rows.some(r => (r.confirmation || '').trim().length > 0),
    [rows]
  );

  async function assign(row: number, tagInput: string) {
    const t = tagInput.trim();
    if (!t) return;
    setBusyRow(row);
    try {
      await setTag(row, t);
      await load();
    } finally {
      setBusyRow(null);
    }
  }

  // Grid templates: keep things tidy whether Conf.# exists or not
  const headerCols = hasConfirmation
    ? '2fr 1fr 1.2fr 1fr 1.1fr 0.75fr' // Name | Conf | Phone | Drop-off | Assign | Open
    : '2fr 1.2fr 1fr 1.1fr 0.75fr';     // Name | Phone | Drop-off | Assign | Open

  return (
    <main
      className="light-page watermark"
      style={{ maxWidth: 980, margin: '18px auto', padding: '0 14px 40px' }}
    >
      <div className="form-card" style={{ padding: 14, color: '#0b0f12' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Overnight Drop — Needs Tag</h2>
          <button onClick={load} className="btn">Refresh</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div
            style={{
              background:'#f8fafc',
              border:'1px solid #e6e9ec',
              borderRadius:10,
              padding:'12px 14px'
            }}
          >
            No untagged overnight intakes.
          </div>
        ) : (
          <div
            style={{
              background:'#fff',
              border:'1px solid #e6e9ec',
              borderRadius:10,
              padding:8
            }}
          >
            {/* Header */}
            <div
              style={{
                display:'grid',
                gridTemplateColumns: headerCols,
                gap:8,
                fontWeight:800,
                padding:'6px 4px',
                borderBottom:'1px solid #e6e9ec'
              }}
            >
              <div>Name</div>
              {hasConfirmation && <div>Conf. #</div>}
              <div>Phone</div>
              <div>Drop-off</div>
              <div>Assign Tag</div>
              <div>Open</div>
            </div>

            {/* Rows */}
            {rows.map(r => (
              <div
                key={r.row}
                style={{
                  display:'grid',
                  gridTemplateColumns: headerCols,
                  gap:8,
                  alignItems:'center',
                  padding:'8px 4px',
                  borderBottom:'1px solid #f1f5f9'
                }}
              >
                {/* Name – clickable once tag exists */}
                <div
                  role={r.tag ? 'link' : undefined}
                  tabIndex={r.tag ? 0 : -1}
                  onClick={() => { if (r.tag) window.open(`/intake/${encodeURIComponent(r.tag)}`, '_blank'); }}
                  onKeyDown={(e) => { if (r.tag && (e.key === 'Enter' || e.key === ' ')) window.open(`/intake/${encodeURIComponent(r.tag)}`, '_blank'); }}
                  title={r.tag ? 'Open intake form' : 'Assign a tag to open the form'}
                  style={{
                    cursor: r.tag ? 'pointer' : 'default',
                    textDecoration: r.tag ? 'underline' : 'none'
                  }}
                >
                  {r.customer || ''}
                </div>

                {hasConfirmation && <div>{r.confirmation || ''}</div>}
                <div>{r.phone || ''}</div>
                <div>{r.dropoff || ''}</div>

                {/* Assign Tag */}
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input
                    placeholder="Tag #"
                    id={`t-${r.row}`}
                    disabled={busyRow === r.row}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const el = e.currentTarget as HTMLInputElement;
                        assign(r.row, el.value);
                      }
                    }}
                    style={{ flex:'1 1 auto' }}
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

                {/* Open button (disabled until tag exists) */}
                <div>
                  <button
                    className="btn"
                    disabled={!r.tag}
                    title={r.tag ? 'Open intake form in a new tab' : 'Assign a tag first'}
                    onClick={() => r.tag && window.open(`/intake/${encodeURIComponent(r.tag)}`, '_blank')}
                  >
                    Open
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
