'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { saveJob, tokenHeader } from '@/lib/api';

type OrderRow = {
  id: string;
  tag: string;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
  specialtyStatus?: string | null;
  specialty_finished_email_sent_at?: string | null;
  specialtyFinishedEmailSentAt?: string | null;
  specialty_finished_sms_sent_at?: string | null;
  specialtyFinishedSmsSentAt?: string | null;
  last_call_at?: string | null;
  lastCallAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  specialtyItems?: Array<{
    slug: string;
    name: string;
    shortName: string;
    quantity: number;
  }>;
};

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function lower(v: any) {
  return String(v || '').trim().toLowerCase();
}

function readyLike(v: any) {
  return /finish|ready|complete|completed|done|called/.test(lower(v));
}

function specialtyStatus(row: OrderRow) {
  return row.specialty_status ?? row.specialtyStatus ?? '';
}

function called(v: any) {
  return lower(v) === 'called';
}

function contacted(row: OrderRow) {
  return (
    called(specialtyStatus(row)) ||
    !!(row.specialty_finished_email_sent_at || row.specialtyFinishedEmailSentAt) ||
    !!(row.specialty_finished_sms_sent_at || row.specialtyFinishedSmsSentAt)
  );
}

function firstDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return raw;
  }
  return null;
}

function ageDays(value: string | null) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const days = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 ? days : null;
}

