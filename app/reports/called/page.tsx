'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

/* ---------- price helpers ---------- */
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

  status?: string;
  capingStatus?: string;
  webbsStatus?: string;
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
  paidProcessing?: boolean;
  pickedUp?: boolean;
};

const API = '/api/gas2';

/* ---------- fetch helpers ---------- */
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
function isCalled(s?: string) { return String(s || '').trim().toLowerCase() === 'called'; }

async function fetchCalled(): Promise<Row[]> {
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
        tag: base.tag, customer: base.customer, phone: base.phone, track: 'meat',
        calledAt: base.lastCallAt || '',
        priceProc: suggestedProcessingPrice(base.processType, !!base.beefFat, !!base.webbsOrder),
        priceSpec: specialtyPrice(base),
        paidProcessing: base.paidProcessing,
        pickedUp: base.pickedUpProcessing,
      });
    }
    if (isCalled(base.capingStatus)) {
      out.push({
        tag: base.tag, customer: base.customer, phone: base.phone, track: 'cape',
        calledAt: base.lastCallAt || '',
        priceProc: 0, priceSpec: 0,
        pickedUp: base.pickedUpCape,
      });
    }
    if (isCalled(base.webbsStatus)) {
      out.push({
        tag: base.tag, customer: base.customer, phone: base.phone, track: 'webbs',
        calledAt: base.lastCallAt || '',
        priceProc: 0, priceSpec: 0,
        pickedUp: base.pickedUpWebbs,
      });
    }
  }

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

/* ---------- UI ---------- */
function TrackBadge({ track }: { track: Track | string }) {
  const t = String(track || '').toLowerCase();
  const label = t === 'webbs' ? 'WEBBS' : t === 'cape' ? 'CAPE' : 'MEAT';
  const styles: React.CSSProperties =
    t === 'webbs'
      ? { background:'#5b21b6', color:'#fff' }
      : t === 'cape'
      ? { background:'#b45309', color:'#fff' }
      : { background:'#065f46', color:'#fff' };
  return (
    <span
      style={{
        display:'inline-block',
        padding:'3px 10px',
        borderRadius:999,
        fontWeight:900,
        fontSize:12,
        letterSpacing:0.6,
        lineHeight:1,
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

export default function CalledPickupQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string>('');

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

  const gridCols = '0.7fr 1.2fr 1.1fr 0.7fr 0.9fr 0.7fr 0.7fr 0.6fr 0.7fr';
  // Tag | Name | Phone | Track | Called At | Proc $ | Spec $ | Paid? | Picked Up

  function openIntake(tag: string) {
    // open the same editable intake as the Call Report
    const url = `/intake?tag=${encodeURIComponent(tag)}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <main className="light-page watermark" style={{ maxWidth: 1150, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 12, color: '#0b0f12' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Called — Pickup Queue</h2>
          <button onClick={load} className="btn small">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:8, padding:'10px 12px' }}>
            Nobody currently in Called.
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e6e9ec', borderRadius:8, overflow:'hidden' }}>
            {/* Header */}
            <div
              style={{
                display:'grid',
                gridTemplateColumns: gridCols,
                gap:6,
                fontWeight:800,
                padding:'8px 8px',
                borderBottom:'1px solid #e6e9ec',
                background:'#f8fafc',
                fontSize:14
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
            {rows.map((r, i) => {
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
                    gap:6,
                    alignItems:'center',
                    padding:'8px 8px',
                    borderBottom:'1px solid #f1f5f9',
                    cursor:'pointer',
                    background: i % 2 ? '#fff' : '#fcfdff'
                  }}
                  title="Click to select"
                >
                  <div>
                    <a
                      href={`/intake?tag=${encodeURIComponent(r.tag)}`}
                      target="_blank"
                      rel="noopener"
                      onClick={(e) => { e.stopPropagation(); openIntake(r.tag); }}
                      style={{ fontWeight:800, textDecoration:'underline' }}
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

        {/* Bottom toolbar (compact) */}
        <div className="toolbar">
          <div className="toolbar-inner">
            <div className="sel">
              {selected ? (
                <>
                  <span className="pill">#{selected.tag}</span>{' '}
                  <span className="pill small">{selected.track === 'meat' ? 'Meat' : selected.track === 'cape' ? 'Cape' : 'Webbs'}</span>{' '}
                  <span className="muted">{selected.customer || '—'}</span>{' '}
                  {selected.calledAt ? <span className="muted">• {selected.calledAt}</span> : null}
                  <span className="muted"> • Proc {selected.priceProc.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span>
                  <span className="muted"> • Spec {selected.priceSpec.toLocaleString('en-US',{style:'currency',currency:'USD'})}</span>
                </>
              ) : (
                <span className="muted">Select a row to take action</span>
              )}
            </div>

            <div className="toolbar-actions">
              <button
                className="btn secondary small"
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
                className="btn small"
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
        .row.selected { outline: 2px solid #8bc0a0; outline-offset: -2px; background: #eefaf2 !important; }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; background:#1f2937; color:#fff; font-weight:800; font-size:12px; }
        .badge.ok { background:#065f46; }
        .muted { color:#6b7280; }
        .btn { padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#155acb; color:#fff; font-weight:800; cursor:pointer; }
        .btn.secondary { background:#fff; color:#0b0f12; }
        .btn.small { padding:6px 10px; font-size:14px; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }

        .toolbar {
          position: sticky;
          bottom: 0;
          z-index: 15;
          margin-top: 10px;
          background: #0b0f12;
          border-top: 1px solid #1f2937;
          box-shadow: 0 -8px 30px rgba(0,0,0,.25);
        }
        .toolbar-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 8px 10px;
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }
        .pill { display:inline-block; padding:2px 8px; border-radius:999px; background:#111827; color:#e5e7eb; font-weight:800; }
        .pill.small { font-size:12px; background:#374151; }
      `}</style>
    </main>
  );
}
