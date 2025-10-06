// app/reports/called/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ---- pricing helpers (same math as your Call Report) ---- */
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

/* ---- types ---- */
type Track = 'meat' | 'cape' | 'webbs';
type Row = {
  tag: string;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;            // meat
  capingStatus?: string;      // cape
  webbsStatus?: string;       // webbs
  lastCallAt?: string;

  // pricing inputs
  processType?: string;
  beefFat?: boolean;
  webbsOrder?: boolean;
  specialtyProducts?: boolean;
  summerSausageLbs?: string;
  summerSausageCheeseLbs?: string;
  slicedJerkyLbs?: string;

  // paid + picked-up flags
  paidProcessing?: boolean;
  pickedUpProcessing?: boolean;
  pickedUpProcessingAt?: string;
  pickedUpCape?: boolean;
  pickedUpCapeAt?: string;
  pickedUpWebbs?: boolean;
  pickedUpWebbsAt?: string;
};

const API = '/api/gas2';

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

/** Fetch all rows with any track “Called”, and expand into one row per called track. */
async function fetchCalledRows(): Promise<Array<Row & { __track: Track }>> {
  const data = await postJSON({ action: 'search', q: '@recall' });
  const base: Row[] = Array.isArray(data?.rows) ? data.rows : [];
  const out: Array<Row & { __track: Track }> = [];

  for (const r of base) {
    if (isCalled(r.status)) out.push({ ...r, __track: 'meat' });
    if (isCalled(r.capingStatus)) out.push({ ...r, __track: 'cape' });
    if (isCalled(r.webbsStatus)) out.push({ ...r, __track: 'webbs' });
  }
  out.sort((a,b) =>
    String(a.lastCallAt || '').localeCompare(String(b.lastCallAt || '')) ||
    String(a.tag).localeCompare(String(b.tag))
  );
  return out;
}

async function markPaid(tag: string) {
  // Mark regular processing as paid
  return postJSON({ action: 'save', job: { tag, paidProcessing: true } });
}
async function markPickedUp(tag: string, scope: Track) {
  // Your route.ts pickedUp handler with { scope } stamps the correct columns.
  return postJSON({ action: 'pickedUp', tag, scope });
}

export default function CalledPickupQueue() {
  const [rows, setRows] = useState<Array<Row & { __track: Track }>>([]);
  const [busy, setBusy] = useState<string>(''); // tag|track while saving
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      setRows(await fetchCalledRows());
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => rows.map(r => {
    const priceProc = suggestedProcessingPrice(r.processType, !!r.beefFat, !!r.webbsOrder);
    const priceSpec = specialtyPrice(r);
    return { ...r, priceProc, priceSpec };
  }), [rows]);

  const gridCols = '0.8fr 1.1fr 1.1fr 0.8fr 1fr 1fr 0.8fr 0.9fr 0.9fr';
  // Tag | Name | Phone | Track | Called At | Proc $ | Spec $ | Paid? | Picked Up

  return (
    <main className="light-page watermark" style={{ maxWidth: 1200, margin: '18px auto', padding: '0 14px 40px' }}>
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
            Nothing currently marked “Called”.
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
            {enriched.map(r => {
              const key = `${r.tag}|${r.__track}`;
              const picked =
                r.__track === 'meat'  ? !!r.pickedUpProcessing :
                r.__track === 'cape'  ? !!r.pickedUpCape :
                                         !!r.pickedUpWebbs;

              return (
                <div
                  key={key}
                  style={{
                    display:'grid',
                    gridTemplateColumns: gridCols,
                    gap:8,
                    alignItems:'center',
                    padding:'8px 4px',
                    borderBottom:'1px solid #f1f5f9'
                  }}
                >
                  <div style={{ fontWeight:700 }}>
                    <Link href={`/intake/${encodeURIComponent(r.tag)}`} title="Open form">{r.tag}</Link>
                  </div>
                  <div>{r.customer || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div>
                    <span className={
                      'badge ' + (r.__track === 'meat' ? 'green' : r.__track === 'cape' ? 'blue' : 'purple')
                    }>
                      {r.__track === 'meat' ? 'Meat' : r.__track === 'cape' ? 'Cape' : 'Webbs'}
                    </span>
                  </div>
                  <div>{r.lastCallAt || ''}</div>

                  <div style={{ textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                    ${r.priceProc.toFixed(2)}
                  </div>
                  <div style={{ textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                    ${r.priceSpec.toFixed(2)}
                  </div>

                  <div>
                    {r.__track === 'meat' ? (
                      r.paidProcessing ? (
                        <span className="badge ok">Paid</span>
                      ) : (
                        <button
                          className="btn"
                          disabled={!r.tag || busy === key}
                          onClick={async () => {
                            setBusy(key);
                            try { await markPaid(r.tag); await load(); } finally { setBusy(''); }
                          }}
                        >
                          {busy === key ? 'Saving…' : 'Mark Paid'}
                        </button>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>

                  <div>
                    {picked ? (
                      <span className="badge ok">Picked Up</span>
                    ) : (
                      <button
                        className="btn"
                        disabled={!r.tag || busy === key}
                        onClick={async () => {
                          setBusy(key);
                          try { await markPickedUp(r.tag, r.__track); await load(); } finally { setBusy(''); }
                        }}
                      >
                        {busy === key ? 'Saving…' : 'Picked Up'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12px; background:#1f2937; color:#fff; }
        .green { background:#065f46; }
        .blue { background:#1e3a8a; }
        .purple { background:#4c1d95; }
        .badge.ok { background:#065f46; }
        .btn { padding:6px 10px; border:1px solid #cbd5e1; border-radius:8px; background:#155acb; color:#fff; font-weight:800; cursor:pointer; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
        .muted { color:#64748b; }
      `}</style>
    </main>
  );
}
