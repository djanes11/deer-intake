// app/reports/specialty/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type React from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fmt(n: any) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(1) : '0.0';
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '24px auto', padding: 16 },
  title: { margin: 0, marginBottom: 12 },

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

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },

  card: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  },
  label: { fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 6 },
  value: { fontSize: 22, fontWeight: 950 as any, color: '#0f172a' },
};

export default async function SpecialtyReport() {
  // ---- BUILD / ENV GUARD ----
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={styles.page}>
        <h2 style={styles.title}>Open Specialty Totals</h2>

        <div style={styles.warn}>
          Missing environment variables.
          <div style={styles.warnSub}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await supabase
    .from('specialty_open_totals')
    .select('*')
    .single();

  const row = (data as any) || {
    summer_sausage_lbs: 0,
    summer_sausage_cheese_lbs: 0,
    sliced_jerky_lbs: 0,
    job_count: 0,
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Open Specialty Totals</h2>

      {error && (
        <div style={styles.err}>
          Load failed: {String((error as any)?.message || error)}
        </div>
      )}

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.label}>Summer Sausage</div>
          <div style={styles.value}>{fmt(row.summer_sausage_lbs)} lb</div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>SS + Cheddar</div>
          <div style={styles.value}>{fmt(row.summer_sausage_cheese_lbs)} lb</div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>Sliced Jerky</div>
          <div style={styles.value}>{fmt(row.sliced_jerky_lbs)} lb</div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>Open Jobs</div>
          <div style={styles.value}>{Number(row.job_count || 0)}</div>
        </div>
      </div>
    </div>
  );
}
