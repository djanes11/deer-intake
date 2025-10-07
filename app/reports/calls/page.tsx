'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Job } from '@/lib/api';
import { searchJobs, getJob, markCalled, logCallSimple, saveJob } from '@/lib/api';
import { suggestedProcessingPrice } from '@/lib/api';

/* ---------- helpers ---------- */
// Show only the regular processing price (meat track). Cape/Webbs show an em dash.
function displayProcessingPrice(r: any): string {
  // If the flattened row already carries a computed price, prefer it
  const fromRow =
    Number(r.priceProcessing ?? r.processingPrice ?? r['Processing Price'] ?? 0);

  if (r.__track === 'meat') {
    if (fromRow > 0) return `$${fromRow.toFixed(2)}`;

    // Fallback: compute from the job fields (matches our global price logic)
    const proc =
      r.processType ?? r['Process Type'] ?? r.ProcessType ?? r.process ?? '';
    const beef = !!(r.beefFat ?? r['Beef Fat']);
    const webbs = !!(r.webbsOrder ?? r['Webbs Order']);
    const price = suggestedProcessingPrice(String(proc), beef, webbs);
    return price > 0 ? `$${price.toFixed(2)}` : '—';
  }

  // Not a meat track → no processing price shown
  return '—';
}


type Row = Partial<Job> & { tag: string };
type Track = 'meat' | 'cape' | 'webbs';

const normProc = (s?: string) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
};

const suggestedProcessingPrice = (proc?: string, beef?: boolean, webbs?: boolean) => {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing','Skull-Cap','European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
};

const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
function specialtyPriceFromRow(j: Partial<Job>) {
  if (!j.specialtyProducts) return 0;
  const ss  = toInt(j.summerSausageLbs);
  const ssc = toInt(j.summerSausageCheeseLbs);
  const jer = toInt(j.slicedJerkyLbs);
  return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}
