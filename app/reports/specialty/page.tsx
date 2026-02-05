// app/reports/specialty/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type React from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import SpecialtyOrdersClient from './specialty-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
function fmt1(v: any) {
  return n(v).toFixed(1);
}
function fmtDate(v: any) {
  const s = String(v ?? '').trim();
  return s || '';
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1200, margin: '24px auto', padding: 16 },
  title: { margin: 0, marginBottom: 10 },
  sub: { marginTop: 0, marginBottom: 14, color: '#475569', fontWeight: 700, fontSize: 12 },

  warn: {
    background: '#fff7ed',
    border: '1px solid #fdba74',
    borderRadius: 10,
    padding: 14,
    color: '#9a3412',
    fontWeight: 800,
  },
  warnSub: { marginTop: 8, fontWeight: 600 },

  err: {
    marginBottom: 12,
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: 12,
    color: '#991b1b',
    fontWeight: 800,
  },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 },
  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  },
  label: { fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 },
  value: { fontSize: 22, fontWeight: 950 as any, color: '#0f172a' },

  tableWrap: {
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
  right: { textAlign: 'right' as const },
  small: { fontSize: 12, color: '#475569' },
  link: { color: '#155acb', fontWeight: 900, textDecoration: 'none' },
};

type Row = {
  tag: string;
  customer_name: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
  summer_sausage_lbs: number | null;
  summer_sausage_cheese_lbs: number | null;
  sliced_jerky_lbs: number | null;
};

export default async function SpecialtyReport() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={styles.page}>
        <h2 style={styles.title}>Open Specialty Totals</h2>
        <div style={styles.warn}>
          Missing environment variables.
          <div style={styles.warnSub}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pull open specialty rows
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'tag,customer_name,dropoff_date,specialty_status,summer_sausage_lbs,summer_sausage_cheese_lbs,sliced_jerky_lbs'
    )
    .eq('specialty_products', true)
    .in('specialty_status', ['Dropped Off', 'In Progress'])
    .order('dropoff_date', { ascending: true })
    .order('tag', { ascending: true });

  const rows = ((data as any) || []) as Row[];

  const totals = rows.reduce(
    (a, r) => {
      a.ss += n(r.summer_sausage_lbs);
      a.ssc += n(r.summer_sausage_cheese_lbs);
      a.jer += n(r.sliced_jerky_lbs);
      a.jobs += 1;
      return a;
    },
    { ss: 0, ssc: 0, jer: 0, jobs: 0 }
  );

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Open Specialty</h2>
      <p style={styles.sub}>Only jobs with Specialty Status = Dropped Off / In Progress.</p>

      {error && <div style={styles.err}>Load failed: {String((error as any)?.message || error)}</div>}

      <div style={styles.kpiGrid}>
        <div style={styles.card}>
          <div style={styles.label}>Summer Sausage</div>
          <div style={styles.value}>{fmt1(totals.ss)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>SS + Cheddar</div>
          <div style={styles.value}>{fmt1(totals.ssc)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Sliced Jerky</div>
          <div style={styles.value}>{fmt1(totals.jer)} lb</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Open Jobs</div>
          <div style={styles.value}>{totals.jobs}</div>
        </div>
      </div>

      {/* client-side actions (mark finished) */}
      <SpecialtyOrdersClient initialRows={rows} />
    </div>
  );
}
