'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Job } from '@/lib/api';
import { searchJobs, getJob, markCalled, logCallSimple, saveJob } from '@/lib/api';
import { formatDisplayDateTime } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic';

type Track = 'meat' | 'cape' | 'webbs';
type Row = Partial<Job> & { tag: string };
type FlatRow = Row & {
  __track: Track;
  callAttemptsMeat?: number;
  callAttemptsCape?: number;
  callAttemptsWebbs?: number;
};

/* ---------- helpers ---------- */
function trackLabel(t: Track) {
  if (t === 'meat') return 'Meat Ready';
  if (t === 'cape') return 'Cape Ready';
  return 'Webbs Ready';
}

function readyTracks(j: Partial<Job>): Track[] {
  const st = String((j as any).status || '').toLowerCase();
  const cp = String((j as any).capingStatus || '').toLowerCase();
  const wb = String((j as any).webbsStatus || '').toLowerCase();

  const meatReady = /finish|ready|complete|completed|done/.test(st) && st !== 'called';
  const capeReady = /ready|complete|completed|done|caped/.test(cp) && cp !== 'called';
  const webbsReady = /ready|complete|completed|done|delivered/.test(wb) && wb !== 'called';

  const out: Track[] = [];
  if (meatReady) out.push('meat');
  if (capeReady) out.push('cape');
  if (webbsReady) out.push('webbs');
  return out;
}

function attemptsFor(r: FlatRow) {
  const a = r as any;
  if (r.__track === 'meat') return Number(a.callAttemptsMeat ?? a.meatAttempts ?? a.callAttempts ?? 0);
  if (r.__track === 'cape') return Number(a.callAttemptsCape ?? a.capeAttempts ?? a.callAttempts ?? 0);
  return Number(a.callAttemptsWebbs ?? a.webbsAttempts ?? a.callAttempts ?? 0);
}

function prefersCall(j: Partial<Job>) {
  const a = j as any;
  const wantsCall = !!(a.prefCall ?? a['Preferred Phone Call'] ?? a['Pref Call']);
  const phone = String(a.phone ?? a.Phone ?? '').replace(/\D/g, '');
  return wantsCall && phone.length === 10;
}

// show only processing price for meat track
function displayProcessingPrice(r: any): string {
  if (r.__track !== 'meat') return '—';

  const n = Number(
    r.priceProcessing ??
    r.processingPrice ??
    r['Processing Price'] ??
    0
  );
  if (Number.isFinite(n) && n > 0) return `$${n.toFixed(2)}`;
  return '—';
}

const paidText = (j: Row) => {
  const a = j as any;
  const paidProcessing = !!(a.paidProcessing ?? a['Paid Processing']);
  const paidSpecialty = !!(a.paidSpecialty ?? a['Paid Specialty']);
  const hasSpecialty = !!(a.specialtyProducts ?? a['Specialty Products'] ?? a.specialty);
  const resolved = paidProcessing && (!hasSpecialty || paidSpecialty);
  return resolved ? 'Yes' : 'No';
};

