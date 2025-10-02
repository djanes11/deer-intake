'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Job } from '@/lib/api';
import { searchJobs, getJob, markCalled, logCallSimple, saveJob } from '@/lib/api';

/* ---------- helpers ---------- */
type Row = Partial<Job> & { tag: string };

function normProc(s?: string) {
  const v = String(s || '').toLowerCase();
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
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}
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

type Reason = 'Meat Ready' | 'Cape Ready' | 'Webbs Ready' | '-';
function reasonForRow(j: Partial<Job>): Reason {
  const st = String(j.status || '').toLowerCase();
  const cp = String(j.capingStatus || '').toLowerCase();
  const wb = String(j.webbsStatus || '').toLowerCase();
  if (st.includes('finished'))  return 'Meat Ready';
  if (cp.includes('caped'))     return 'Cape Ready';
  if (wb.includes('delivered')) return 'Webbs Ready';
  return '-';
}

// format historical “Call Notes” lines: "[YYYY-MM-DD ...] text" -> "text — mm/dd"
function formatNoteLine(line: string) {
  const m = line.match(/^\[(\d{4})-(\d{2})-(\d{2})[^\]]*]\s*(.*)$/);
  if (!m) return line.trim();
  const [, , mm, dd, text] = m;
  return `${text.trim()} — ${mm}/${dd}`;
}
function prettyCallNotes(raw?: string) {
  if (!raw) return '';
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(formatNoteLine)
    .join('\n');
}
const LAST_LINES = 2;

