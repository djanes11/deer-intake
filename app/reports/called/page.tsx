'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

/* ---------- price helpers (same rules site-wide) ---------- */
function normProc(s?: string) {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}
function suggestedProcessingPrice(proc?: string, beef?: boolean, webbs?: boolean) {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing','Skull-Cap','European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}
function toInt(val: any) {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function specialtyPrice(row: any) {
  if (!row?.specialtyProducts) return 0;
  const ss  = toInt(row?.summerSausageLbs);
  const ssc = toInt(row?.summerSausageCheeseLbs);
  const jer = toInt(row?.slicedJerkyLbs);
  return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}

/* ---------- types ---------- */
type Track = 'meat' | 'cape' | 'webbs';
type BaseRow = {
  tag: string;
  customer: string;
  phone: string;

  status?: string;         // meat
  capingStatus?: string;   // cape
  webbsStatus?: string;    // webbs
  lastCallAt?: string;

  processType?: string;
  beefFat?: boolean;
  webbsOrder?: boolean;
  specialtyProducts?: boolean;
  summerSausageLbs?: string;
  summerSausageCheeseLbs?: string;
  slicedJerkyLbs?: string;

  paidProcessing?: boolean;
  pickedUpProcessing?: boolean;
  pickedUpCape?: boolean;
  pickedUpWebbs?: boolean;
};
type Row = {
  tag: string;
  customer: string;
  phone: string;
  track: Track;
  calledAt?: string;
  priceProc: number;
  priceSpec: number;
  paidProcessing?: boolean; // only meaningful for meat
  pickedUp?: boolean;       // per-track
};

const API = '/api/gas2';

/* ---------- tiny fetch helpers ---------- */
async function postJSON(body: any) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let json: any;
  try { json = JSON.parse(t); } catch { json = { __raw: t }; }
  if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}`);
  return json;
}
async function openTag(tag: string) {
  const data = await postJSON({ action: 'viewlink', tag });
  const url = String(data?.url || '');
  if (url) window.open(url, '_blank', 'noopener');
}

/* ---------- data load (explode per-track like Call Report) ---------- */
function isCalled(s?: string) { return String(s || '').trim().toLowerCase() === 'called'; }

async function fetchCalled(): Promise<Row[]> {
  // GAS @recall = rows where any track may be "Called".
  const data = await postJSON({ action: 'search', q: '@recall' });
  const rows = (Array.isArray(data?.rows) ? data.rows : []) as any[];

  const out: Row[] = [];
  for (const r of rows) {
    const base: BaseRow = {
      tag: String(r?.tag ?? r?.Tag ?? ''),
      customer: String(r?.customer ?? r?.['Customer Name'] ?? ''),
      phone: String(r?.phone ?? ''),

      status: String(r?.status ?? r?.Status ?? ''),
      capingStatus: String(r?.capingStatus ?? r?.['Caping Status'] ?? ''),
      webbsStatus: String(r?.webbsStatus ?? r?.['Webbs Status'] ?? ''),
      lastCallAt: String(r?.lastCallAt ?? r?.['Last Call At'] ?? ''),

      processType: String(r?.processType ?? ''),
      beefFat: !!r?.beefFat,
      webbsOrder: !!r?.webbsOrder,
      specialtyProducts: !!r?.specialtyProducts,
      summerSausageLbs: String(r?.summerSausageLbs ?? ''),
      summerSausageCheeseLbs: String(r?.summerSausageCheeseLbs ?? ''),
      slicedJerkyLbs: String(r?.slicedJerkyLbs ?? ''),

      paidProcessing: !!(r?.paidProcessing || r?.['Paid Processing']),
      pickedUpProcessing: !!r?.['Picked Up - Processing'],
      pickedUpCape: !!r?.['Picked Up - Cape'],
      pickedUpWebbs: !!r?.['Picked Up - Webbs'],
    };

    if (isCalled(base.status)) {
      out.push({
        tag: base.tag,
        customer: base.customer,
        phone: base.phone,
        track: 'meat',
        calledAt: base.lastCallAt || '',
        priceProc: suggestedProcessingPrice(base.processType, !!base.beefFat, !!base.webbsOrder),
        priceSpec: specialtyPrice(base),
        paidProcessing: base.paidProcessing,
        pickedUp: base.pickedUpProcessing,
      });
    }
    if (isCalled(base.capingStatus)) {
      out.push({
        tag: base.tag,
        customer: base.customer,
        phone: base.phone,
        track: 'cape',
        calledAt: base.lastCallAt || '',
        priceProc: 0,
        priceSpec: 0,
        pickedUp: base.pickedUpCape,
      });
    }
    if (isCalled(base.webbsStatus)) {
      out.push({
        tag: base.tag,
        customer: base.customer,
        phone: base.phone,
        track: 'webbs',
        calledAt: base.lastCallAt || '',
        priceProc: 0,
        priceSpec: 0,
        pickedUp: base.pickedUpWebbs,
      });
    }
  }

  // newest Called first; Meat, then Cape, then Webbs
  const order: Record<Track, number> = { meat: 0, cape: 1, webbs: 2 };
  out.sort((a, b) => {
    const at = (a.calledAt || '').localeCompare(b.calledAt || '');
    if (at !== 0) return -at;
    return order[a.track] - order[b.track];
  });
  return out;
}

/* ---------- actions ---------- */
async function markPaid(tag: string) {
  return postJSON({ action: 'save', job: { tag, paidProcessing: true } });
}
async function markPickedUp(tag: string, track: Track) {
  const now = new Date().toISOString();
  if (track === 'meat') return postJSON({ action: 'pickedUpProcessing', tag });
  if (track === 'cape') return postJSON({ action: 'save', job: { tag, 'Picked Up - Cape': true, 'Picked Up - Cape At': now } });
  return postJSON({ action: 'save', job: { tag, 'Picked Up - Webbs': true, 'Picked Up - Webbs At': now } });
}

/* ---------- UI bits ---------- */
function TrackBadge({ track }: { track: Track | string }) {
  const t = String(track || '').toLowerCase();
  const label = t === 'webbs' ? 'Webbs' : t === 'cape' ? 'Cape' : 'Meat';
  const styles: React.CSSProperties =
    t === 'webbs'
      ? { background:'#6b21a8', color:'#fff' }
      : t === 'cape'
      ? { background:'#b45309', color:'#fff' }
      : { background:'#065f46', color:'#fff' };

  return (
    <span
      title={`Track: ${label}`}
      style={{
        display:'inline-block',
        padding:'4px 10px',
        borderRadius:999,
        fontWeight:800,
        fontSize:12,
        letterSpacing:0.3,
        lineHeight:1,
        whiteSpace:'nowrap',
        ...styles,
      }}
      aria-label={`Track ${label}`}
    >
      {label}
    </span>
  );
}

/* ---------- page ---------- */
export default function CalledPickupQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string>('');             // op key
  const [selectedKey, setSelectedKey] = useState<string>(''); // `${tag}|${track}`

  const selected = useMemo(
    () => rows.find(r => `${r.tag}|${r.track}` === selectedKey),
    [rows, selectedKey]
  );

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const list = await fetchCalled();
      setRows(list);
      // keep selection if still present
      if (selectedKey && !list.some(r => `${r.tag}|${r.track}` === selectedKey)) {
        setSelectedKey('');
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
      setSelectedKey('');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const gridCols = '0.9fr 1.2fr 1.2fr 0.9fr 1fr 0.9fr 0.9fr 0.8fr 0.9fr';
  // Tag | Name | Phone | Track | Called At | Proc $ | Spec $ | Paid? | Picked Up

  return (
    <main className="light-page watermark" style={{ maxWidth: 1150, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14, color: '#0b0f12' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Called — Pickup Queue</h2>
          <button onClick={load} className="btn">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:10, padding:'12px 14px' }}>
            Nobody currently in Called.
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e6e9ec', borderRadius:10, padding:0, overflow:'hidden' }}>
            {/* Header */}
            <div
              style={{
                display:'grid',
                gridTemplateColumns: gridCols,
                gap:8,
                fontWeight:800,
                padding:'10px 8px',
                borderBottom:'1px solid #e6e9ec',
                background:'#f8fafc'
              }}
            >
              <div>Tag</div>
              <div>Name</div>
              <div>Phone</div>
              <div>Track</div>
              <div>Called At</div>
              <div>Proc $</div>
              <div>Spec $</div>
              <div>Paid?</div>
              <div>Picked Up</div>
            </div>

            {/* Rows */}
            {rows.map(r => {
              const key = `${r.tag}|${r.track}`;
              const isSel = key === selectedKey;
              return (
                <div
                  key={`${r.tag}:${r.track}:${r.calledAt || ''}`}
                  className={isSel ? 'row selected' : 'row'}
                  onClick={() => setSelectedKey(key)}
                  style={{
                    display:'grid',
                    gridTemplateColumns: gridCols,
                    gap:8,
                    alignItems:'center',
                    padding:'10px 8px',
                    borderBottom:'1px solid #f1f5f9',
                    cursor:'pointer'
                  }}
                  title="Click to select"
                >
                  <div>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (r.tag) openTag(r.tag); }}
                      style={{ fontWeight:700, textDecoration:'underline' }}
                    >
                      {r.tag || '—'}
                    </a>
                  </div>
                  <div>{r.customer || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div><TrackBadge track={r.track} /></div>
                  <div>{r.calledAt || ''}</div>
                  <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceProc.toFixed(2)}</div>
                  <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceSpec.toFixed(2)}</div>
                  <div>{r.track === 'meat' ? (r.paidProcessing ? <span className="badge ok">Paid</span> : <span className="badge">No</span>) : <span className="muted">—</span>}</div>
                  <div>{r.pickedUp ? <span className="badge ok">Yes</span> : <span className="badge">No</span>}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky bottom toolbar — mirrors Call Report UX */}
        <div className="toolbar">
          <div className="toolbar-inner">
            <div className="sel">
              {selected ? (
                <>
                  <strong>Selected:</strong>{' '}
                  <span className="pill">#{selected.tag}</span>{' '}
                  <span className="pill small">{selected.track === 'meat' ? 'Meat' : selected.track === 'cape' ? 'Cape' : 'Webbs'}</span>{' '}
                  <span className="muted">{selected.customer || '—'}</span>{' '}
                  {selected.calledAt ? <span className="muted">• Called {selected.calledAt}</span> : null}
                  <span className="muted"> • Proc {selected.priceProc.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span>
                  <span className="muted"> • Spec {selected.priceSpec.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span>
                </>
              ) : (
                <span className="muted">Select a row to take action</span>
              )}
            </div>

            <div className="toolbar-actions">
              <button
                className="btn secondary"
                disabled={!selected || busy === `paid:${selected?.tag}` || selected?.track !== 'meat' || selected?.paidProcessing}
                onClick={async () => {
                  if (!selected) return;
                  setBusy(`paid:${selected.tag}`);
                  try {
                    await markPaid(selected.tag);
                    await load();
                  } finally {
                    setBusy('');
                  }
                }}
              >
                {busy === `paid:${selected?.tag}` ? 'Saving…' : 'Mark Paid'}
              </button>

              <button
                className="btn"
                disabled={!selected || busy === `pu:${selected?.tag}:${selected?.track}` || selected?.pickedUp}
                onClick={async () => {
                  if (!selected) return;
                  setBusy(`pu:${selected.tag}:${selected.track}`);
                  try {
                    await markPickedUp(selected.tag, selected.track);
                    await load();
                  } finally {
                    setBusy('');
                  }
                }}
              >
                {busy === `pu:${selected?.tag}:${selected?.track}` ? 'Saving…' : 'Picked Up'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .row.selected { outline: 2px solid var(--brand-2, #89c096); outline-offset: -2px; background: rgba(137,192,150,.08); }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; background:#1f2937; color:#fff; font-weight:800; font-size:12px; }
        .badge.ok { background:#065f46; }
        .muted { color:#6b7280; }

        /* Sticky bottom toolbar (modeled after Call Report) */
        .toolbar {
          position: sticky;
          bottom: 0;
          z-index: 15;
          margin-top: 12px;
          background: var(--bg, #0b0f12);
          border-top: 1px solid var(--border, #1f2937);
          box-shadow: 0 -8px 30px rgba(0,0,0,.25);
        }
        .toolbar-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 10px 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .pill {
          display:inline-block; padding:2px 8px; border-radius:999px;
          background:#1f2937; color:#e5e7eb; font-weight:800;
        }
        .pill.small { font-size:12px; background:#374151; }
        .toolbar-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .btn { padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#155acb; color:#fff; font-weight:800; cursor:pointer; }
        .btn.secondary { background:transparent; color:#e5e7eb; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </main>
  );
}
