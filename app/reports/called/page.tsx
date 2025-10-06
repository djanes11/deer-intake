'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

/* ---------------- Price helpers (same rules site-wide) ---------------- */
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

/* ---------------- Types ---------------- */
type Track = 'meat' | 'cape' | 'webbs';

type BaseRow = {
  tag: string;
  customer: string;
  phone: string;
  dropoff?: string;

  // raw statuses and info
  status?: string;         // meat
  capingStatus?: string;   // cape
  webbsStatus?: string;    // webbs
  lastCallAt?: string;

  // price inputs
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

  // computed display prices
  priceProc: number;
  priceSpec: number;

  // flags used in UI
  paidProcessing?: boolean;
  pickedUp?: boolean; // per-track picked-up flag
};

const API = '/api/gas2';

/* ---------------- Small helpers ---------------- */
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
function readyOrCalled(s?: string) {
  const v = String(s || '').toLowerCase();
  return v === 'called' || v.includes('ready') || v.includes('finish') || v.includes('complete');
}
function isCalled(s?: string) {
  return String(s || '').trim().toLowerCase() === 'called';
}

/* ---------------- API calls ---------------- */
async function openTag(tag: string) {
  const data = await postJSON({ action: 'viewlink', tag });
  const url = String(data?.url || '');
  if (url) window.open(url, '_blank', 'noopener');
}