function readProcessingPriceFromRow(j: any): number | undefined {
  const vals = [
    j.priceProcessing,
    j.processingPrice,
    j.PriceProcessing,
    j['Processing Price'],
    j.price_processing,
  ];
  for (const v of vals) {
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function readSpecialtyPriceFromRow(j: any): number {
  const vals = [
    j.priceSpecialty,
    j.specialtyPrice,
    j['Specialty Price'],
    j.price_specialty,
  ];
  for (const v of vals) {
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function paymentSummary(j: Row) {
  const a = j as any;
  const paidProcessing = !!(a.paidProcessing ?? a['Paid Processing']);
  const paidSpecialty = !!(a.paidSpecialty ?? a['Paid Specialty']);
  const processing = readProcessingPriceFromRow(a) ?? 0;
  const specialty = readSpecialtyPriceFromRow(a);
  const totalDue = (paidProcessing ? 0 : processing) + (paidSpecialty ? 0 : specialty);
  return { paidProcessing, paidSpecialty, processing, specialty, totalDue };
}

export default function CallReportPage() {
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [webbsEnabled, setWebbsEnabled] = useState(true);

  const selected = useMemo(
    () => rows.find(r => (r.tag + '|' + r.__track) === selectedKey),
    [rows, selectedKey]
  );

  const summary = useMemo(() => {
    const meatRows = rows.filter((row) => row.__track === 'meat');
    const unpaidMeatRows = meatRows.filter((row) => paymentSummary(row).totalDue > 0);
    return {
      readyToCall: rows.length,
      unpaidReady: unpaidMeatRows.length,
      unpaidTotal: unpaidMeatRows.reduce((sum, row) => sum + paymentSummary(row).totalDue, 0),
      noAttemptsYet: rows.filter((row) => attemptsFor(row) === 0).length,
    };
  }, [rows]);

  const setNote = (key: string, v: string) => setNotes(p => ({ ...p, [key]: v }));

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // requires backend support: '@report' from Supabase
      const res = await searchJobs('@report');

      const raw: Row[] = (res.rows || []).map((r: any) => {
        const p = readProcessingPriceFromRow(r);
        return { ...r, priceProcessing: p ?? r.priceProcessing };
      }).filter(prefersCall);

      const flat: FlatRow[] = [];
      for (const j of raw) {
        for (const t of readyTracks(j)) {
          if (!webbsEnabled && t === 'webbs') continue;
          flat.push({
            ...j,
            __track: t,
            callAttemptsMeat: Number((j as any).callAttemptsMeat ?? (j as any).meatAttempts ?? 0),
            callAttemptsCape: Number((j as any).callAttemptsCape ?? (j as any).capeAttempts ?? 0),
            callAttemptsWebbs: Number((j as any).callAttemptsWebbs ?? (j as any).webbsAttempts ?? 0),
          });
        }
      }

      flat.sort(
        (a, b) =>
          String((a as any).dropoff || '').localeCompare(String((b as any).dropoff || '')) ||
          String(a.tag).localeCompare(String(b.tag))
      );

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

  useEffect(() => { load(); }, [webbsEnabled]);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setWebbsEnabled(json?.settings?.features?.webbsEnabled !== false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/admin/staff-context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setStaffRole((json?.processor?.role as 'admin' | 'staff' | 'readonly' | null) || null);
      })
      .catch(() => {});
  }, []);

  const canUpdate = staffRole === 'admin' || staffRole === 'staff';

  const refreshOne = async (tag: string) => {
    try {
      const r = await getJob(tag);
      if (r?.exists && r.job) {
        const job = r.job as Row;
        const p = readProcessingPriceFromRow(job);
        const jobWithPrice = { ...job, priceProcessing: p ?? (job as any).priceProcessing } as any;

        if (!prefersCall(jobWithPrice)) {
          setRows(prev => prev.filter(x => x.tag !== tag));
          if (selected && selected.tag === tag) setSelectedKey(null);
          return;
        }

        setRows(prev => {
          const others = prev.filter(x => x.tag !== tag);
          const flat: FlatRow[] = readyTracks(jobWithPrice).map(t => ({
            ...jobWithPrice,
            __track: t,
            callAttemptsMeat: Number((jobWithPrice as any).callAttemptsMeat ?? (jobWithPrice as any).meatAttempts ?? 0),
            callAttemptsCape: Number((jobWithPrice as any).callAttemptsCape ?? (jobWithPrice as any).capeAttempts ?? 0),
            callAttemptsWebbs: Number((jobWithPrice as any).callAttemptsWebbs ?? (jobWithPrice as any).webbsAttempts ?? 0),
          }));
          return [...others, ...flat].sort(
            (a, b) =>
              String((a as any).dropoff || '').localeCompare(String((b as any).dropoff || '')) ||
              String(a.tag).localeCompare(String(b.tag))
          );
        });
      } else {
        setRows(prev => prev.filter(x => x.tag !== tag));
        if (selected && selected.tag === tag) setSelectedKey(null);
      }
    } catch {
      // ignore
    }
  };

  const onMarkCalled = async () => {
    if (!selected) return;
    const tag = selected.tag!;
    const scope: Track = selected.__track;
    const key = tag + '|' + scope;
    const note = (notes[key] || '').trim();

    try {
      setSaving(true);
      await markCalled({ tag, scope, notes: note });
      setRows(prev => prev.filter(r => !(r.tag === tag && r.__track === scope)));
      if (selectedKey === key) {
        setSelectedKey(null);
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

    // optimistic bump
    setRows(prev =>
      prev.map(r => {
        if (r.tag !== tag) return r;
        if (scope === 'meat') return { ...r, callAttemptsMeat: Number(r.callAttemptsMeat || 0) + 1 };
        if (scope === 'cape') return { ...r, callAttemptsCape: Number(r.callAttemptsCape || 0) + 1 };
        return { ...r, callAttemptsWebbs: Number(r.callAttemptsWebbs || 0) + 1 };
      })
    );

    try {
      setSaving(true);
      await logCallSimple({ tag, scope, reason: trackLabel(scope), notes: note });
      await refreshOne(tag);
      setNote(key, '');
    } catch (e: any) {
      await refreshOne(tag);
      alert(e?.message || 'Failed to add attempt.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveNote = async () => {
    if (!selected) return;
    const tag = selected.tag!;
    const scope: Track = selected.__track;
    const key = tag + '|' + scope;
    const note = (notes[key] || '').trim();
    if (!note) return;

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const line = `${note} — ${mm}/${dd}`;

    const existing = String((selected as any).callNotes || '');
    const nextNotes = existing ? `${existing}\n${line}` : line;

    try {
      setSaving(true);
      await saveJob({ tag, callNotes: nextNotes } as any);
      await refreshOne(tag);
      setNote(key, '');
    } catch (e: any) {
      alert(e?.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  function renderNotesCell(r: any) {
    const all = String(r.callNotes ?? '')
      .split(/\r?\n/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    const key = String(r.tag) + '|' + String(r.__track);
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
          >
            {expanded ? 'Hide' : `Show all (${all.length})`}
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px' }}>
            <div className="app-kicker">
              Customer Contact
            </div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 34px)' }}>Call Report</h1>
            <div className="app-copy">
              Use this page when an order is ready for customer contact. Track call attempts, leave simple notes, and move each item into the pickup queue once the customer has been reached.
            </div>
          </div>
          <button className="btn small" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="metric-card">
          <div className="metric-label">Ready To Call</div>
          <div className="metric-value">{summary.readyToCall}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ready & Unpaid</div>
          <div className="metric-value">{summary.unpaidReady}</div>
          <div className="metric-sub">{money(summary.unpaidTotal)} still open</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">No Attempts Yet</div>
          <div className="metric-value">{summary.noAttemptsYet}</div>
        </div>
      </section>

      {!canUpdate && (
        <div className="card readonly-banner">
          Read-only access: you can review who is ready to call and open intake details, but only Staff or Admin can add attempts, save call notes, or mark items called.
        </div>
      )}

      {err && (
        <div className="card" style={{ borderColor: '#ef4444', fontWeight: 800 }}>
          Error: {err}
        </div>
      )}

      {selected ? (
        <section className="selected-card">
          <div className="selected-top">
            <div>
              <div className="selected-eyebrow">Selected Call</div>
              <div className="selected-title">
                {(selected as any).customer || 'Unknown customer'}
                <span className="selected-tag">Tag {selected.tag}</span>
              </div>
              <div className="selected-meta">
                <span>Confirmation {(selected as any).confirmation || '-'}</span>
                <span>{(selected as any).phone || 'No phone'}</span>
                <span>{(selected as any).lastCallAt ? `Last contact ${formatDisplayDateTime((selected as any).lastCallAt)}` : 'No contact logged yet'}</span>
              </div>
            </div>
            <span className={'badge ' + (selected.__track === 'meat' ? 'green' : selected.__track === 'cape' ? 'blue' : 'purple')}>
              {trackLabel(selected.__track)}
            </span>
          </div>

          <div className="selected-grid">
            <div className="fact">
              <div className="fact-label">Attempts</div>
              <div className="fact-value">{attemptsFor(selected)}</div>
              <div className="fact-sub">Each time you call, add one attempt so everyone can see the history.</div>
            </div>
            <div className="fact">
              <div className="fact-label">Balance</div>
              <div className="fact-value">{selected.__track === 'meat' ? money(paymentSummary(selected).totalDue) : 'Included'}</div>
              <div className="fact-sub">
                {selected.__track === 'meat'
                  ? `Processing ${money(paymentSummary(selected).paidProcessing ? 0 : paymentSummary(selected).processing)} | Specialty ${money(paymentSummary(selected).paidSpecialty ? 0 : paymentSummary(selected).specialty)}`
                  : 'This track does not create a separate balance.'}
              </div>
            </div>
            <div className="fact">
              <div className="fact-label">Payment Status</div>
              <div className="fact-value">{selected.__track === 'meat' ? (paymentSummary(selected).totalDue > 0 ? 'Needs collection' : 'Paid') : 'Not required'}</div>
              <div className="fact-sub">
                {selected.__track === 'meat'
                  ? (paymentSummary(selected).totalDue > 0 ? 'Helpful to mention during the call.' : 'No payment follow-up needed before pickup.')
                  : 'Use the call to confirm pickup timing and handoff details.'}
              </div>
            </div>
            <div className="fact">
              <div className="fact-label">Ready Track</div>
              <div className="fact-value">{trackLabel(selected.__track)}</div>
              <div className="fact-sub">Marking called moves only this track into the pickup queue.</div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table className="table call-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Tag</th>
                <th style={{ width: 180 }}>Customer</th>
                <th style={{ width: 140 }}>Track</th>
                <th style={{ width: 100 }}>Attempts</th>
                <th style={{ width: 120 }}>Balance</th>
                <th style={{ width: 120 }}>Last Contact</th>
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
                const isSel = selectedKey === key;

                return (
                  <tr
                    key={key}
                    className={isSel ? 'selected' : ''}
                    onClick={() => setSelectedKey(key)}
                    title="Click to select"
                  >
                    <td>
                      <Link
                        href={canUpdate ? `/intake?tag=${encodeURIComponent(r.tag!)}` : `/intake/${encodeURIComponent(r.tag!)}`}
                        onClick={(e) => e.stopPropagation()}
                        title={canUpdate ? 'Open form' : 'Open read-only details'}
                      >
                        {r.tag}
                      </Link>
                    </td>
                    <td>
                      <div className="customer-name">{(r as any).customer || '-'}</div>
                      <div className="customer-sub">
                        {(r as any).phone || 'No phone'}
                        {(r as any).confirmation ? ` | ${(r as any).confirmation}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className={'badge ' + (r.__track === 'meat' ? 'green' : r.__track === 'cape' ? 'blue' : 'purple')}>
                        {trackLabel(r.__track)}
                      </span>
                    </td>
                    <td>{attemptsFor(r)}</td>
                    <td>
                      {r.__track === 'meat' ? (
                        <div>
                          <div className="balance-main">{money(paymentSummary(r).totalDue)}</div>
                          <div className="balance-sub">Proc {money(paymentSummary(r).paidProcessing ? 0 : paymentSummary(r).processing)}</div>
                        </div>
                      ) : (
                        <span className="muted">Included</span>
                      )}
                    </td>
                    <td>{(r as any).lastCallAt ? formatDisplayDateTime((r as any).lastCallAt) : '—'}</td>
                    <td>{r.__track === 'meat' ? (paymentSummary(r).totalDue > 0 ? 'No' : 'Yes') : '—'}</td>
                    <td>{renderNotesCell(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-inner">
          <div className="sel">
            {selected ? (
              <>
                <strong>Selected:</strong>{' '}
                <span className="pill">#{selected.tag}</span>{' '}
                <span className="pill small">{trackLabel(selected.__track)}</span>{' '}
                <span className="muted">{(selected as any).customer || '—'}</span>{' '}
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
              disabled={!canUpdate || !selected || saving}
              title={!canUpdate ? 'Only Staff or Admin can add call notes.' : undefined}
            />
            <button className="btn secondary" disabled={!canUpdate || !selected || saving || !(notes[selected ? (selected.tag + '|' + selected.__track) : ''] || '').trim()} title={!canUpdate ? 'Only Staff or Admin can save call notes.' : undefined} onClick={onSaveNote}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <button className="btn secondary" disabled={!canUpdate || !selected || saving} title={!canUpdate ? 'Only Staff or Admin can add a call attempt.' : undefined} onClick={onPlusAttempt}>
              {saving ? 'Working…' : '+1 Attempt'}
            </button>
            <button className="btn" disabled={!canUpdate || !selected || saving} title={!canUpdate ? 'Only Staff or Admin can mark an item called.' : undefined} onClick={onMarkCalled}>
              {saving ? 'Working…' : 'Mark Called'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .metric-card {
          border: 1px solid rgba(154, 116, 60, 0.18);
          border-radius: 16px;
          padding: 16px;
          background: rgba(14, 13, 12, 0.88);
          color: #f8fafc;
        }
        .metric-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .metric-value {
          font-size: 28px;
          font-weight: 950;
          margin-top: 8px;
        }
        .metric-sub {
          margin-top: 4px;
          color: #b7a98d;
          font-size: 13px;
          font-weight: 700;
        }
        .readonly-banner {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #3730a3;
          font-weight: 700;
        }
        .selected-card {
          border: 1px solid #304336;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(14, 17, 15, 0.96) 0%, rgba(10, 12, 11, 0.98) 100%);
          color: #f8fafc;
          padding: 18px;
          display: grid;
          gap: 16px;
        }
        .selected-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .selected-eyebrow {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .selected-title {
          margin-top: 6px;
          font-size: 28px;
          font-weight: 950;
          line-height: 1.05;
        }
        .selected-tag {
          margin-left: 10px;
          font-size: 14px;
          color: #cbd5e1;
          font-weight: 800;
        }
        .selected-meta {
          margin-top: 8px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: rgba(248, 250, 252, 0.8);
          font-size: 14px;
        }
        .selected-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .fact {
          border: 1px solid rgba(154, 116, 60, 0.16);
          border-radius: 14px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
        }
        .fact-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .fact-value {
          margin-top: 8px;
          font-size: 22px;
          font-weight: 900;
        }
        .fact-sub {
          margin-top: 6px;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.4;
        }
        .table-scroll { overflow-x: auto; overflow-y: hidden; }
        .call-table { width: 100%; min-width: 1000px; margin: 0; table-layout: fixed; }
        .call-table th, .call-table td { vertical-align: top; padding: 8px 10px; }
        tr.selected td { outline: 2px solid var(--brand-2, #89c096); outline-offset: -2px; background: rgba(137, 192, 150, 0.08); }
        .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12px; background:#1f2937; }
        .green { background: #235532; }
        .blue { background: #406c4d; }
        .purple { background: #5f7f57; }
        .table tr:hover td { background: var(--bg-elev-2, rgba(255,255,255,0.03)); }
        .toolbar { position: sticky; bottom: 0; z-index: 15; margin-top: 12px; background: var(--bg, #0b0f12); border-top: 1px solid var(--border, #1f2937); box-shadow: 0 -8px 30px rgba(0,0,0,.25); }
        .toolbari { max-width: 1100px; margin: 0 auto; }
        .toolbar-inner { max-width: 1100px; margin: 0 auto; padding: 10px 12px; display: flex; gap: 12px; align-items: center; justify-content: space-between; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #1f2937; font-weight: 800; }
        .pill.small { font-size: 12px; background: #374151; }
        .toolbar-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .toolbar-notes { width: 360px; max-width: 45vw; background: #ffffff; color: #0b0f12; border: 1px solid #cbd5e1; border-radius: 10px; padding: 6px 10px; }
        .btn { padding: 8px 12px; border: 1px solid #235532; border-radius: 8px; background: #2f6f3f; color: #fff; font-weight: 800; cursor: pointer; }
        .btn.secondary { background: transparent; color: #e5e7eb; border-color: #304336; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .notes-cell { display: flex; flex-direction: column; gap: 6px; }
        .notes-pre { margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 7.5em; overflow: hidden; font-size: 12px; line-height: 1.25; }
        .linkish { background: transparent; border: none; padding: 0; color: #9ed2aa; cursor: pointer; font-size: 12px; text-align: left; }
        .linkish:hover { text-decoration: underline; }
        .muted { color: #9ca3af; }
        .customer-name, .balance-main { font-weight: 850; }
        .customer-sub, .balance-sub { color: #9ca3af; font-size: 13px; }
      `}</style>
    </main>
  );
}
