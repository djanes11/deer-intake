'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { tokenHeader } from '@/lib/api';

type OrderRow = {
  id: string;
  tag: string;
  customer_name: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
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
      setRows((prev) => prev.filter((r) => r.tag !== tag));
      setMsg(`Marked ${tag} specialty as Finished`);
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

      <div style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>All Specialty</div>
          <div style={styles.value}>{aggregated.totalPounds.toFixed(1)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Open Jobs</div>
          <div style={styles.value}>{rows.length}</div>
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

      <div style={{ ...styles.kpiGrid, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
            This report now reflects the processor&apos;s live specialty catalog instead of six hardcoded columns.
          </div>
        </div>
      </div>

      <div style={styles.wrap}>
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
            {rows.map((r) => (
              <tr key={r.tag}>
                <td style={styles.td}>
                  <Link style={styles.link} href={`${canUpdate ? '/intake?tag=' : '/intake/'}${encodeURIComponent(r.tag)}`}>
                    {r.tag}
                  </Link>
                </td>
                <td style={styles.td}>{r.customer_name || ''}</td>
                <td style={styles.td}>{r.dropoff_date || ''}</td>
                <td style={styles.td}>{r.specialty_status || ''}</td>
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
                    disabled={!canUpdate || !!busyTag}
                    style={!canUpdate || busyTag ? styles.btnOff : styles.btn}
                    title={!canUpdate ? 'Only Staff or Admin can mark specialty orders finished.' : 'Sets Specialty Status to Finished'}
                  >
                    {busyTag === r.tag ? 'Updating…' : 'Mark Finished'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