async function fetchCalled(): Promise<Row[]> {
  // GAS @recall returns items where any track may be "Called".
  // We'll explode into one row per called track (meat/cape/webbs).
  const data = await postJSON({ action: 'search', q: '@recall' });
  const rows = (Array.isArray(data?.rows) ? data.rows : []) as BaseRow[];

  const out: Row[] = [];
  for (const r of rows) {
    const base: BaseRow = {
      tag: String((r as any)?.tag ?? (r as any)?.Tag ?? ''),
      customer: String((r as any)?.customer ?? (r as any)['Customer Name'] ?? ''),
      phone: String((r as any)?.phone ?? ''),
      dropoff: String((r as any)?.dropoff ?? ''),

      status: String((r as any)?.status ?? (r as any)?.Status ?? ''),
      capingStatus: String((r as any)?.capingStatus ?? (r as any)['Caping Status'] ?? ''),
      webbsStatus: String((r as any)?.webbsStatus ?? (r as any)['Webbs Status'] ?? ''),
      lastCallAt: String((r as any)?.lastCallAt ?? (r as any)['Last Call At'] ?? ''),

      processType: String((r as any)?.processType ?? ''),
      beefFat: !!(r as any)?.beefFat,
      webbsOrder: !!(r as any)?.webbsOrder,
      specialtyProducts: !!(r as any)?.specialtyProducts,
      summerSausageLbs: String((r as any)?.summerSausageLbs ?? ''),
      summerSausageCheeseLbs: String((r as any)?.summerSausageCheeseLbs ?? ''),
      slicedJerkyLbs: String((r as any)?.slicedJerkyLbs ?? ''),

      paidProcessing: !!((r as any)?.paidProcessing || (r as any)['Paid Processing']),
      pickedUpProcessing: !!(r as any)['Picked Up - Processing'],
      pickedUpCape: !!(r as any)['Picked Up - Cape'],
      pickedUpWebbs: !!(r as any)['Picked Up - Webbs'],
    };

    // Meat
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
    // Cape
    if (isCalled(base.capingStatus)) {
      out.push({
        tag: base.tag,
        customer: base.customer,
        phone: base.phone,
        track: 'cape',
        calledAt: base.lastCallAt || '',
        // Prices shown for visibility; "Paid" only applies to regular processing.
        priceProc: 0,
        priceSpec: 0,
        pickedUp: base.pickedUpCape,
      });
    }
    // Webbs
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

  // sort by Called At desc then by track priority Meat, Cape, Webbs
  const order: Record<Track, number> = { meat: 0, cape: 1, webbs: 2 };
  out.sort((a, b) => {
    const at = (a.calledAt || '').localeCompare(b.calledAt || '');
    if (at !== 0) return -at; // newest first
    return order[a.track] - order[b.track];
  });
  return out;
}

async function markPaid(tag: string) {
  // regular processing paid
  return postJSON({ action: 'save', job: { tag, paidProcessing: true } });
}

async function markPickedUp(tag: string, track: Track) {
  const now = new Date().toISOString();
  if (track === 'meat') {
    return postJSON({ action: 'pickedUpProcessing', tag }); // route helper stamps both fields
  }
  if (track === 'cape') {
    return postJSON({ action: 'save', job: { tag, 'Picked Up - Cape': true, 'Picked Up - Cape At': now } });
  }
  // webbs
  return postJSON({ action: 'save', job: { tag, 'Picked Up - Webbs': true, 'Picked Up - Webbs At': now } });
}

/* ---------------- UI bits ---------------- */
function TrackBadge({ track }: { track: Track | string }) {
  const t = String(track || '').toLowerCase();
  const label = t === 'webbs' ? 'Webbs' : t === 'cape' ? 'Cape' : 'Meat';

  const styles: React.CSSProperties =
    t === 'webbs'
      ? { background:'#6b21a8', color:'#fff' } // purple
      : t === 'cape'
      ? { background:'#b45309', color:'#fff' } // amber
      : { background:'#065f46', color:'#fff' }; // green default

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

export default function CalledReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string>(''); // tag while saving

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const list = await fetchCalled();
      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Prices already computed in fetch; keep memo for any later transforms if needed
  const enriched = useMemo(() => rows, [rows]);

  // Tag | Name | Phone | Track | Called At | Proc $ | Spec $ | Paid | Picked Up
  const gridCols =
    '0.8fr 1.2fr 1.1fr 0.9fr 1fr 0.8fr 0.8fr 0.9fr 0.9fr';

  return (
    <main className="light-page watermark" style={{ maxWidth: 1150, margin: '18px auto', padding: '0 14px 40px' }}>
      <div className="form-card" style={{ padding: 14, color: '#0b0f12' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>Called — Pickup Queue</h2>
          <button onClick={load} className="btn">Refresh</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div>Loading…</div>
        ) : enriched.length === 0 ? (
          <div style={{ background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:10, padding:'12px 14px' }}>
            Nobody currently in Called.
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e6e9ec', borderRadius:10, padding:8 }}>
            {/* Header */}
            <div
              style={{
                display:'grid',
                gridTemplateColumns: gridCols,
                gap:8,
                fontWeight:800,
                padding:'6px 4px',
                borderBottom:'1px solid #e6e9ec'
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
            {enriched.map(r => (
              <div
                key={`${r.tag}:${r.track}:${r.calledAt || ''}`}
                style={{
                  display:'grid',
                  gridTemplateColumns: gridCols,
                  gap:8,
                  alignItems:'center',
                  padding:'8px 4px',
                  borderBottom:'1px solid #f1f5f9'
                }}
              >
                {/* Tag link opens signed view via API */}
                <div>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); if (r.tag) openTag(r.tag); }}
                    style={{ fontWeight:700, textDecoration:'underline' }}
                  >
                    {r.tag || '—'}
                  </a>
                </div>

                <div>{r.customer || ''}</div>
                <div>{r.phone || ''}</div>

                {/* Track badge */}
                <div><TrackBadge track={r.track} /></div>

                <div>{r.calledAt || ''}</div>

                <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceProc.toFixed(2)}</div>
                <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceSpec.toFixed(2)}</div>

                {/* Paid? — only meaningful for Meat/regular */}
                <div>
                  {r.track !== 'meat' ? (
                    <span className="muted">—</span>
                  ) : r.paidProcessing ? (
                    <span className="badge ok">Paid</span>
                  ) : (
                    <button
                      className="btn"
                      disabled={!r.tag || busy === `paid:${r.tag}`}
                      onClick={async () => {
                        if (!r.tag) return;
                        setBusy(`paid:${r.tag}`);
                        try {
                          await markPaid(r.tag);
                          await load();
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      {busy === `paid:${r.tag}` ? 'Saving…' : 'Mark Paid'}
                    </button>
                  )}
                </div>

                {/* Picked Up — per track */}
                <div>
                  {r.pickedUp ? (
                    <span className="badge ok">Picked Up</span>
                  ) : (
                    <button
                      className="btn"
                      disabled={!r.tag || busy === `pu:${r.tag}:${r.track}`}
                      onClick={async () => {
                        if (!r.tag) return;
                        setBusy(`pu:${r.tag}:${r.track}`);
                        try {
                          await markPickedUp(r.tag, r.track);
                          await load();
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      {busy === `pu:${r.tag}:${r.track}` ? 'Saving…' : 'Picked Up'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
