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

export default async function SpecialtyReport() {
  const { data, error } = await supabase
    .from('specialty_open_totals')
    .select('*')
    .single();

  const row = data || {
    summer_sausage_lbs: 0,
    summer_sausage_cheese_lbs: 0,
    sliced_jerky_lbs: 0,
    job_count: 0,
  };

  return (
    <div className="report-card">
      <div className="screen-only">
        <div className="header">
          <h2>Open Specialty Totals</h2>
          <div className="sub">Totals only for specialty items not yet finished (Dropped Off / In Progress)</div>
        </div>

        {error && (
          <div className="err">Load failed: {String((error as any)?.message || error)}</div>
        )}

        <div className="kpis">
          <div className="kpi">
            <div className="label">Summer Sausage (lb)</div>
            <div className="val">{fmt(row.summer_sausage_lbs)}</div>
          </div>
          <div className="kpi">
            <div className="label">SS + Cheddar (lb)</div>
            <div className="val">{fmt(row.summer_sausage_cheese_lbs)}</div>
          </div>
          <div className="kpi">
            <div className="label">Sliced Jerky (lb)</div>
            <div className="val">{fmt(row.sliced_jerky_lbs)}</div>
          </div>
          <div className="kpi">
            <div className="label">Jobs Included</div>
            <div className="val">{Number(row.job_count || 0)}</div>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Open lbs</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Summer Sausage</td>
                <td style={{ textAlign: 'right' }}>{fmt(row.summer_sausage_lbs)}</td>
              </tr>
              <tr>
                <td>Summer Sausage + Cheddar</td>
                <td style={{ textAlign: 'right' }}>{fmt(row.summer_sausage_cheese_lbs)}</td>
              </tr>
              <tr>
                <td>Sliced Jerky</td>
                <td style={{ textAlign: 'right' }}>{fmt(row.sliced_jerky_lbs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .report-card { max-width: 1100px; margin: 0 auto; padding: 12px; }
        .header {
          position: sticky; top: 0; z-index: 5;
          background: #f5f8ff; border: 1px solid #d8e3f5; border-radius: 10px;
          padding: 10px 12px; box-shadow: 0 2px 10px rgba(0,0,0,.06);
          margin-bottom: 10px;
        }
        h2 { margin: 0; }
        .sub { margin-top: 4px; font-size: 12px; color: #64748b; font-weight: 700; }
        .err { margin: 10px 0; color: #b91c1c; font-weight: 800; }

        .kpis {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(4, 1fr);
          margin-bottom: 12px;
        }
        .kpi {
          border: 1px solid #d8e3f5;
          border-radius: 10px;
          background: #fff;
          padding: 10px 12px;
        }
        .label { font-size: 12px; font-weight: 900; color: #334155; }
        .val { margin-top: 4px; font-size: 26px; font-weight: 950; }

        .tableWrap {
          border: 1px solid #d8e3f5;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
        }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          background: #f8fafc;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #eef2f7;
          font-weight: 700;
        }
        tbody tr:last-child td { border-bottom: 0; }

        @media (max-width: 900px) {
          .kpis { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 520px) {
          .kpis { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
