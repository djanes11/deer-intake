// app/reports/specialty/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type React from 'react';
import { createClient } from '@supabase/supabase-js';
import SpecialtyOrdersClient from './specialty-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OrderRow = {
  tag: string;
  customer_name: string | null;
  dropoff: string | null;
  specialty_status: string | null;
  summer_sausage_lbs: number | null;
  summer_sausage_cheese_lbs: number | null;
  sliced_jerky_lbs: number | null;
};

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
};

export default async function SpecialtyReport() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={styles.page}>
        <h2 style={styles.title}>Open Specialty</h2>
        <div style={styles.warn}>
          Missing environment variables.
          <div style={styles.warnSub}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.
          </div>
        </div>
      </div>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'tag,customer_name,dropoff,specialty_status,summer_sausage_lbs,summer_sausage_cheese_lbs,sliced_jerky_lbs'
    )
    .eq('specialty_products', true)
    .in('specialty_status', ['Dropped Off', 'In Progress'])
    .order('dropoff', { ascending: true })
    .order('tag', { ascending: true });

  const rows = ((data as any) || []) as OrderRow[];

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Open Specialty</h2>
      <p style={styles.sub}>Only jobs with Specialty Status = Dropped Off / In Progress.</p>

      {error && <div style={styles.err}>Load failed: {String((error as any)?.message || error)}</div>}

      {/* Client renders tiles + table so totals update instantly when a row is removed */}
      <SpecialtyOrdersClient initialRows={rows} />
    </div>
  );
}
