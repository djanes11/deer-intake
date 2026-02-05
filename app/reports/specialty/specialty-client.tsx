'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

type OrderRow = {
  tag: string;
  customer_name: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
  summer_sausage_lbs: number | null;
  summer_sausage_cheese_lbs: number | null;
  sliced_jerky_lbs: number | null;
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
        a.ss += n(r.summer_sausage_lbs);
        a.ssc += n(r.summer_sausage_cheese_lbs);
        a.jer += n(r.sliced_jerky_lbs);
        a.jobs += 1;
        return a;
      },
      { ss: 0, ssc: 0, jer: 0, jobs: 0 }
    );
  }, [rows]);

  const markFinished = async (tag: string) => {
    setErr('');
    setMsg('');
    setBusyTag(tag);

    try {
      const res = await fetch('/api/specialty/mark-finished', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
      <div style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>Summer Sausage</div>
          <div style={styles.value}>{totals.ss.toFixed(1)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>SS + Cheddar</div>
          <div style={styles.value}>{totals.ssc.toFixed(1)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Sliced Jerky</div>
          <div style={styles.value}>{totals.jer.toFixed(1)} lb</div>
        </div>
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
              <th style={{ ...styles.th, ...styles.right }}>SS lb</th>
              <th style={{ ...styles.th, ...styles.right }}>SS+C lb</th>
              <th style={{ ...styles.th, ...styles.right }}>Jerky lb</th>
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
                <td style={{ ...styles.td, ...styles.right }}>{fmt1(r.summer_sausage_lbs)}</td>
                <td style={{ ...styles.td, ...styles.right }}>{fmt1(r.summer_sausage_cheese_lbs)}</td>
                <td style={{ ...styles.td, ...styles.right }}>{fmt1(r.sliced_jerky_lbs)}</td>
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
              <td style={{ ...styles.td, ...styles.right, borderBottom: 0 }}>{totals.ss.toFixed(1)}</td>
              <td style={{ ...styles.td, ...styles.right, borderBottom: 0 }}>{totals.ssc.toFixed(1)}</td>
              <td style={{ ...styles.td, ...styles.right, borderBottom: 0 }}>{totals.jer.toFixed(1)}</td>
              <td style={{ ...styles.td, borderBottom: 0 }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
