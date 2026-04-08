// app/reports/specialty/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type React from 'react';
import { createClient } from '@supabase/supabase-js';
import SpecialtyOrdersClient from './specialty-client';
import { getDefaultProcessorContext } from '@/lib/processorContext';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const processor = await getDefaultProcessorContext();

  let query = supabase
    .from('jobs')
    .select(
      'id,tag,customer_name,dropoff_date,specialty_status'
    )
    .eq('specialty_products', true)
    .in('specialty_status', ['Dropped Off', 'In Progress']);

  if (processor.id) {
    query = query.eq('processor_id', processor.id);
  }

  const { data, error } = await query
    .order('dropoff_date', { ascending: true })
    .order('tag', { ascending: true });

  const rows = ((data as any) || []) as OrderRow[];
  const jobIds = rows.map((row) => row.id).filter(Boolean);
  let itemMap = new Map<string, OrderRow['specialtyItems']>();
  if (jobIds.length) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('job_specialty_items')
      .select('job_id,item_slug,item_name,short_name,quantity,sort_order')
      .in('job_id', jobIds)
      .order('sort_order', { ascending: true });
    if (itemsError) throw itemsError;
    itemMap = new Map<string, OrderRow['specialtyItems']>();
    for (const item of itemRows || []) {
      const key = String((item as any).job_id || '');
      const list = itemMap.get(key) || [];
      list.push({
        slug: String((item as any).item_slug || ''),
        name: String((item as any).item_name || ''),
        shortName: String((item as any).short_name || ''),
        quantity: Number((item as any).quantity ?? 0),
      });
      itemMap.set(key, list);
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Open Specialty</h2>
      <p style={styles.sub}>Only jobs with Specialty Status = Dropped Off / In Progress.</p>

      {error && <div style={styles.err}>Load failed: {String((error as any)?.message || error)}</div>}

      {/* Client renders tiles + table so totals update instantly when a row is removed */}
      <SpecialtyOrdersClient
        initialRows={rows.map((row) => ({
          ...row,
          specialtyItems: itemMap.get(String(row.id)) || [],
        }))}
      />
    </div>
  );
}
