// app/overnight/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { getJob as fetchJobFromApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

// ======================== Types ========================
type AntlerKind = '' | 'Caped' | 'European' | 'Skull-Cap';

type Row = {
  row: number;
  customer: string;
  confirmation: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;
  webbs?: boolean;
  paidProcessing?: boolean;
  antler?: AntlerKind;       // NEW
  processType?: string; // add this
  priceProcessing?: number; // NEW
};

type AnyRec = Record<string, any>;

// ======================== Config ========================
const API = '/api/gas2';
// Name | Conf | Phone | Drop-off | Antlers | Webbs | Proc $ | Assign Tag | Paid
const GRID = '1fr 1fr 1.1fr 1fr 0.6fr 0.5fr 0.7fr 1.2fr 1fr';


// ======================== Utils ========================
async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { __raw: t }; }
}
function normBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'x' || s === 'webbs' || s === 'paid';
}
function normAntler(v: any): AntlerKind {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('cape') && !s.includes('donate')) return 'Caped';
  if (s.includes('euro')) return 'European';
  if (s.includes('skull')) return 'Skull-Cap';
  return '';
}
function normRow(r: any): Row {
  // try common process-type fields
  const procRaw =
    r?.proc ?? r?.process ?? r?.processing ??
    r?.['Process'] ?? r?.['Processing'] ?? r?.['Process Type'];

  return {
    row: Number(r?.row ?? r?.Row ?? 0) || 0,
    customer: String(r?.customer ?? r?.['Customer Name'] ?? r?.Customer ?? '') || '',
    confirmation: String(r?.confirmation ?? r?.Confirmation ?? '') || '',
    phone: String(r?.phone ?? r?.Phone ?? '') || '',
    dropoff: String(
      r?.dropoff ?? r?.['Drop-off'] ?? r?.['Drop Off'] ?? r?.['Drop-off Date'] ?? r?.['Drop Off Date'] ?? r?.['Date Dropped'] ?? ''
    ),
    status: String(r?.status ?? r?.Status ?? '') || '',
    tag: String(r?.tag ?? r?.Tag ?? '') || '',
    webbs: normBool(r?.webbs ?? r?.Webbs ?? r?.webbsOrder ?? r?.WebbsOrder ?? r?.['Webbs Order'] ?? r?.['Webbs?'] ?? r?.isWebbs),
    paidProcessing: normBool(r?.paidProcessing ?? r?.PaidProcessing ?? r?.['Paid Processing'] ?? r?.paid_processing),
    antler: normAntler(procRaw || r?.processType),
processType: String(r?.processType ?? r?.Process ?? r?.['Process Type'] ?? ''),
priceProcessing: Number(r?.priceProcessing ?? r?.['Processing Price'] ?? 0) || 0,
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

// Mark Processing Paid — try several server shapes (row-first so we work pre-tag), then fall back to tag
async function serverMarkPaidProcessing(row: number, paid = true) {
  const r = await fetch('/api/gas2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'markPaidProcessing', row, paid }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
}


// tiny helper: wait for 2 paints so PrintSheet is in the DOM/layout before printing
const nextFrame = () => new Promise(requestAnimationFrame);
async function waitForRender() { await nextFrame(); await nextFrame(); }

const antlerFrom = (s?: string) => {
  const v = String(s || '').toLowerCase();
  if (!v) return '';
  if (v.includes('cape')) return 'Caped';
  if (v.includes('euro')) return 'European';
  if (v.includes('skull')) return 'Skull-Cap';
  return '';
};


// Wait until the PrintSheet signals the barcode is drawn or timeout
function waitForBarcodeReady(timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (ok: boolean) => { if (!resolved) { resolved = true; cleanup(); resolve(ok); } };
    const checkAttr = () => { const el = document.querySelector('#print-area [data-barcode-ready]'); if (el) done(true); };
    const onReady = () => done(true);
    const cleanup = () => { document.removeEventListener('barcode:ready', onReady as any); };
    document.addEventListener('barcode:ready', onReady as any, { once: true });
    const start = performance.now();
    const tick = () => { if (resolved) return; checkAttr(); if (resolved) return; if (performance.now() - start >= timeoutMs) { done(false); } else { requestAnimationFrame(tick); } };
    tick();
  });
}

export default function OvernightReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [busyRow, setBusyRow] = useState<number | null>(null);

  // print state
  const [printJob, setPrintJob] = useState<AnyRec | null>(null);
  const printingRef = useRef(false);

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
    const t = (tagInput || '').trim();
    if (!t || printingRef.current) return;

    setBusyRow(row);
    try {
      await setTag(row, t);                   // 1) assign on server (and send email)
      const fresh = await fetchJobFromApi(t); // 2) get normalized job
      const job = fresh?.job ?? null;

      if (job) {
        printingRef.current = true;
        setPrintJob(job);                     // 3) mount into #print-area
        await waitForRender();                // 4) ensure it's laid out
        await waitForBarcodeReady(2000);      // 5) wait for barcode (or timeout)
        const cleanup = () => {
          setTimeout(() => {
            setPrintJob(null);
            printingRef.current = false;
          }, 250);
          window.removeEventListener('afterprint', cleanup as any);
        };
        window.addEventListener('afterprint', cleanup as any);
        window.print();                       // 6) print just the sheet via CSS below
      }

      await load();                           // 7) refresh table
    } catch (e) {
      console.error(e);
    } finally {
      setBusyRow(null);
    }
  }

