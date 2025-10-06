'use client';

import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

// --- price helpers (client-side mirror) ---
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

type Row = {
  tag: string;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;                 // meat status
  paidProcessing?: boolean;        // already paid?
  paidSpecialty?: boolean;         // already paid specialty?
  pickedUpProcessing?: boolean;    // if present
  lastCallAt?: string;             // when set to Called (or last call)
  processType?: string;
  beefFat?: boolean;
  webbsOrder?: boolean;
  specialtyProducts?: boolean;
  summerSausageLbs?: string;
  summerSausageCheeseLbs?: string;
  slicedJerkyLbs?: string;
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

async function fetchCalled(): Promise<Row[]> {
  // GAS @recall returns items that have any track “Called”; we’ll filter to regular/meat.
  const data = await postJSON({ action: 'search', q: '@recall' });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows
    .map((r: any) => ({
      tag: String(r?.tag ?? r?.Tag ?? ''),
      customer: String(r?.customer ?? r?.['Customer Name'] ?? ''),
      phone: String(r?.phone ?? ''),
      dropoff: String(r?.dropoff ?? ''),
      status: String(r?.status ?? r?.Status ?? ''),
      paidProcessing: !!(r?.paidProcessing || r?.['Paid Processing']),
      paidSpecialty: !!(r?.paidSpecialty || r?.['Paid Specialty']),
      pickedUpProcessing: !!(r?.['Picked Up - Processing']),
      lastCallAt: String(r?.lastCallAt ?? r?.['Last Call At'] ?? ''),
      processType: String(r?.processType ?? ''),
      beefFat: !!r?.beefFat,
      webbsOrder: !!r?.webbsOrder,
      specialtyProducts: !!r?.specialtyProducts,
      summerSausageLbs: String(r?.summerSausageLbs ?? ''),
      summerSausageCheeseLbs: String(r?.summerSausageCheeseLbs ?? ''),
      slicedJerkyLbs: String(r?.slicedJerkyLbs ?? ''),
    }))
    .filter((r: Row) => String(r.status || '').toLowerCase() === 'called');
}

async function markPaid(tag: string) {
  // Supported already by your GAS save handler
  return postJSON({ action: 'save', job: { tag, paidProcessing: true } });
}

async function markPickedUp(tag: string) {
  // Requires route.ts to forward action 'pickedUpProcessing' to GAS, and api.gs to handle it.
  return postJSON({ action: 'pickedUpProcessing', tag });
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

  const enriched = useMemo(() => rows.map(r => {
    const priceProc = suggestedProcessingPrice(r.processType, !!r.beefFat, !!r.webbsOrder);
    const priceSpec = specialtyPrice(r);
    return { ...r, priceProc, priceSpec };
  }), [rows]);

  const gridCols =
    '0.8fr 1.6fr 1.2fr 1.1fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1fr';
  // Tag | Name | Phone | Called At | Proc $ | Spec $ | Paid Proc | Paid Spec | Mark Paid | Picked Up

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
            Nobody currently in Called for regular processing.
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
              <div>Called At</div>
              <div>Proc $</div>
              <div>Spec $</div>
              <div>Paid Proc</div>
              <div>Paid Spec</div>
              <div>Mark Paid</div>
              <div>Picked Up</div>
            </div>

            {/* Rows */}
            {enriched.map(r => (
              <div
                key={r.tag || r.customer}
                style={{
                  display:'grid',
                  gridTemplateColumns: gridCols,
                  gap:8,
                  alignItems:'center',
                  padding:'8px 4px',
                  borderBottom:'1px solid #f1f5f9'
                }}
              >
                <div style={{ fontVariantNumeric:'tabular-nums', fontWeight:700 }}>{r.tag || '—'}</div>
                <div>{r.customer || ''}</div>
                <div>{r.phone || ''}</div>
                <div style={{ fontVariantNumeric:'tabular-nums' }}>{r.lastCallAt || ''}</div>
                <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceProc.toFixed(2)}</div>
                <div style={{ fontVariantNumeric:'tabular-nums', textAlign:'right' }}>${r.priceSpec.toFixed(2)}</div>

                <div>{r.paidProcessing ? '✓' : '—'}</div>
                <div>{r.paidSpecialty ? '✓' : '—'}</div>

                <div>
                  {r.paidProcessing ? (
                    <span className="badge ok">Paid</span>
                  ) : (
                    <button
                      className="btn"
                      disabled={!r.tag || busy === r.tag}
                      onClick={async () => {
                        if (!r.tag) return;
                        setBusy(r.tag);
                        try {
                          await markPaid(r.tag);
                          await load();
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      {busy === r.tag ? 'Saving…' : 'Mark Paid'}
                    </button>
                  )}
                </div>

                <div>
                  {r.pickedUpProcessing ? (
                    <span className="badge ok">Picked Up</span>
                  ) : (
                    <button
                      className="btn"
                      disabled={!r.tag || busy === r.tag}
                      onClick={async () => {
                        if (!r.tag) return;
                        setBusy(r.tag);
                        try {
                          await markPickedUp(r.tag);
                          await load();
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      {busy === r.tag ? 'Saving…' : 'Picked Up'}
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
