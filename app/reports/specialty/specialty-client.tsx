'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { tokenHeader } from '@/lib/api';
import { SPECIALTY_ITEMS } from '@/lib/specialty';

type OrderRow = {
  tag: string;
  customer_name: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
  original_summer_sausage_lbs: number | null;
  summer_sausage_cheese_lbs: number | null;
  jalapeno_summer_sausage_cheese_lbs: number | null;
  original_snack_sticks_lbs: number | null;
  original_snack_sticks_cheese_lbs: number | null;
  jalapeno_snack_sticks_cheese_lbs: number | null;
};

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
function fmt1(v: any) {
  return n(v).toFixed(1);
}

const styles: Record<string, React.CSSProperties> = {
  // Tiles
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

  // Table
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
  right: { textAlign: 'right' },
  link: { color: '#155acb', fontWeight: 900, textDecoration: 'none' },

  // Buttons / messages
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

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => {
        a.originalSummerSausageLbs += n(r.original_summer_sausage_lbs);
        a.summerSausageCheeseLbs += n(r.summer_sausage_cheese_lbs);
        a.jalapenoSummerSausageCheeseLbs += n(r.jalapeno_summer_sausage_cheese_lbs);
        a.originalSnackSticksLbs += n(r.original_snack_sticks_lbs);
        a.originalSnackSticksCheeseLbs += n(r.original_snack_sticks_cheese_lbs);
        a.jalapenoSnackSticksCheeseLbs += n(r.jalapeno_snack_sticks_cheese_lbs);
        a.jobs += 1;
        return a;
      },
      {
        originalSummerSausageLbs: 0,
        summerSausageCheeseLbs: 0,
        jalapenoSummerSausageCheeseLbs: 0,
        originalSnackSticksLbs: 0,
        originalSnackSticksCheeseLbs: 0,
        jalapenoSnackSticksCheeseLbs: 0,
        jobs: 0,
      }
    );
  }, [rows]);

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

      if (!res.ok || !j?.ok) {
        throw new Error(`HTTP ${res.status}: ${j?.error || 'Update failed'}`);
      }

      // remove row -> tiles recalc instantly
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

      {/* TOP TILES — now tied to rows state so it auto updates */}
      <div style={{ ...styles.kpiGrid, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {SPECIALTY_ITEMS.map((item) => (
          <div style={styles.card} key={item.key}>
            <div style={styles.label}>{item.shortLabel}</div>
            <div style={styles.value}>{n((totals as any)[item.key]).toFixed(1)} lb</div>
          </div>
        ))}
        <div style={styles.card}>
          <div style={styles.label}>Open Jobs</div>
          <div style={styles.value}>{totals.jobs}</div>
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
              {SPECIALTY_ITEMS.map((item) => (
                <th key={item.key} style={{ ...styles.th, ...styles.right }}>{item.shortLabel} lb</th>
              ))}
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.tag}>
                <td style={styles.td}>
                  {/* staff intake edit page */}
                  <Link style={styles.link} href={`/intake?tag=${encodeURIComponent(r.tag)}`}>
                    {r.tag}
                  </Link>
                </td>
                <td style={styles.td}>{r.customer_name || ''}</td>
                <td style={styles.td}>{r.dropoff_date || ''}</td>
                <td style={styles.td}>{r.specialty_status || ''}</td>
                {SPECIALTY_ITEMS.map((item) => (
                  <td key={item.key} style={{ ...styles.td, ...styles.right }}>
                    {fmt1((r as any)[item.dbKey])}
                  </td>
                ))}
                <td style={styles.td}>
                  <button
                    type="button"
                    onClick={() => markFinished(r.tag)}
                    disabled={!!busyTag}
                    style={busyTag ? styles.btnOff : styles.btn}
                    title="Sets Specialty Status to Finished"
                  >
                    {busyTag === r.tag ? 'Updating…' : 'Mark Finished'}
                  </button>
                </td>
              </tr>
            ))}

            {/* optional footer totals row */}
            <tr>
              <td style={{ ...styles.td, borderBottom: 0 }} colSpan={4}>
                Totals (open)
              </td>
              {SPECIALTY_ITEMS.map((item) => (
                <td key={item.key} style={{ ...styles.td, ...styles.right, borderBottom: 0 }}>
                  {n((totals as any)[item.key]).toFixed(1)}
                </td>
              ))}
              <td style={{ ...styles.td, borderBottom: 0 }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
