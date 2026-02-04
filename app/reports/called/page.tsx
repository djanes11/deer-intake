'use client';

import { useEffect, useMemo, useState } from 'react';
import { searchJobs, saveJob } from '@/lib/api';

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
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 :
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
  const ss = toInt(row?.summerSausageLbs);
  const ssc = toInt(row?.summerSausageCheeseLbs);
  const jer = toInt(row?.slicedJerkyLbs);
  return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}

/* ---------- types ---------- */
type Track = 'meat' | 'cape' | 'webbs';
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

/* ---------- helpers ---------- */
function isCalled(s?: string) {
  return String(s || '').trim().toLowerCase() === 'called';
}

/**
 * Pulls "Called" items from Supabase via /api/v2/jobs
 * Requires backend support: searchJobs('@recall') returns rows.
 */
async function fetchCalled(): Promise<Row[]> {
  const res = await searchJobs('@recall');
  const rows = (Array.isArray(res?.rows) ? res.rows : []) as any[];

  const out: Row[] = [];

  for (const r of rows) {
    const tag = String(r?.tag ?? r?.Tag ?? '').trim();
    if (!tag) continue;

    const customer = String(r?.customer ?? r?.Customer ?? r?.['Customer Name'] ?? '').trim();
    const phone = String(r?.phone ?? r?.Phone ?? '').trim();

    const status = String(r?.status ?? r?.Status ?? '').trim();
    const capingStatus = String(r?.capingStatus ?? r?.['Caping Status'] ?? '').trim();
    const webbsStatus = String(r?.webbsStatus ?? r?.['Webbs Status'] ?? '').trim();

    const calledAt =
      String(r?.lastCallAt ?? r?.lastCalledAt ?? r?.['Last Call At'] ?? r?.calledAt ?? '').trim();

    const priceProc = suggestedProcessingPrice(
      r?.processType ?? r?.['Process Type'],
      !!(r?.beefFat ?? r?.['Beef Fat']),
      !!(r?.webbsOrder ?? r?.['Webbs Order'])
    );
    const priceSpec = specialtyPrice(r);

    const paidProcessing = !!(r?.paidProcessing ?? r?.['Paid Processing']);
    const pickedUpProcessing = !!(r?.pickedUpProcessing ?? r?.['Picked Up - Processing']);
    const pickedUpCape = !!(r?.pickedUpCape ?? r?.['Picked Up - Cape']);
    const pickedUpWebbs = !!(r?.pickedUpWebbs ?? r?.['Picked Up - Webbs']);

    if (isCalled(status)) {
      out.push({ tag, customer, phone, track: 'meat', calledAt, priceProc, priceSpec, paidProcessing, pickedUp: pickedUpProcessing });
    }
    if (isCalled(capingStatus)) {
      out.push({ tag, customer, phone, track: 'cape', calledAt, priceProc, priceSpec, pickedUp: pickedUpCape });
    }
    if (isCalled(webbsStatus)) {
      out.push({ tag, customer, phone, track: 'webbs', calledAt, priceProc, priceSpec, pickedUp: pickedUpWebbs });
    }
  }

  const order: Record<Track, number> = { meat: 0, cape: 1, webbs: 2 };
  out.sort((a, b) => {
    const at = (a.calledAt || '').localeCompare(b.calledAt || '');
    if (at !== 0) return -at; // newest first
    return order[a.track] - order[b.track];
  });

  return out;
}

/* ---------- actions ---------- */
async function markPaid(tag: string) {
  // meat track only
  return saveJob({ tag, paidProcessing: true } as any);
}

async function markPickedUp(tag: string, track: Track) {
  const now = new Date().toISOString();

  if (track === 'meat') {
    return saveJob({ tag, status: 'Picked Up', pickedUpProcessing: true, pickedUpProcessingAt: now } as any);
  }
  if (track === 'cape') {
    return saveJob({ tag, capingStatus: 'Picked Up', pickedUpCape: true, pickedUpCapeAt: now } as any);
  }
  return saveJob({ tag, webbsStatus: 'Picked Up', pickedUpWebbs: true, pickedUpWebbsAt: now } as any);
}

