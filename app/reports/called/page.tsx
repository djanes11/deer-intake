'use client';

import { useEffect, useMemo, useState } from 'react';
import { searchJobs, saveJob } from '@/lib/api';
import { specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';
import { formatDisplayDateTime } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic';

type Track = 'meat' | 'cape' | 'webbs';

type Row = {
  tag: string;
  confirmation: string;
  customer: string;
  phone: string;
  track: Track;
  calledAt?: string;
  readyAt?: string;
  priceProc: number;
  priceSpec: number;
  totalDue: number;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
  pickedUp?: boolean;
  pickedUpAt?: string;
  pickedUpBy?: string;
  pickupNotes?: string;
};

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

function specialtyPrice(row: any) {
  if (!row?.specialtyProducts) return 0;
  return calcSpecialtyPrice(row);
}

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isCalled(value?: string) {
  return String(value || '').trim().toLowerCase() === 'called';
}

function ageSince(value?: string) {
  if (!value) return '-';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '-';
  const ms = Date.now() - when.getTime();
  if (ms < 0) return '-';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

async function fetchCalled(): Promise<Row[]> {
  const res = await searchJobs('@recall');
  const rows = (Array.isArray(res?.rows) ? res.rows : []) as any[];
  const out: Row[] = [];

  for (const r of rows) {
    const tag = String(r?.tag ?? r?.Tag ?? '').trim();
    if (!tag) continue;

    const customer = String(r?.customer ?? r?.Customer ?? r?.['Customer Name'] ?? '').trim();
    const phone = String(r?.phone ?? r?.Phone ?? '').trim();
    const confirmation = String(r?.confirmation ?? r?.Confirmation ?? '').trim();

    const status = String(r?.status ?? r?.Status ?? '').trim();
    const capingStatus = String(r?.capingStatus ?? r?.['Caping Status'] ?? '').trim();
    const webbsStatus = String(r?.webbsStatus ?? r?.['Webbs Status'] ?? '').trim();

    const calledAt =
      String(r?.lastCallAt ?? r?.lastCalledAt ?? r?.['Last Call At'] ?? r?.calledAt ?? '').trim() || undefined;

    const savedProc = Number(
      r?.priceProcessing ??
      r?.price_processing ??
      r?.processingPrice ??
      r?.['Processing Price'] ??
      0
    ) || 0;
    const savedSpec = Number(
      r?.priceSpecialty ??
      r?.price_specialty ??
      r?.specialtyPrice ??
      r?.['Specialty Price'] ??
      0
    ) || 0;

    const priceProc = savedProc || suggestedProcessingPrice(
      r?.processType ?? r?.['Process Type'],
      !!(r?.beefFat ?? r?.['Beef Fat']),
      !!(r?.webbsOrder ?? r?.['Webbs Order'])
    );
    const priceSpec = savedSpec || specialtyPrice(r);

    const paidProcessing = !!(r?.paidProcessing ?? r?.paid_processing ?? r?.['Paid Processing']);
    const paidSpecialty = !!(r?.paidSpecialty ?? r?.paid_specialty ?? r?.['Paid Specialty']);
    const pickedUpProcessing = !!(r?.pickedUpProcessing ?? r?.picked_up_processing ?? r?.['Picked Up - Processing']);
    const pickedUpCape = !!(r?.pickedUpCape ?? r?.picked_up_cape ?? r?.['Picked Up - Cape']);
    const pickedUpWebbs = !!(r?.pickedUpWebbs ?? r?.picked_up_webbs ?? r?.['Picked Up - Webbs']);

    const pickedUpProcessingAt = String(r?.pickedUpProcessingAt ?? r?.picked_up_processing_at ?? '').trim() || undefined;
    const pickedUpCapeAt = String(r?.pickedUpCapeAt ?? r?.picked_up_cape_at ?? '').trim() || undefined;
    const pickedUpWebbsAt = String(r?.pickedUpWebbsAt ?? r?.picked_up_webbs_at ?? '').trim() || undefined;
    const pickedUpBy = String(r?.pickedUpBy ?? r?.picked_up_by ?? '').trim() || undefined;
    const pickupNotes = String(r?.pickupNotes ?? r?.pickup_notes ?? '').trim() || undefined;

    const processingFinishedAt = String(r?.processingFinishedAt ?? r?.processing_finished_at ?? '').trim() || undefined;

    if (isCalled(status)) {
      out.push({
        tag,
        confirmation,
        customer,
        phone,
        track: 'meat',
        calledAt,
        readyAt: processingFinishedAt || calledAt,
        priceProc,
        priceSpec,
        totalDue: (paidProcessing ? 0 : priceProc) + (paidSpecialty ? 0 : priceSpec),
        paidProcessing,
        paidSpecialty,
        pickedUp: pickedUpProcessing,
        pickedUpAt: pickedUpProcessingAt,
        pickedUpBy,
        pickupNotes,
      });
    }
    if (isCalled(capingStatus)) {
      out.push({
        tag,
        confirmation,
        customer,
        phone,
        track: 'cape',
        calledAt,
        readyAt: calledAt,
        priceProc,
        priceSpec,
        totalDue: 0,
        paidProcessing,
        paidSpecialty,
        pickedUp: pickedUpCape,
        pickedUpAt: pickedUpCapeAt,
        pickedUpBy,
        pickupNotes,
      });
    }
    if (isCalled(webbsStatus)) {
      out.push({
        tag,
        confirmation,
        customer,
        phone,
        track: 'webbs',
        calledAt,
        readyAt: calledAt,
        priceProc,
        priceSpec,
        totalDue: 0,
        paidProcessing,
        paidSpecialty,
        pickedUp: pickedUpWebbs,
        pickedUpAt: pickedUpWebbsAt,
        pickedUpBy,
        pickupNotes,
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

async function markPaid(tag: string, kind: 'processing' | 'specialty') {
  return saveJob(kind === 'specialty' ? ({ tag, paidSpecialty: true } as any) : ({ tag, paidProcessing: true } as any));
}

async function markPickedUp(tag: string, track: Track, pickedUpBy?: string, pickupNotes?: string) {
  const now = new Date().toISOString();
  const shared = {
    pickedUpBy: String(pickedUpBy || '').trim() || null,
    pickupNotes: String(pickupNotes || '').trim() || null,
  };

  if (track === 'meat') {
    return saveJob({ tag, status: 'Picked Up', pickedUpProcessing: true, pickedUpProcessingAt: now, ...shared } as any);
  }
  if (track === 'cape') {
    return saveJob({ tag, capingStatus: 'Picked Up', pickedUpCape: true, pickedUpCapeAt: now, ...shared } as any);
  }
  return saveJob({ tag, webbsStatus: 'Picked Up', pickedUpWebbs: true, pickedUpWebbsAt: now, ...shared } as any);
}

function TrackBadge({ track }: { track: Track | string }) {
  const t = String(track || '').toLowerCase();
  const label = t === 'webbs' ? 'Webbs' : t === 'cape' ? 'Cape' : 'Meat';
  const styles: React.CSSProperties =
    t === 'webbs'
      ? { background: '#5f7f57', color: '#fff' }
      : t === 'cape'
      ? { background: '#406c4d', color: '#fff' }
      : { background: '#235532', color: '#fff' };

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

function PaymentBadge({ row }: { row: Row }) {
  if (row.track !== 'meat') {
    return <span className="badge neutral">Included</span>;
  }
  if (row.totalDue > 0) {
    return <span className="badge warn">{money(row.totalDue)} due</span>;
  }
  return <span className="badge ok">Paid</span>;
}

export default function CalledPickupQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<'all' | Track>('all');
  const [showPickedUp, setShowPickedUp] = useState(false);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [pickedUpByInput, setPickedUpByInput] = useState('');
  const [pickupNotesInput, setPickupNotesInput] = useState('');

  const summary = useMemo(() => {
    const openRows = rows.filter((row) => !row.pickedUp);
    const readyUnpaid = openRows.filter((row) => row.track === 'meat' && row.totalDue > 0);
    const pickedUpRows = rows.filter((row) => row.pickedUp);
    return {
      openCount: openRows.length,
      readyUnpaidCount: readyUnpaid.length,
      readyUnpaidTotal: readyUnpaid.reduce((sum, row) => sum + row.totalDue, 0),
      pickedUpTodayCount: pickedUpRows.filter((row) => {
        if (!row.pickedUpAt) return false;
        return row.pickedUpAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      }).length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showPickedUp && row.pickedUp) return false;
      if (trackFilter !== 'all' && row.track !== trackFilter) return false;
      if (showUnpaidOnly && !(row.track === 'meat' && row.totalDue > 0)) return false;
      if (!q) return true;
      return [row.tag, row.customer, row.confirmation, row.phone, row.track].some((value) =>
        String(value || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, trackFilter, showPickedUp, showUnpaidOnly]);

  const selected = useMemo(
    () => filteredRows.find((r) => `${r.tag}|${r.track}` === selectedKey) || rows.find((r) => `${r.tag}|${r.track}` === selectedKey),
    [filteredRows, rows, selectedKey]
  );

  useEffect(() => {
    setPickedUpByInput(selected?.pickedUpBy || '');
    setPickupNotesInput(selected?.pickupNotes || '');
  }, [selected?.tag, selected?.track, selected?.pickedUpBy, selected?.pickupNotes]);

  async function load() {
    setLoading(true);
    setErr(undefined);
    try {
      const list = await fetchCalled();
      const filtered = webbsEnabled ? list : list.filter((row) => row.track !== 'webbs');
      setRows(filtered);
      if (selectedKey && !filtered.some((r) => `${r.tag}|${r.track}` === selectedKey)) {
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
  const gridCols = '0.8fr 1.5fr 0.8fr 0.9fr 1fr 0.9fr 0.8fr 0.8fr';

  function openIntake(tag: string) {
    const url = canUpdate ? `/intake?tag=${encodeURIComponent(tag)}` : `/intake/${encodeURIComponent(tag)}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px' }}>
            <div className="app-kicker">
              Pickup Workflow
            </div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 34px)' }}>Called Pickup Queue</h1>
            <div className="app-copy">
              Use this page when a customer is coming to pick up. See what is owed, record who picked it up, and finish the handoff without guessing.
            </div>
          </div>
          <button onClick={load} className="btn small">{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="metric-card">
          <div className="metric-label">Open Pickup Items</div>
          <div className="metric-value">{summary.openCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ready & Unpaid</div>
          <div className="metric-value">{summary.readyUnpaidCount}</div>
          <div className="metric-sub">{money(summary.readyUnpaidTotal)} still open</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Picked Up Today</div>
          <div className="metric-value">{summary.pickedUpTodayCount}</div>
        </div>
      </section>

      <section
        className="pickup-filters"
        style={{
          border: '1px solid rgba(154, 116, 60, 0.18)',
          borderRadius: 16,
          padding: 16,
          background: 'rgba(14, 13, 12, 0.88)',
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'minmax(260px, 1.2fr) minmax(160px, .6fr) auto auto auto',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="metric-label">Find a customer</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tag, customer name, confirmation #, or phone"
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="metric-label">Track</span>
          <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value as 'all' | Track)}>
            <option value="all">All Tracks</option>
            <option value="meat">Meat</option>
            <option value="cape">Cape</option>
            {webbsEnabled ? <option value="webbs">Webbs</option> : null}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42 }}>
          <input type="checkbox" checked={showUnpaidOnly} onChange={(e) => setShowUnpaidOnly(e.target.checked)} />
          <span>Only show unpaid</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 42 }}>
          <input type="checkbox" checked={showPickedUp} onChange={(e) => setShowPickedUp(e.target.checked)} />
          <span>Include picked up</span>
        </label>

        <div style={{ color: '#b7a98d', fontWeight: 800, textAlign: 'right' }}>{filteredRows.length} shown</div>
      </section>

      {err && <div className="err">{err}</div>}
      {!canUpdate && (
        <div className="card readonly-banner">
          Read-only access: you can review this queue and open printable intake details, but only Staff or Admin can mark processing paid or complete pickup actions.
        </div>
      )}

      {selected ? (
        <section className="selected-card">
          <div className="selected-top">
            <div>
              <div className="selected-eyebrow">Selected Pickup</div>
              <div className="selected-title">
                {selected.customer || 'Unknown customer'}
                <span className="selected-tag">Tag {selected.tag}</span>
              </div>
              <div className="selected-meta">
                <span>Confirmation {selected.confirmation || '-'}</span>
                <span>{selected.phone || 'No phone'}</span>
                <span>{selected.calledAt ? `Called ${formatDisplayDateTime(selected.calledAt)}` : 'Not stamped yet'}</span>
              </div>
            </div>
            <TrackBadge track={selected.track} />
          </div>

          <div className="selected-grid">
            <div className="fact">
              <div className="fact-label">Balance</div>
              <div className="fact-value">{selected.track === 'meat' ? money(selected.totalDue) : 'Included'}</div>
              <div className="fact-sub">
                {selected.track === 'meat'
                  ? `Processing ${money(selected.paidProcessing ? 0 : selected.priceProc)} | Specialty ${money(selected.paidSpecialty ? 0 : selected.priceSpec)}`
                  : 'No pickup balance on this track'}
              </div>
            </div>
            <div className="fact">
              <div className="fact-label">Payment</div>
              <div className="fact-value">
                {selected.track === 'meat'
                  ? selected.totalDue > 0 ? 'Collect at pickup' : 'Already paid'
                  : 'Not required'}
              </div>
              <div className="fact-sub">
                {selected.track === 'meat'
                  ? selected.totalDue > 0 ? 'Mark money as paid before or during the handoff.' : 'This track is clear to hand off.'
                  : 'Cape and Webbs tracks do not carry a separate balance here.'}
              </div>
            </div>
            <div className="fact">
              <div className="fact-label">Waiting</div>
              <div className="fact-value">{ageSince(selected.calledAt)}</div>
              <div className="fact-sub">
                {selected.calledAt ? formatDisplayDateTime(selected.calledAt) : 'No called timestamp'}
              </div>
            </div>
            <div className="fact">
              <div className="fact-label">Pickup Status</div>
              <div className="fact-value">{selected.pickedUp ? 'Picked up' : 'Awaiting pickup'}</div>
              <div className="fact-sub">
                {selected.pickedUpAt ? formatDisplayDateTime(selected.pickedUpAt) : 'Still in called queue'}
              </div>
            </div>
            <div className="fact fact-wide">
              <div className="fact-label">Pickup Details</div>
              <div className="fact-value">{selected.pickedUpBy || 'Not recorded yet'}</div>
              <div className="fact-sub">
                {selected.pickupNotes ? selected.pickupNotes : 'Use the fields below to record who picked it up and any quick handoff notes.'}
              </div>
            </div>
          </div>

          {canUpdate ? (
            <div className="pickup-edit-grid">
              <label className="pickup-field">
                <span className="pickup-label">Picked up by</span>
                <input
                  value={pickedUpByInput}
                  onChange={(e) => setPickedUpByInput(e.target.value)}
                  placeholder="Customer, spouse, friend, etc."
                />
              </label>
              <label className="pickup-field">
                <span className="pickup-label">Pickup notes</span>
                <textarea
                  value={pickupNotesInput}
                  onChange={(e) => setPickupNotesInput(e.target.value)}
                  rows={3}
                  placeholder="Cash collected, freezer bags returned, special handoff note, or anything worth recording."
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <div className="empty">Loading...</div>
      ) : filteredRows.length === 0 ? (
        <div className="empty">Nobody currently in Called.</div>
      ) : (
        <div className="table-wrap">
          <div className="thead" style={{ gridTemplateColumns: gridCols }}>
            <div>Tag</div>
            <div>Customer</div>
            <div>Track</div>
            <div>Called</div>
            <div>Balance</div>
            <div>Payment</div>
            <div>Waiting</div>
            <div>Pickup</div>
          </div>

          {filteredRows.map((r, i) => {
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
                    href={canUpdate ? `/intake?tag=${encodeURIComponent(r.tag)}` : `/intake/${encodeURIComponent(r.tag)}`}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => { e.stopPropagation(); openIntake(r.tag); }}
                  >
                    {r.tag || '-'}
                  </a>
                </div>
                <div className="customer-cell">
                  <div className="customer-name">{r.customer || '-'}</div>
                  <div className="customer-sub">
                    Confirmation {r.confirmation || '-'}
                    {r.phone ? ` | ${r.phone}` : ''}
                  </div>
                </div>
                <div><TrackBadge track={r.track} /></div>
                <div>{r.calledAt ? formatDisplayDateTime(r.calledAt) : '-'}</div>
                <div className="balance-cell">
                  <div className="balance-main">{r.track === 'meat' ? money(r.totalDue) : 'Included'}</div>
                  {r.track === 'meat' ? (
                    <div className="balance-sub">
                      Proc {money(r.paidProcessing ? 0 : r.priceProc)} | Spec {money(r.paidSpecialty ? 0 : r.priceSpec)}
                    </div>
                  ) : (
                    <div className="balance-sub">No charge on this track</div>
                  )}
                </div>
                <div><PaymentBadge row={r} /></div>
                <div>{ageSince(r.calledAt)}</div>
                <div>{r.pickedUp ? <span className="badge ok">Done</span> : <span className="badge">Waiting</span>}</div>
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
                <span className="muted">{selected.customer || '-'}</span>{' '}
                <span className="muted">| Due {selected.track === 'meat' ? money(selected.totalDue) : 'Included'}</span>
              </>
            ) : (
              <span className="muted">Select a row to take action</span>
            )}
          </div>

          <div className="toolbar-actions">
            <button
              className="btn secondary small"
              disabled={!canUpdate || !selected || busy === `paid:${selected?.tag}:processing` || selected?.track !== 'meat' || !!selected?.paidProcessing}
              title={!canUpdate ? 'Only Staff or Admin can mark processing as paid.' : undefined}
              onClick={async () => {
                if (!selected) return;
                setBusy(`paid:${selected.tag}:processing`);
                try {
                  await markPaid(selected.tag, 'processing');
                  await load();
                } finally {
                  setBusy('');
                }
              }}
            >
              {busy === `paid:${selected?.tag}:processing` ? 'Saving...' : `Mark Processing Paid ${money(selected?.priceProc || 0)}`}
            </button>

            <button
              className="btn secondary small"
              disabled={!canUpdate || !selected || busy === `paid:${selected?.tag}:specialty` || selected?.track !== 'meat' || !selected?.priceSpec || !!selected?.paidSpecialty}
              title={!canUpdate ? 'Only Staff or Admin can mark specialty as paid.' : undefined}
              onClick={async () => {
                if (!selected) return;
                setBusy(`paid:${selected.tag}:specialty`);
                try {
                  await markPaid(selected.tag, 'specialty');
                  await load();
                } finally {
                  setBusy('');
                }
              }}
            >
              {busy === `paid:${selected?.tag}:specialty` ? 'Saving...' : `Mark Specialty Paid ${money(selected?.priceSpec || 0)}`}
            </button>

            <button
              className="btn small"
              disabled={!canUpdate || !selected || busy === `pu:${selected?.tag}:${selected?.track}` || !!selected?.pickedUp}
              title={!canUpdate ? 'Only Staff or Admin can mark items picked up.' : undefined}
              onClick={async () => {
                if (!selected) return;
                setBusy(`pu:${selected.tag}:${selected.track}`);
                try {
                  await markPickedUp(selected.tag, selected.track, pickedUpByInput, pickupNotesInput);
                  await load();
                } finally {
                  setBusy('');
                }
              }}
            >
              {busy === `pu:${selected?.tag}:${selected?.track}` ? 'Saving...' : selected?.pickedUp ? 'Picked Up' : `Mark ${selected?.track === 'meat' ? 'Picked Up' : 'Handed Off'}`}
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
        .pickup-filters input,
        .pickup-filters select {
          width: 100%;
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
        .fact-wide {
          grid-column: 1 / -1;
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
        .pickup-edit-grid {
          display: grid;
          grid-template-columns: minmax(220px, 0.7fr) minmax(260px, 1fr);
          gap: 12px;
        }
        .pickup-field {
          display: grid;
          gap: 6px;
        }
        .pickup-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .pickup-field input,
        .pickup-field textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(191, 210, 194, 0.35);
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
          padding: 11px 12px;
        }
        .pickup-field textarea {
          resize: vertical;
          min-height: 92px;
        }
        .table-wrap {
          background: #101715;
          border: 1px solid #1f2c24;
          border-radius: 12px;
          overflow: hidden;
          color: #e5e7eb;
        }
        .thead {
          display: grid;
          gap: 8px;
          font-weight: 800;
          padding: 12px 12px;
          border-bottom: 1px solid #1f2c24;
          background: #0c120f;
          font-size: 15px;
        }
        .trow {
          display: grid;
          gap: 8px;
          align-items: center;
          padding: 12px 12px;
          border-bottom: 1px solid #152019;
          background: #101715;
          cursor: pointer;
        }
        .trow.odd { background: #122019; }
        .trow.selected { outline: 2px solid #1f6f3e; outline-offset: -2px; background: #062d25 !important; }
        a { color: #9fe3b4; font-weight: 800; text-decoration: underline; }
        .customer-cell { display: grid; gap: 4px; }
        .customer-name { font-weight: 850; }
        .customer-sub, .balance-sub { color: #9ca3af; font-size: 13px; }
        .balance-main { font-weight: 900; }
        .badge {
          display: inline-block;
          padding: 3px 9px;
          border-radius: 999px;
          background: #1f2937;
          color: #fff;
          font-weight: 800;
          font-size: 12px;
        }
        .badge.ok { background: #235532; }
        .badge.warn { background: #9a3412; }
        .badge.neutral { background: #374151; }
        .muted { color: #9ca3af; }
        .empty {
          background: #101715;
          border: 1px solid #1f2c24;
          color: #e5e7eb;
          border-radius: 12px;
          padding: 12px;
        }
        .err {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          border-radius: 12px;
          padding: 12px;
          font-weight: 800;
        }
        .btn {
          padding: 8px 12px;
          border: 1px solid #235532;
          border-radius: 10px;
          background: #2f6f3f;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }
        .btn.secondary { background: #101715; color: #e5e7eb; border-color: #304336; }
        .btn.small { padding: 6px 10px; font-size: 14px; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        @media (max-width: 960px) {
          .pickup-filters {
            grid-template-columns: 1fr !important;
          }
          .pickup-edit-grid {
            grid-template-columns: 1fr;
          }
        }
        .toolbar {
          position: sticky;
          bottom: 0;
          z-index: 15;
          margin-top: 10px;
          background: #0b0f12;
          border-top: 1px solid #111827;
          box-shadow: 0 -8px 30px rgba(0,0,0,.25);
        }
        .toolbar-inner {
          max-width: 1190px;
          margin: 0 auto;
          padding: 10px 12px;
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          color: #e5e7eb;
          flex-wrap: wrap;
        }
        .pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          background: #111827;
          color: #e5e7eb;
          font-weight: 800;
        }
        .pill.small { padding: 2px 8px; }
        .toolbar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
      `}</style>
    </main>
  );
}