/* ---------- page ---------- */
export default function CallReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => rows.find(r => r.tag === selectedTag),
    [rows, selectedTag]
  );

  const toggleExpand = (tag: string) =>
    setExpanded(p => ({ ...p, [tag]: !p[tag] }));

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await searchJobs('@report'); // Finished / Caped / Delivered
      const next = (res.rows || []).map((r: any) => ({ ...r }));
      setRows(next);
      if (selectedTag && !next.some(x => x.tag === selectedTag)) {
        setSelectedTag(null);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load report');
      setRows([]);
      setSelectedTag(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const paidText = (j: Row) =>
    (j.Paid || j.paid || (j.paidProcessing && j.paidSpecialty)) ? 'Yes' : 'No';

  const displayPrice = (j: Row) => {
    const got = (j as any).price ?? (j as any).Price ?? undefined;
    if (got != null && String(got).trim() !== '') return fmt(got);
    const proc = suggestedProcessingPrice(j.processType, !!j.beefFat, !!j.webbsOrder);
    const spec = specialtyPriceFromRow(j);
    return fmt(proc + spec);
  };

  const setNote = (tag: string, v: string) =>
    setNotes((p) => ({ ...p, [tag]: v }));

  const refreshOne = async (tag: string) => {
    try {
      const r = await getJob(tag);
      if (r?.exists && r.job) {
        setRows((prev) => prev.map((x) => (x.tag === tag ? { ...x, ...r.job } : x)));
      } else {
        setRows((prev) => prev.filter((x) => x.tag !== tag));
        if (selectedTag === tag) setSelectedTag(null);
      }
    } catch {/* ignore */}
  };

  /* actions */
  const onMarkCalled = async () => {
    if (!selectedRow) return;
    const tag = selectedRow.tag!;
    const note = (notes[tag] || '').trim();
    try {
      setSaving(true);
      await markCalled({ tag, scope: 'auto', notes: note });
      if (note) {
        await logCallSimple({ tag, reason: reasonForRow(selectedRow), notes: note });
      }
      await refreshOne(tag);
      setNote(tag, '');
    } catch (e: any) {
      alert(e?.message || 'Failed to mark as called.');
    } finally {
      setSaving(false);
    }
  };

  const onPlusAttempt = async () => {
    if (!selectedRow) return;
    const tag = selectedRow.tag!;
    const note = (notes[tag] || '').trim();

    // optimistic bump
    setRows((prev) =>
      prev.map((r) => (r.tag === tag ? { ...r, callAttempts: (Number(r.callAttempts || 0) + 1) } : r))
    );

    try {
      setSaving(true);
      await logCallSimple({ tag, reason: reasonForRow(selectedRow), notes: note });
      await refreshOne(tag);
      setNote(tag, '');
    } catch (e: any) {
      // revert
      setRows((prev) =>
        prev.map((r) => (r.tag === tag ? { ...r, callAttempts: Number(r.callAttempts || 1) - 1 } : r))
      );
      alert(e?.message || 'Failed to add attempt.');
    } finally {
      setSaving(false);
    }
  };

  // NEW: Save Note without incrementing attempts (writes directly to Call Notes via saveJob)
  const onSaveNote = async () => {
    if (!selectedRow) return;
    const tag = selectedRow.tag!;
    const note = (notes[tag] || '').trim();
    if (!note) return;

    // Append "note — mm/dd" to existing notes and save
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const line = `${note} — ${mm}/${dd}`;
    const existing = selectedRow.callNotes || '';
    const nextNotes = existing ? `${existing}\n${line}` : line;

    try {
      setSaving(true);
      await saveJob({ tag, callNotes: nextNotes });
      await refreshOne(tag);
      setNote(tag, '');
    } catch (e: any) {
      alert(e?.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1>Call Report</h1>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <span className="muted">Finished / Caped / Delivered</span>
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
                <th style={{ width: 150 }}>Name</th>
                <th style={{ width: 150 }}>Phone</th>
                <th style={{ width: 100 }}>Reason</th>
                <th style={{ width: 100 }}>Price</th>
                <th style={{ width: 80 }}>Paid</th>
                <th style={{ width: 80 }}>Attempts</th>
                <th>Contact Notes</th>
              </tr>
            </thead>
            <tbody>
              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={8} style={{ padding: 14 }}>Nothing to call right now.</td>
                </tr>
              )}
              {rows.map((r) => {
                const reason = reasonForRow(r);
                const pretty = prettyCallNotes(r.callNotes);
                const lines = pretty ? pretty.split('\n') : [];
                const isLong = lines.length > LAST_LINES;
                const shown = isLong && !expanded[r.tag!]
                  ? lines.slice(-LAST_LINES).join('\n')
                  : pretty;

                const selected = selectedTag === r.tag;

                return (
                  <tr
                    key={r.tag}
                    className={selected ? 'selected' : ''}
                    onClick={() => setSelectedTag(r.tag!)}
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
                    <td>{reason}</td>
                    <td>{displayPrice(r)}</td>
                    <td>{paidText(r)}</td>
                    <td>{Number(r.callAttempts || 0)}</td>
                    <td className="notes-cell" onClick={(e)=>e.stopPropagation()}>
                      {shown ? (
                        <div className="notesHistory">
                          <pre>{shown}</pre>
                          {isLong && (
                            <button
                              type="button"
                              className="linkBtn"
                              onClick={() => toggleExpand(r.tag!)}
                            >
                              {expanded[r.tag!] ? 'Show less' : `Show all (${lines.length})`}
                            </button>
                          )}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky bottom toolbar for actions & adding notes */}
      <div className="toolbar">
        <div className="toolbar-inner">
          <div className="sel">
            {selectedRow ? (
              <>
                <strong>Selected:</strong>{' '}
                <span className="pill">#{selectedRow.tag}</span>{' '}
                <span className="muted">{selectedRow.customer || '—'}</span>{' '}
                <span className="muted">• {reasonForRow(selectedRow)}</span>{' '}
                <span className="muted">• Contacts: {Number(selectedRow.callAttempts || 0)}</span>
              </>
            ) : (
              <span className="muted">Select a row to take action</span>
            )}
          </div>
          <div className="toolbar-actions">
            <input
              className="toolbar-notes"
              placeholder="Add note for selected row…"
              value={selectedRow ? (notes[selectedRow.tag!] || '') : ''}
              onChange={(e) => {
                if (!selectedRow) return;
                setNote(selectedRow.tag!, e.target.value);
              }}
              disabled={!selectedRow || saving}
            />
            <button className="btn secondary" disabled={!selectedRow || saving || !(notes[selectedRow?.tag!] || '').trim()} onClick={onSaveNote}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <button className="btn secondary" disabled={!selectedRow || saving} onClick={onPlusAttempt}>
              {saving ? 'Working…' : '+1 Attempt'}
            </button>
            <button className="btn" disabled={!selectedRow || saving} onClick={onMarkCalled}>
              {saving ? 'Working…' : 'Mark Called'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-scroll { overflow-x: auto; overflow-y: hidden; }
        .call-table { width: 100%; min-width: 1080px; margin: 0; table-layout: fixed; }
        .call-table th, .call-table td { vertical-align: top; padding: 8px 10px; }

        tr.selected td {
          outline: 2px solid var(--brand-2, #89c096);
          outline-offset: -2px;
          background: rgba(137, 192, 150, 0.08);
        }

        .notesHistory {
          max-height: 88px;
          overflow: auto;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border, #23292d);
          border-radius: 8px;
          padding: 6px 8px;
        }
        .notesHistory pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          line-height: 1.35;
        }
        .linkBtn {
          margin-top: 6px;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
          color: var(--brand-2, #89c096);
          font-weight: 700;
        }
        .linkBtn:hover { text-decoration: underline; }

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
        .toolbar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: nowrap;
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
      `}</style>
    </main>
  );
}

