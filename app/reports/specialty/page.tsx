// app/reports/specialty/page.tsx
import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fmt(n: any) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(1) : '0.0';
}

export default async function SpecialtyReport() {
  // ---- BUILD / ENV GUARD ----
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Open Specialty Totals</h2>

        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fdba74',
            borderRadius: 10,
            padding: 14,
            color: '#9a3412',
            fontWeight: 700,
          }}
        >
          Missing environment variables.
          <div style={{ marginTop: 8, fontWeight: 500 }}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.
          </div>
        </div>
      </div>
    );
  }

  // ---- SAFE TO CREATE CLIENT NOW ----
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
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Open Specialty Totals</h2>

      {error && (
        <div
          style={{
            marginBottom: 12,
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: 12,
            color: '#991b1b',
            fontWeight: 700,
          }}
        >
          Load failed: {String((error as any)?.message || error)}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <div className="card">
          <div className="label">Summer Sausage</div>
          <div className="value">{fmt(row.summer_sausage_lbs)} lb</div>
        </div>

        <div className="card">
          <div className="label">SS + Cheddar</div>
          <div className="value">{fmt(row.summer_sausage_cheese_lbs)} lb</div>
        </div>

        <div className="card">
          <div className="label">Sliced Jerky</div>
          <div className="value">{fmt(row.sliced_jerky_lbs)} lb</div>
        </div>

        <div className="card">
          <div className="label">Open Jobs</div>
          <div className="value">{Number(row.job_count || 0)}</div>
        </div>
      </div>

      <style jsx>{`
        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        .label {
          font-size: 12px;
          font-weight: 800;
          color: #334155;
          margin-bottom: 6px;
        }
        .value {
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