function fmt(n: number | string | undefined | null) {
  const num = typeof n === 'number' ? n : Number(String(n ?? '').replace(/[^0-9.\-]/g, ''));
  if (!isFinite(num)) return '—';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function readyTracks(j: Partial<Job>): Track[] {
  const st = String(j.status || '').toLowerCase();
  const cp = String(j.capingStatus || '').toLowerCase();
  const wb = String(j.webbsStatus || '').toLowerCase();
  const meatReady  = /finish|ready|complete|completed|done/.test(st) && st !== 'called';
  const capeReady  = /cape|caped|ready|complete|completed|done/.test(cp) && cp !== 'called';
  const webbsReady = /deliver|delivered|ready|complete|completed|done/.test(wb) && wb !== 'called';
  const out: Track[] = [];
  if (meatReady) out.push('meat');
  if (capeReady) out.push('cape');
  if (webbsReady) out.push('webbs');
  return out;
}

function trackLabel(t: Track){
  if (t === 'meat') return 'Meat Ready';
  if (t === 'cape') return 'Cape Ready';
  return 'Webbs Ready';
}

/* ---- new price normalization helpers ---- */
function firstNumberLike(...vals: any[]) {
  for (const v of vals) {
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// read/compute just the Processing Price number (no specialty)
function readProcessingPriceFromRow(j: any): number | null {
  const fromSheet = firstNumberLike(
    j.priceProcessing,
    j.processingPrice,
    j.PriceProcessing,
    j['Processing Price'],
    j.price_processing,
    j['processing price'],
    j['processing_price']
  );
  if (fromSheet != null) return fromSheet;

  // fallback: compute only the processing (NOT totals)
  const computed = suggestedProcessingPrice(j.processType, !!j.beefFat, !!j.webbsOrder);
  return Number.isFinite(computed) && computed > 0 ? computed : null;
}

/* ---------- page ---------- */
type FlatRow = Row & {
  __track: Track;
  callAttemptsMeat?: number;
  callAttemptsCape?: number;
  callAttemptsWebbs?: number;
};

export default function CallReportPage() {
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find(r => (r.tag + '|' + r.__track) === selectedKey),
    [rows, selectedKey]
  );

const attemptsFor = (r: FlatRow) => {
  const a = r as any; // some sheets only provide a generic "Call Attempts"
  if (r.__track === 'meat')  return Number(a.callAttemptsMeat  ?? a.callAttempts ?? 0);
  if (r.__track === 'cape')  return Number(a.callAttemptsCape  ?? a.callAttempts ?? 0);
  return Number(a.callAttemptsWebbs ?? a.callAttempts ?? 0);
};

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await searchJobs('@report'); // Finished / Caped / Delivered (not yet Called)
      // Normalize processing price into priceProcessing for UI
      const raw: Row[] = (res.rows || []).map((r: any) => {
        const price = readProcessingPriceFromRow(r);
        return { ...r, priceProcessing: price ?? undefined };
      });

      // Expand into one row per ready track
      const flat: FlatRow[] = [];
      for (const j of raw) {
        const tracks = readyTracks(j);
        for (const t of tracks) {
          flat.push({
            ...j,
            __track: t,
            callAttemptsMeat: Number((j as any).callAttemptsMeat ?? 0),
            callAttemptsCape: Number((j as any).callAttemptsCape ?? 0),
            callAttemptsWebbs: Number((j as any).callAttemptsWebbs ?? 0),
          });
        }
      }
      // stable sort by dropoff then tag
      flat.sort((a,b) => String(a.dropoff||'').localeCompare(String(b.dropoff||'')) || String(a.tag).localeCompare(String(b.tag)));
      setRows(flat);
      if (selectedKey && !flat.some(x => (x.tag + '|' + x.__track) === selectedKey)) {
        setSelectedKey(null);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load report');
      setRows([]);
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

// Replace the old paidText with this:
const paidText = (j: Row) => {
  const a = j as any; // tolerate sheet/row variants without widening Row everywhere

  // Common variants your data has used
  const paidProcessing = !!(a.paidProcessing ?? a['Paid Processing'] ?? a.paid);
  const paidSpecialty  = !!(a.paidSpecialty  ?? a['Paid Specialty']);
  const hasSpecialty   = !!(a.specialtyProducts ?? a['Specialty Products'] ?? a.specialty);

  // Some sheets also send a generic Paid flag
  const genericPaid = !!(a.Paid ?? a['Paid'] ?? a.paid);

  const resolved = genericPaid || (paidProcessing && (!hasSpecialty || paidSpecialty));
  return resolved ? 'Yes' : 'No';
};


  const setNote = (key: string, v: string) =>
    setNotes((p) => ({ ...p, [key]: v }));

  const refreshOne = async (tag: string) => {
    try {
      // fetch fresh job (includes attempts) then splice rows for that tag only
      const r = await getJob(tag);
      if (r?.exists && r.job) {
        const job = r.job as Row;
        // normalize price on single-row refresh as well
        const normPrice = readProcessingPriceFromRow(job);
        const jobWithPrice = { ...job, priceProcessing: normPrice ?? undefined } as Row & { priceProcessing?: number };


        setRows((prev) => {
          const others = prev.filter(x => x.tag !== tag);
          const tracks = readyTracks(jobWithPrice);
          const flat: FlatRow[] = tracks.map(t => ({
            ...jobWithPrice,
            __track: t,
            callAttemptsMeat: Number((jobWithPrice as any).callAttemptsMeat ?? 0),
            callAttemptsCape: Number((jobWithPrice as any).callAttemptsCape ?? 0),
            callAttemptsWebbs: Number((jobWithPrice as any).callAttemptsWebbs ?? 0),
          }));
          return [...others, ...flat].sort((a,b) => String(a.dropoff||'').localeCompare(String(b.dropoff||'')) || String(a.tag).localeCompare(String(b.tag)));
        });
      } else {
        setRows((prev) => prev.filter((x) => x.tag !== tag));
        if (selected && selected.tag === tag) setSelectedKey(null);
      }
    } catch {/* ignore */}
  };

  /* actions */
  const onMarkCalled = async () => {
    if (!selected) return;
    const tag = selected.tag!;
    const scope: 'meat'|'cape'|'webbs' = selected.__track;
    const key = tag + '|' + scope;
    const note = (notes[key] || '').trim();
    try {
      setSaving(true);
      await markCalled({ tag, scope, notes: note });
      if (note) {
        await logCallSimple({ tag, scope, reason: trackLabel(scope), notes: note });
      }
      await refreshOne(tag);
      setNote(key, '');
    } catch (e: any) {
      alert(e?.message || 'Failed to mark as called.');
    } finally {
      setSaving(false);
    }
  };

  const onPlusAttempt = async () => {
    if (!selected) return;
    const tag = selected.tag!;
    const scope: Track = selected.__track;
    const key = tag + '|' + scope;
    const note = (notes[key] || '').trim();

    // optimistic bump for the appropriate per-track field
    setRows((prev) =>
      prev.map((r) => {
        if (r.tag !== tag) return r;
        if (scope === 'meat')  return { ...r, callAttemptsMeat: Number(r.callAttemptsMeat || 0) + 1 };
        if (scope === 'cape')  return { ...r, callAttemptsCape: Number(r.callAttemptsCape || 0) + 1 };
        return { ...r, callAttemptsWebbs: Number(r.callAttemptsWebbs || 0) + 1 };
      })
    );

    try {
      setSaving(true);
      await logCallSimple({ tag, scope, reason: trackLabel(scope), notes: note });
      await refreshOne(tag);
      setNote(key, '');
    } catch (e: any) {
      // reload from source to revert
      await refreshOne(tag);
      alert(e?.message || 'Failed to add attempt.');
    } finally {
      setSaving(false);
    }
  };

  // Save Note without incrementing attempts (appends a line)
  const onSaveNote = async () => {
    if (!selected) return;
    const tag = selected.tag!;
    const scope: Track = selected.__track;
    const key = tag + '|' + scope;
    const note = (notes[key] || '').trim();
    if (!note) return;

    // Append line "note — mm/dd" to existing notes and save via saveJob
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const line = `${note} — ${mm}/${dd}`;
    const existing = selected.callNotes || '';
    const nextNotes = existing ? `${existing}\n${line}` : line;

    try {
      setSaving(true);
      await saveJob({ tag, callNotes: nextNotes });
      await refreshOne(tag);
      setNote(key, '');
    } catch (e: any) {
      alert(e?.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  function renderNotesCell(r: any) {
    const all = String((r as any).callNotes ?? '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
    const key = String((r as any).tag) + '|' + String((r as any).__track);
    const expanded = !!expandedNotes[key];
    const toShow = expanded ? all : all.slice(-3);
    const body = toShow.length ? toShow.join('\n') : '—';
    return (
      <div className="notes-cell">
        <pre className="notes-pre">{body}</pre>
        {all.length > 3 && (
          <button
            type="button"
            className="linkish"
            onClick={(e) => { e.stopPropagation(); setExpandedNotes(prev => ({ ...prev, [key]: !expanded })); }}
            title={expanded ? 'Hide notes' : 'Show all notes'}
          >
            {expanded ? 'Hide' : `Show all (${all.length})`}
          </button>
        )}
      </div>
    );
  }

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1>Call Report</h1>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <span className="muted">One row per ready track (Meat / Cape / Webbs)</span>
      </div>

      {err && (
        <div className="card" style={{ borderColor: '#ef4444', marginTop: 12 }}>
          Error: {err}
        </div>
      )}

      <div className="card" style={{ padding: 0, marginTop: 12, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table className="table call-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Tag</th>
                <th style={{ width: 140 }}>Name</th>
                <th style={{ width: 140 }}>Phone</th>
                <th style={{ width: 140 }}>Track</th>
                <th style={{ width: 100 }}>Attempts</th>
                <th style={{ width: 100 }}>Processing $</th>
                <th style={{ width: 60 }}>Paid</th>
                <th style={{ width: 240 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={8} style={{ padding: 14 }}>Nothing to call right now.</td>
                </tr>
              )}
              {rows.map((r) => {
                const key = r.tag + '|' + r.__track;
                const selected = selectedKey === key;

                return (
                  <tr
                    key={key}
                    className={selected ? 'selected' : ''}
                    onClick={() => setSelectedKey(key)}
                    title="Click to select"
                  >
                    <td>
                      <Link
                        href={`/intake?tag=${encodeURIComponent(r.tag!)}`}
                        onClick={(e)=>e.stopPropagation()}
                        title="Open form"
                      >
                        {r.tag}
                      </Link>
                    </td>
                    <td>{r.customer || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>
                      <span className={
                        'badge ' + (r.__track === 'meat' ? 'green' : r.__track === 'cape' ? 'blue' : 'purple')
                      }>
                        {trackLabel(r.__track)}
                      </span>
                    </td>
                    <td>{attemptsFor(r)}</td>
                    <td>{displayProcessingPrice(r)}</td>
                    <td>{paidText(r)}</td>
                    <td>{renderNotesCell(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky bottom toolbar for actions & adding notes (applies to selected row/track) */}
      <div className="toolbar">
        <div className="toolbar-inner">
          <div className="sel">
            {selected ? (
              <>
                <strong>Selected:</strong>{' '}
                <span className="pill">#{selected.tag}</span>{' '}
                <span className="pill small">{trackLabel(selected.__track)}</span>{' '}
                <span className="muted">{selected.customer || '—'}</span>{' '}
                <span className="muted">• Attempts: {attemptsFor(selected)}</span>
              </>
            ) : (
              <span className="muted">Select a row to take action</span>
            )}
          </div>
          <div className="toolbar-actions">
            <input
              className="toolbar-notes"
              placeholder="Add note for selected row…"
              value={selected ? (notes[(selected.tag + '|' + selected.__track)] || '') : ''}
              onChange={(e) => {
                if (!selected) return;
                setNote(selected.tag + '|' + selected.__track, e.target.value);
              }}
              disabled={!selected || saving}
            />
            <button className="btn secondary" disabled={!selected || saving || !(notes[selected ? (selected.tag + '|' + selected.__track) : ''] || '').trim()} onClick={onSaveNote}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <button className="btn secondary" disabled={!selected || saving} onClick={onPlusAttempt}>
              {saving ? 'Working…' : '+1 Attempt'}
            </button>
            <button className="btn" disabled={!selected || saving} onClick={onMarkCalled}>
              {saving ? 'Working…' : 'Mark Called'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-scroll { overflow-x: auto; overflow-y: hidden; }
        .call-table { width: 100%; min-width: 1000px; margin: 0; table-layout: fixed; }
        .call-table th, .call-table td { vertical-align: top; padding: 8px 10px; }

        tr.selected td {
          outline: 2px solid var(--brand-2, #89c096);
          outline-offset: -2px;
          background: rgba(137, 192, 150, 0.08);
        }

        .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12px; background:#1f2937; }
        .green { background: #065f46; }
        .blue { background: #1e3a8a; }
        .purple { background: #4c1d95; }

        .table tr:hover td {
          background: var(--bg-elev-2, rgba(255,255,255,0.03));
        }

        /* Sticky bottom toolbar */
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
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          background: #1f2937;
          font-weight: 800;
        }
        .pill.small { font-size: 12px; background: #374151; }
        .toolbar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .toolbar-notes {
          width: 360px;
          max-width: 45vw;
          background: #ffffff;
          color: #0b0f12;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 10px;
        }
        .btn { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #155acb; color: #fff; font-weight: 800; cursor: pointer; }
        .btn.secondary { background: transparent; color: #e5e7eb; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
      
        .notes-cell { display: flex; flex-direction: column; gap: 6px; }
        .notes-pre { margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 7.5em; overflow: hidden; font-size: 12px; line-height: 1.25; }
        .linkish { background: transparent; border: none; padding: 0; color: #93c5fd; cursor: pointer; font-size: 12px; text-align: left; }
        .linkish:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