/* ---------- UI ---------- */
function TrackBadge({ track }: { track: Track | string }) {
  const t = String(track || '').toLowerCase();
  const label = t === 'webbs' ? 'Webbs' : t === 'cape' ? 'Cape' : 'Meat';
  const styles: React.CSSProperties =
    t === 'webbs'
      ? { background: '#5b21b6', color: '#fff' }
      : t === 'cape'
      ? { background: '#92400e', color: '#fff' }
      : { background: '#065f46', color: '#fff' };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: 0.3,
        lineHeight: 1,
        textTransform: 'capitalize',
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
    () => rows.find((r) => `${r.tag}|${r.track}` === selectedKey),
    [rows, selectedKey]
  );

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const list = await fetchCalled();
      setRows(list);
      if (selectedKey && !list.some((r) => `${r.tag}|${r.track}` === selectedKey)) {
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

  function openIntake(tag: string) {
    const url = `/intake?tag=${encodeURIComponent(tag)}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <main style={{ maxWidth: 1200, margin: '18px auto', padding: '0 14px 40px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h2 style={{ margin: 0, flex: '1 1 auto', color: '#e5e7eb' }}>Called — Pickup Queue</h2>
          <button onClick={load} className="btn small">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}

        {loading ? (
          <div className="muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">Nobody currently in Called.</div>
        ) : (
          <div className="table">
            <div className="thead" style={{ gridTemplateColumns: gridCols }}>
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

            {rows.map((r, i) => {
              const key = `${r.tag}|${r.track}`;
              const isSel = key === selectedKey;
              return (
                <div
                  key={`${r.tag}:${r.track}:${r.calledAt || ''}`}
                  className={`trow ${isSel ? 'selected' : ''} ${i % 2 ? 'odd' : ''}`}
                  onClick={() => setSelectedKey(key)}
                  style={{ gridTemplateColumns: gridCols }}
                  title="Click to select"
                >
                  <div>
                    <a
                      href={`/intake?tag=${encodeURIComponent(r.tag)}`}
                      target="_blank"
                      rel="noopener"
                      onClick={(e) => { e.stopPropagation(); openIntake(r.tag); }}
                    >
                      {r.tag || '—'}
                    </a>
                  </div>
                  <div>{r.customer || ''}</div>
                  <div>{r.phone || ''}</div>
                  <div><TrackBadge track={r.track} /></div>
                  <div>{r.calledAt || ''}</div>
                  <div className="num">${r.priceProc.toFixed(2)}</div>
                  <div className="num">${r.priceSpec.toFixed(2)}</div>
                  <div>{r.track === 'meat' ? (r.paidProcessing ? <span className="badge ok">Paid</span> : <span className="badge">No</span>) : <span className="muted">—</span>}</div>
                  <div>{r.pickedUp ? <span className="badge ok">Yes</span> : <span className="badge">No</span>}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="toolbar">
          <div className="toolbar-inner">
            <div className="sel">
              {selected ? (
                <>
                  <span className="pill">#{selected.tag}</span>{' '}
                  <span className="pill small">{selected.track === 'meat' ? 'Meat' : selected.track === 'cape' ? 'Cape' : 'Webbs'}</span>{' '}
                  <span className="muted">{selected.customer || '—'}</span>{' '}
                  {selected.calledAt ? <span className="muted">• {selected.calledAt}</span> : null}
                  <span className="muted"> • Proc {selected.priceProc.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                  <span className="muted"> • Spec {selected.priceSpec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                </>
              ) : (
                <span className="muted">Select a row to take action</span>
              )}
            </div>

            <div className="toolbar-actions">
              <button
                className="btn secondary small"
                disabled={!selected || busy === `paid:${selected?.tag}` || selected?.track !== 'meat' || !!selected?.paidProcessing}
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
                disabled={!selected || busy === `pu:${selected?.tag}:${selected?.track}` || !!selected?.pickedUp}
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
        .table { background:#0f172a; border:1px solid #111827; border-radius:12px; overflow:hidden; color:#e5e7eb; }
        .thead { display:grid; gap:8px; font-weight:800; padding:12px 12px; border-bottom:1px solid #111827; background:#0b1220; font-size:15px; }
        .trow { display:grid; gap:8px; align-items:center; padding:12px 12px; border-bottom:1px solid #0b1220; background:#0f172a; cursor:pointer; }
        .trow.odd { background:#0e1627; }
        .trow.selected { outline:2px solid #1f6f3e; outline-offset:-2px; background:#062d25 !important; }
        a { color:#9fe3b4; font-weight:800; text-decoration:underline; }
        .num { font-variant-numeric: tabular-nums; text-align:right; }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; background:#1f2937; color:#fff; font-weight:800; font-size:12px; }
        .badge.ok { background:#065f46; }
        .muted { color:#9ca3af; }
        .empty { background:#0f172a; border:1px solid #111827; color:#e5e7eb; border-radius:12px; padding:12px; }
        .btn { padding:8px 12px; border:1px solid #2b3a55; border-radius:10px; background:#155acb; color:#fff; font-weight:800; cursor:pointer; }
        .btn.secondary { background:#0f172a; color:#e5e7eb; }
        .btn.small { padding:6px 10px; font-size:14px; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
        .toolbar { position: sticky; bottom: 0; z-index: 15; margin-top: 10px; background: #0b0f12; border-top: 1px solid #111827; box-shadow: 0 -8px 30px rgba(0,0,0,.25); }
        .toolbar-inner { max-width: 1150px; margin: 0 auto; padding: 10px 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between; color:#e5e7eb; }
        .pill { display:inline-block; padding:2px 8px; border-radius:999px; background:#111827; color:#e5e7eb; font-weight:800; }
        .pill.small { padding:2px 8px; }
      `}</style>
    </main>
  );
}
