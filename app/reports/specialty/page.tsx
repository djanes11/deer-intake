import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    gap: 10