function ageText(value: string | null) {
  const days = ageDays(value);
  if (days == null) return 'Unknown';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} hr`;
  return `${days.toFixed(1)} d`;
}

function openedAt(row: OrderRow) {
  return firstDate(row.dropoff_date, row.updated_at, row.updatedAt);
}

function readyAt(row: OrderRow) {
  return firstDate(
    row.specialty_finished_email_sent_at,
    row.specialtyFinishedEmailSentAt,
    row.specialty_finished_sms_sent_at,
    row.specialtyFinishedSmsSentAt,
    row.last_call_at,
    row.lastCallAt,
    row.updated_at,
    row.updatedAt,
    row.dropoff_date
  );
}

function rowAgeText(row: OrderRow) {
  return readyLike(specialtyStatus(row)) ? ageText(readyAt(row)) : ageText(openedAt(row));
}

function rowPounds(row: OrderRow) {
  return (row.specialtyItems || []).reduce((sum, item) => sum + n(item.quantity), 0);
}

function contactLine(row: OrderRow) {
  return [row.phone, row.email].map((value) => String(value || '').trim()).filter(Boolean).join(' | ');
}

function aggregateRows(sourceRows: OrderRow[]) {
  const bySlug = new Map<string, { name: string; shortName: string; total: number }>();
  let totalPounds = 0;
  for (const row of sourceRows) {
    for (const item of row.specialtyItems || []) {
      totalPounds += n(item.quantity);
      const current = bySlug.get(item.slug) || { name: item.name, shortName: item.shortName, total: 0 };
      current.total += n(item.quantity);
      bySlug.set(item.slug, current);
    }
  }
  return {
    totalPounds,
    items: Array.from(bySlug.entries())
      .map(([slug, item]) => ({ slug, ...item }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  };
}

function lifecycle(row: OrderRow) {
  const status = specialtyStatus(row);
  if (readyLike(status)) {
    return contacted(row) ? 'Finished, waiting pickup' : 'Finished, needs contact';
  }
  if (lower(status).includes('progress')) return 'In production';
  return 'Not started';
}

const styles: Record<string, React.CSSProperties> = {
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  },
  label: { fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 },
  value: { fontSize: 22, fontWeight: 950 as any, color: '#0f172a' },
  kpiHint: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: 800 },
  viewBar: {
    marginBottom: 12,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  viewButton: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontWeight: 900,
    cursor: 'pointer',
  },
  viewButtonActive: {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #155acb',
    background: '#155acb',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  empty: {
    marginTop: 12,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 12,
    padding: 16,
    color: '#166534',
    fontWeight: 900,
  },
  wrap: {
    marginTop: 12,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableScroller: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    padding: '10px 10px',
    fontSize: 12,
    fontWeight: 900,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  td: {
    borderBottom: '1px solid #f1f5f9',
    padding: '10px 10px',
    fontWeight: 700,
    color: '#0f172a',
    verticalAlign: 'top',
  },
  orderCell: { display: 'grid', gap: 4, minWidth: 260 },
  orderLine: { display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 700, color: '#334155' },
  orderTotal: { display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 6, borderTop: '1px solid #e5e7eb', fontWeight: 900, color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 12, fontWeight: 700, marginTop: 4 },
  link: { color: '#155acb', fontWeight: 900, textDecoration: 'none' },
  btn: {
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#155acb',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
  },
  btnOff: {
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#94a3b8',
    color: '#fff',
    fontWeight: 900,
    cursor: 'not-allowed',
  },
  msg: { fontSize: 12, color: '#334155', marginBottom: 8, fontWeight: 800 },
  err: { fontSize: 12, color: '#b91c1c', marginBottom: 8, fontWeight: 900 },
};

export default function SpecialtyOrdersClient({ initialRows }: { initialRows: OrderRow[] }) {
  const [rows, setRows] = useState<OrderRow[]>(initialRows);
  const [busyTag, setBusyTag] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [view, setView] = useState<'outstanding' | 'pickup'>('outstanding');

  const outstandingRows = useMemo(() => rows.filter((row) => !readyLike(specialtyStatus(row))), [rows]);
  const pickupRows = useMemo(() => rows.filter((row) => readyLike(specialtyStatus(row))), [rows]);
  const visibleRows = view === 'pickup' ? pickupRows : outstandingRows;
  const outstandingAggregated = useMemo(() => aggregateRows(outstandingRows), [outstandingRows]);
  const visibleAggregated = useMemo(() => aggregateRows(visibleRows), [visibleRows]);

  const summary = useMemo(() => {
    const needsContact = pickupRows.filter((row) => !contacted(row)).length;
    const oldestReady =
      pickupRows
        .map((row) => ageDays(readyAt(row)))
        .filter((value): value is number => typeof value === 'number')
        .sort((a, b) => b - a)[0] ?? null;

    return {
      needsContact,
      contactedPickup: pickupRows.length - needsContact,
      oldestReady,
    };
  }, [pickupRows]);

  React.useEffect(() => {
    fetch('/api/admin/staff-context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setStaffRole((json?.processor?.role as 'admin' | 'staff' | 'readonly' | null) || null);
      })
      .catch(() => {});
  }, []);

  const canUpdate = staffRole === 'admin' || staffRole === 'staff';

  const markFinished = async (tag: string) => {
    setErr('');
    setMsg('');
    setBusyTag(tag);
    try {
      const res = await fetch('/api/specialty/mark-finished', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...tokenHeader() },
        body: JSON.stringify({ tag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(`HTTP ${res.status}: ${j?.error || 'Update failed'}`);
      setRows((prev) =>
        prev.map((r) =>
          r.tag === tag
            ? { ...r, ...(j?.job || {}), specialty_status: 'Finished', specialtyStatus: 'Finished', updated_at: new Date().toISOString() }
            : r
        )
      );
      setMsg(`Marked ${tag} specialty as Finished`);
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusyTag('');
    }
  };

  const markPickedUp = async (tag: string) => {
    setErr('');
    setMsg('');
    setBusyTag(tag);
    try {
      await saveJob({ tag, specialtyStatus: 'Picked Up' } as any);
      setRows((prev) => prev.filter((r) => r.tag !== tag));
      setMsg(`Marked ${tag} specialty as Picked Up`);
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusyTag('');
    }
  };

  const renderAction = (r: OrderRow, mobile = false) => {
    const isReady = readyLike(specialtyStatus(r));
    const disabled = !canUpdate || !!busyTag;
    const activeStyle = isReady ? { ...styles.btn, background: '#166534' } : styles.btn;
    const title = !canUpdate
      ? isReady
        ? 'Only Staff or Admin can mark specialty picked up.'
        : 'Only Staff or Admin can mark specialty orders finished.'
      : isReady
        ? 'Sets Specialty Status to Picked Up'
        : 'Sets Specialty Status to Finished';

    return (
      <button
        type="button"
        onClick={() => (isReady ? markPickedUp(r.tag) : markFinished(r.tag))}
        disabled={disabled}
        style={disabled ? styles.btnOff : activeStyle}
        title={title}
        className={mobile ? 'specialty-mobile-btn' : undefined}
      >
        {busyTag === r.tag ? 'Updating...' : isReady ? 'Mark Picked Up' : 'Mark Finished'}
      </button>
    );
  };

  const isPickupView = view === 'pickup';
  const emptyText = isPickupView
    ? 'No finished specialty orders are waiting for pickup.'
    : 'No outstanding specialty production right now.';
  const breakdownTitle = isPickupView ? 'Finished Order Contents' : 'Outstanding Breakdown';
  const tableOrderTitle = isPickupView ? 'Finished Order' : 'Outstanding Order';

  return (
    <div>
      {msg && <div style={styles.msg}>{msg}</div>}
      {err && <div style={styles.err}>{err}</div>}
      {staffRole === 'readonly' && (
        <div style={{ ...styles.msg, color: '#3730a3', background: '#eef2ff', border: '1px solid #c7d2fe', padding: 10, borderRadius: 8 }}>
          Read-only access: you can review specialty totals and open intake details, but only Staff or Admin can mark specialty orders finished or picked up.
        </div>
      )}

      <div className="specialty-kpi-grid" style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>Outstanding Lbs</div>
          <div style={styles.value}>{outstandingAggregated.totalPounds.toFixed(1)} lb</div>
          <div style={styles.kpiHint}>Not finished yet</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Outstanding Orders</div>
          <div style={styles.value}>{outstandingRows.length}</div>
          <div style={styles.kpiHint}>Production queue</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Finished Orders</div>
          <div style={styles.value}>{pickupRows.length}</div>
          <div style={styles.kpiHint}>{summary.needsContact} need contact</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Oldest Finished</div>
          <div style={styles.value}>{summary.oldestReady == null ? '-' : `${summary.oldestReady.toFixed(1)} d`}</div>
          <div style={styles.kpiHint}>{summary.contactedPickup} contacted</div>
        </div>
      </div>

      <div style={{ ...styles.card, ...styles.viewBar }}>
        <span style={{ ...styles.label, marginBottom: 0 }}>Show</span>
        {[
          { key: 'outstanding', label: `Outstanding (${outstandingRows.length})` },
          { key: 'pickup', label: `Finished / Pickup (${pickupRows.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key as typeof view)}
            style={view === item.key ? styles.viewButtonActive : styles.viewButton}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleAggregated.items.length ? (
        <div className="specialty-summary-grid" style={{ ...styles.kpiGrid, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div style={styles.card}>
            <div style={styles.label}>{breakdownTitle}</div>
            {visibleAggregated.items.map((item) => (
              <div key={item.slug} style={styles.orderLine}>
                <span>{item.shortName || item.name}</span>
                <span>{item.total.toFixed(1)} lb</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!visibleRows.length ? (
        <div style={styles.empty}>{emptyText}</div>
      ) : (
        <>
          <div className="specialty-mobile-list">
            {visibleRows.map((r) => {
              const status = specialtyStatus(r);
              const isReady = readyLike(status);
              const contact = contactLine(r);
              return (
                <div key={`mobile-${r.tag}`} className="specialty-mobile-card">
                  <div className="specialty-mobile-top">
                    <div>
                      <div className="specialty-mobile-tag">{r.tag}</div>
                      <div className="specialty-mobile-name">{r.customer_name || 'Unknown customer'}</div>
                    </div>
                    <div className="specialty-mobile-status">{lifecycle(r)}</div>
                  </div>
                  <div className="specialty-mobile-meta">
                    <span>Drop-off {r.dropoff_date || '-'}</span>
                    <span>{isReady ? 'Ready' : 'Open'} {rowAgeText(r)}</span>
                    <Link style={styles.link} href={`${canUpdate ? '/intake?tag=' : '/intake/'}${encodeURIComponent(r.tag)}`}>
                      Open Intake
                    </Link>
                  </div>
                  {contact ? <div className="specialty-mobile-contact">{contact}</div> : null}
                  <div className="specialty-mobile-order">
                    <div className="specialty-mobile-order-label">{tableOrderTitle}</div>
                    {(r.specialtyItems || []).length ? (
                      (r.specialtyItems || []).map((item) => (
                        <div key={`${r.tag}-${item.slug}`} className="specialty-mobile-order-row">
                          <span>{item.shortName || item.name}</span>
                          <span>{n(item.quantity).toFixed(1)} lb</span>
                        </div>
                      ))
                    ) : (
                      <div className="specialty-mobile-order-row">No item details saved.</div>
                    )}
                    <div className="specialty-mobile-total">
                      <span>Order total</span>
                      <span>{rowPounds(r).toFixed(1)} lb</span>
                    </div>
                  </div>
                  {renderAction(r, true)}
                </div>
              );
            })}
          </div>

          <div style={styles.wrap} className="specialty-table-wrap">
            <div style={styles.tableScroller}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Tag</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Drop-off</th>
                    <th style={styles.th}>Age</th>
                    <th style={styles.th}>Spec Status</th>
                    <th style={styles.th}>{tableOrderTitle}</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const status = specialtyStatus(r);
                    const isReady = readyLike(status);
                    const contact = contactLine(r);
                    return (
                      <tr key={r.tag}>
                        <td style={styles.td}>
                          <Link style={styles.link} href={`${canUpdate ? '/intake?tag=' : '/intake/'}${encodeURIComponent(r.tag)}`}>
                            {r.tag}
                          </Link>
                        </td>
                        <td style={styles.td}>
                          <div>{r.customer_name || ''}</div>
                          {contact ? <div style={styles.muted}>{contact}</div> : null}
                        </td>
                        <td style={styles.td}>{r.dropoff_date || ''}</td>
                        <td style={styles.td}>
                          <div>{rowAgeText(r)}</div>
                          <div style={styles.muted}>{isReady ? 'since finished' : 'since drop-off'}</div>
                        </td>
                        <td style={styles.td}>
                          <div>{status || ''}</div>
                          <div style={{ color: isReady && !contacted(r) ? '#92400e' : '#64748b', fontSize: 12, marginTop: 4 }}>
                            {lifecycle(r)}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.orderCell}>
                            {(r.specialtyItems || []).length ? (
                              (r.specialtyItems || []).map((item) => (
                                <div key={item.slug} style={styles.orderLine}>
                                  <span>{item.shortName || item.name}</span>
                                  <span>{n(item.quantity).toFixed(1)} lb</span>
                                </div>
                              ))
                            ) : (
                              <div style={styles.orderLine}>No item details saved.</div>
                            )}
                            <div style={styles.orderTotal}>
                              <span>Order total</span>
                              <span>{rowPounds(r).toFixed(1)} lb</span>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>{renderAction(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .specialty-mobile-list {
          display: none;
        }
        .specialty-mobile-card {
          display: grid;
          gap: 10px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }
        .specialty-mobile-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: start;
        }
        .specialty-mobile-tag {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #64748b;
        }
        .specialty-mobile-name {
          margin-top: 4px;
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.15;
        }
        .specialty-mobile-status {
          padding: 6px 10px;
          border-radius: 999px;
          background: #eef2ff;
          color: #334155;
          font-weight: 800;
          line-height: 1.15;
          max-width: 170px;
          text-align: right;
        }
        .specialty-mobile-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          color: #475569;
          font-size: 13px;
        }
        .specialty-mobile-contact {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .specialty-mobile-order {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }
        .specialty-mobile-order-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .specialty-mobile-order-row,
        .specialty-mobile-total {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #334155;
        }
        .specialty-mobile-total {
          padding-top: 6px;
          border-top: 1px solid #dbe4ee;
          color: #0f172a;
          font-weight: 900;
        }
        .specialty-mobile-btn {
          width: 100%;
          justify-content: center;
        }
        @media (max-width: 860px) {
          .specialty-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .specialty-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .specialty-mobile-list {
            display: grid;
            gap: 10px;
            margin-top: 12px;
          }
          .specialty-table-wrap {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