async function togglePaid(row: number, current?: boolean) {
  setBusyRow(row);
  try {
    await serverMarkPaidProcessing(row, !current);
    await load();
  } finally { setBusyRow(null); }
}


  const cell = { overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' };

  return (
    <main className="light-page watermark" style={{ maxWidth: 1240, margin: '18px auto', padding: '0 14px 40px' }}>
      {/* list UI (hidden during print) */}
      <div className="form-card no-print" style={{ padding: 14, color: '#0b0f12' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto' }}>
            Overnight Drop — Needs Tag
            <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 10, color: '#64748b' }}>
              ({rows.length} untagged)
            </span>
          </h2>
          <button onClick={load} className="btn small">Refresh</button>
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
              <div style={{ textAlign:'center' }}>Antlers</div>
              <div style={{ textAlign:'center' }}>Webbs</div>
	      <div style={{ textAlign:'center' }}>Proc $</div>
              <div style={{ textAlign:'center' }}>Assign Tag</div>
              <div style={{ textAlign:'center' }}>Paid</div>
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

                <div style={{ display:'flex', justifyContent:'center' }}>
  {(() => {
    const label = r.antler || antlerFrom(r.processType);
    if (!label) return null;
    return <span className={`pill ${label.replace(/\s+/g,'-').toLowerCase()}`}>{label}</span>;
  })()}
</div>


                {/* Webbs column */}
                <div style={{ textAlign:'center', fontWeight: 800, color: r.webbs ? '#15803d' : '#64748b' }}>
                  {r.webbs ? 'Yes' : ''}
                </div>
<div style={{ textAlign:'center', fontVariantNumeric:'tabular-nums' as const }}>
  {r.priceProcessing ? `$${Number(r.priceProcessing).toFixed(2)}` : ''}
</div>


                {/* Assign Tag */}
                <div className="assign-group" style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'flex-start', minWidth: 0, flexWrap:'nowrap' }}>
                  <input
                    placeholder="Tag #"
                    id={`t-${r.row}`}
                    disabled={busyRow === r.row}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') assign(r.row, (e.currentTarget as HTMLInputElement).value);
                    }}
                    style={{ width:'7ch', fontVariantNumeric:'tabular-nums', padding:'6px 8px' }}
                  />
                  <button
                    className="btn small"
                    disabled={busyRow === r.row}
                    onClick={() => {
                      const el = document.getElementById(`t-${r.row}`) as HTMLInputElement | null;
                      assign(r.row, el?.value || '');
                    }}
                  >
                    {busyRow === r.row ? 'Saving…' : 'Assign'}
                  </button>
                </div>

                {/* Paid toggle */}
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <button
                    className={`btn small ${r.paidProcessing ? 'ok' : 'warn'}`}
                    disabled={busyRow === r.row}
                    onClick={() => togglePaid(r.row, r.paidProcessing)}
                    title={r.paidProcessing ? 'Click to mark as UNPAID' : 'Click to mark as PAID'}
                    style={{ minWidth: 96 }}
                  >
                    {r.paidProcessing ? 'Paid' : 'Mark Paid'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRINT AREA: only this renders to paper */}
      <div id="print-area">
        {printJob ? <PrintSheet job={printJob} /> : null}
      </div>

      <style jsx global>{`
        .btn { display:inline-flex; align-items:center; justify-content:center; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #155acb; color: #fff; font-weight: 800; cursor: pointer; line-height: 1; }
        .btn.small { padding: 6px 10px; font-size: 14px; border-radius: 8px; }
        .assign-group input { min-width: 7ch; }
        .assign-group .btn.small { white-space: nowrap; }
        .btn.ok { background:#22c55e; border-color:#22c55e; }
        .btn.warn { background:#f97316; border-color:#f97316; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }

        /* Antler pill styles */
        .pill { padding: 4px 10px; border-radius: 999px; font-weight: 800; border: 2px solid transparent; }
        .pill.caped { background:#fecaca; color:#7f1d1d; border-color:#ef4444; }       /* red */
        .pill.european { background:#dbeafe; color:#1e3a8a; border-color:#3b82f6; }   /* blue */
        .pill.skull-cap { background:#dcfce7; color:#065f46; border-color:#22c55e; }  /* green */

        /* Print rules: show ONLY #print-area */
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </main>
  );
}
