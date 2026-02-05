import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type React from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

function fmt(n: any) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x.toFixed(1) : '0.0';
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 1100, margin: '0 auto', padding: 12 },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: '#f5f8ff',
    border: '1px solid #d8e3f5',
    borderRadius: 10,
    padding: '10px 12px',
    boxShadow: '0 2px 10px rgba(0,0,0,.06)',
    marginBottom: 10,
  },
  h2: { margin: 0 },
  sub: { marginTop: 4, fontSize: 12, color: '#64748b', fontWeight: 700 },
  err: { margin: '10px 0', color: '#b91c1c', fontWeight: 800 },

  kpis: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    marginBottom: 12,
  },
  kpi: {
    border: '1px solid #d8e3f5',
    borderRadius: 10,
    background: '#fff',
    padding: '10px 12px',
  },
  label: { fontSize: 12, fontWeight: 900, color: '#334155' },
  val: { marginTop: 4, fontSize: 26, fontWeight: 950 as any },

  tableWrap: {
    border: '1px solid #d8e3f5',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    background: '#f8fafc',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #eef2f7',
    fontWeight: 700,
  },
};

export default async function SpecialtyReport() {
  const { data, error } = await supabase
    .from('specialty_open_totals')
    .select('*')
    .single();

  const row =
    (data as any) || {
      summer_sausage_lbs: 0,
      summer_sausage_cheese_lbs: 0,
      sliced_jerky_lbs: 0,
      job_count: 0,
    };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h2 style={styles.h2}>Open Specialty Totals</h2>
        <div style={styles.sub}>
          Totals for specialty items not yet finished (Dropped Off / In Progress)
        </div>
      </div>

      {error && (
        <div style={styles.err}>
          Load failed: {String((error as any)?.message || error)}
        </div>
      )}

      <div style={styles.kpis}>
        <div style={styles.kpi}>
          <div style={styles.label}>Summer Sausage (lb)</div>
          <div style={styles.val}>{fmt(row.summer_sausage_lbs)}</div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.label}>SS + Cheddar (lb)</div>
          <div style={styles.val}>{fmt(row.summer_sausage_cheese_lbs)}</div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.label}>Sliced Jerky (lb)</div>
          <div style={styles.val}>{fmt(row.sliced_jerky_lbs)}</div>
        </div>

        <div style={styles.kpi}>
          <div style={styles.label}>Jobs Included</div>
          <div style={styles.val}>{Number(row.job_count || 0)}</div>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Product</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Open lbs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Summer Sausage</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                {fmt(row.summer_sausage_lbs)}
              </td>
            </tr>

            <tr>
              <td style={styles.td}>Summer Sausage + Cheddar</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                {fmt(row.summer_sausage_cheese_lbs)}
              </td>
            </tr>

            <tr>
              <td style={{ ...styles.td, borderBottom: 0 }}>Sliced Jerky</td>
              <td style={{ ...styles.td, textAlign: 'right', borderBottom: 0 }}>
                {fmt(row.sliced_jerky_lbs)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
