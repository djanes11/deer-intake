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
  specialty_finished_email_sent_at?: string | null;
  specialty_finished_sms_sent_at?: string | null;
  last_call_at?: string | null;
  updated_at?: string | null;
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

function called(v: any) {
  return lower(v) === 'called';
}

function contacted(row: OrderRow) {
  return called(row.specialty_status) || !!row.specialty_finished_email_sent_at || !!row.specialty_finished_sms_sent_at;
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

function readyAt(row: OrderRow) {
  return firstDate(row.specialty_finished_email_sent_at, row.specialty_finished_sms_sent_at, row.last_call_at, row.updated_at, row.dropoff_date);
}

function lifecycle(row: OrderRow) {
  if (readyLike(row.specialty_status)) {
    return contacted(row) ? 'Finished, waiting pickup' : 'Finished, needs contact';
  }
  if (lower(row.specialty_status).includes('progress')) return 'In production';
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
  const [filter, setFilter] = useState<'all' | 'production' | 'needs-contact' | 'pickup'>('all');

  const aggregated = useMemo(() => {
    const bySlug = new Map<string, { name: string; shortName: string; total: number }>();
    let totalPounds = 0;
    for (const row of rows) {
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
  }, [rows]);

  const lifecycleSummary = useMemo(() => {
    const production = rows.filter((row) => !readyLike(row.specialty_status)).length;
    const needsContact = rows.filter((row) => readyLike(row.specialty_status) && !contacted(row)).length;
    const pickup = rows.filter((row) => readyLike(row.specialty_status) && contacted(row)).length;
    const oldestReady = rows
      .filter((row) => readyLike(row.specialty_status))
      .map((row) => ageDays(readyAt(row)))
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => b - a)[0] ?? null;
    return { production, needsContact, pickup, oldestReady };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'production') return rows.filter((row) => !readyLike(row.specialty_status));
    if (filter === 'needs-contact') return rows.filter((row) => readyLike(row.specialty_status) && !contacted(row));
    if (filter === 'pickup') return rows.filter((row) => readyLike(row.specialty_status) && contacted(row));
    return rows;
  }, [rows, filter]);

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
      setRows((prev) => prev.map((r) => r.tag === tag ? { ...r, specialty_status: 'Finished', ...(j?.job || {}) } : r));
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

  return (
    <div>
      {msg && <div style={styles.msg}>{msg}</div>}
      {err && <div style={styles.err}>{err}</div>}
      {!canUpdate && (
        <div style={{ ...styles.msg, color: '#3730a3', background: '#eef2ff', border: '1px solid #c7d2fe', padding: 10, borderRadius: 8 }}>
          Read-only access: you can review specialty totals and open intake details, but only Staff or Admin can mark specialty orders finished.
        </div>
      )}

      <div className="specialty-kpi-grid" style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>All Specialty</div>
          <div style={styles.value}>{aggregated.totalPounds.toFixed(1)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Active Jobs</div>
          <div style={styles.value}>{rows.length}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>In Production</div>
          <div style={styles.value}>{lifecycleSummary.production}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Need Contact</div>
          <div style={styles.value}>{lifecycleSummary.needsContact}</div>
        </div>
      </div>

      <div className="specialty-kpi-grid" style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>Waiting Pickup</div>
          <div style={styles.value}>{lifecycleSummary.pickup}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Oldest Finished</div>
          <div style={styles.value}>{lifecycleSummary.oldestReady == null ? '-' : `${lifecycleSummary.oldestReady.toFixed(1)} d`}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Configured Items In Queue</div>
          <div style={styles.value}>{aggregated.items.length}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Largest Open Item</div>
          <div style={styles.value}>{aggregated.items[0] ? `${aggregated.items[0].total.toFixed(1)} lb` : '0.0 lb'}</div>
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ ...styles.label, marginBottom: 0 }}>Show</span>
        {[
          { key: 'all', label: `All (${rows.length})` },
          { key: 'production', label: `Production (${lifecycleSummary.production})` },
          { key: 'needs-contact', label: `Needs Contact (${lifecycleSummary.needsContact})` },
          { key: 'pickup', label: `Waiting Pickup (${lifecycleSummary.pickup})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key as typeof filter)}
            style={filter === item.key ? styles.btn : { ...styles.btnOff, background: '#fff', color: '#334155', cursor: 'pointer' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="specialty-summary-grid" style={{ ...styles.kpiGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div style={styles.card}>
          <div style={styles.label}>Specialty Breakdown</div>
          {aggregated.items.length ? (
            aggregated.items.map((item) => (
              <div key={item.slug} style={styles.orderLine}>
                <span>{item.shortName || item.name}</span>
                <span>{item.total.toFixed(1)} lb</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#475569', lineHeight: 1.5 }}>No open specialty items right now.</div>
          )}
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Report Notes</div>
          <div style={{ color: '#475569', lineHeight: 1.5 }}>
            This report reflects the processor&apos;s live specialty catalog instead of hardcoded product columns.
          </div>
        </div>
      </div>

      <div className="specialty-mobile-list">
        {filteredRows.map((r) => (
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
              <Link style={styles.link} href={`${canUpdate ? '/intake?tag=' : '/intake/'}${encodeURIComponent(r.tag)}`}>
                Open Intake
              </Link>
            </div>
            <div className="specialty-mobile-order">
              {(r.specialtyItems || []).map((item) => (
                <div key={`${r.tag}-${item.slug}`} className="specialty-mobile-order-row">
                  <span>{item.shortName || item.name}</span>
                  <span>{n(item.quantity).toFixed(1)} lb</span>
                </div>
              ))}
              <div className="specialty-mobile-total">
                <span>Total</span>
                <span>{(r.specialtyItems || []).reduce((sum, item) => sum + n(item.quantity), 0).toFixed(1)} lb</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => markFinished(r.tag)}
              disabled={!canUpdate || !!busyTag || readyLike(r.specialty_status)}
              style={!canUpdate || busyTag || readyLike(r.specialty_status) ? styles.btnOff : styles.btn}
              title={!canUpdate ? 'Only Staff or Admin can mark specialty orders finished.' : 'Sets Specialty Status to Finished'}
              className="specialty-mobile-btn"
            >
              {busyTag === r.tag ? 'Updating...' : readyLike(r.specialty_status) ? 'Finished' : 'Mark Finished'}
            </button>
            {readyLike(r.specialty_status) ? (
              <button
                type="button"
                onClick={() => markPickedUp(r.tag)}
                disabled={!canUpdate || !!busyTag}
                style={!canUpdate || busyTag ? styles.btnOff : styles.btn}
                className="specialty-mobile-btn"
              >
                {busyTag === r.tag ? 'Updating...' : 'Mark Picked Up'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div style={styles.wrap} className="specialty-table-wrap">
        <div style={styles.tableScroller}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tag</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Drop-off</th>
                <th style={styles.th}>Spec Status</th>
                <th style={styles.th}>Order</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.tag}>
                  <td style={styles.td}>
                    <Link style={styles.link} href={`${canUpdate ? '/intake?tag=' : '/intake/'}${encodeURIComponent(r.tag)}`}>
                      {r.tag}
                    </Link>
                  </td>
                  <td style={styles.td}>{r.customer_name || ''}</td>
                  <td style={styles.td}>{r.dropoff_date || ''}</td>
                  <td style={styles.td}>
                    <div>{r.specialty_status || ''}</div>
                    <div style={{ color: readyLike(r.specialty_status) && !contacted(r) ? '#92400e' : '#64748b', fontSize: 12, marginTop: 4 }}>
                      {lifecycle(r)}
                      {readyLike(r.specialty_status) ? ` | ${ageText(readyAt(r))}` : ''}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.orderCell}>
                      {(r.specialtyItems || []).map((item) => (
                        <div key={item.slug} style={styles.orderLine}>
                          <span>{item.shortName || item.name}</span>
                          <span>{n(item.quantity).toFixed(1)} lb</span>
                        </div>
                      ))}
                      <div style={styles.orderTotal}>
                        <span>Total</span>
                        <span>{(r.specialtyItems || []).reduce((sum, item) => sum + n(item.quantity), 0).toFixed(1)} lb</span>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      onClick={() => markFinished(r.tag)}
                      disabled={!canUpdate || !!busyTag || readyLike(r.specialty_status)}
                      style={!canUpdate || busyTag || readyLike(r.specialty_status) ? styles.btnOff : styles.btn}
                      title={!canUpdate ? 'Only Staff or Admin can mark specialty orders finished.' : 'Sets Specialty Status to Finished'}
                    >
                      {busyTag === r.tag ? 'Updating...' : readyLike(r.specialty_status) ? 'Finished' : 'Mark Finished'}
                    </button>
                    {readyLike(r.specialty_status) ? (
                      <button
                        type="button"
                        onClick={() => markPickedUp(r.tag)}
                        disabled={!canUpdate || !!busyTag}
                        style={{ ...(!canUpdate || busyTag ? styles.btnOff : styles.btn), marginLeft: 8, background: !canUpdate || busyTag ? '#94a3b8' : '#166534' }}
                        title={!canUpdate ? 'Only Staff or Admin can mark specialty picked up.' : 'Sets Specialty Status to Picked Up'}
                      >
                        {busyTag === r.tag ? 'Updating...' : 'Mark Picked Up'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
          white-space: nowrap;
        }
        .specialty-mobile-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          color: #475569;
          font-size: 13px;
        }
        .specialty-mobile-order {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
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
