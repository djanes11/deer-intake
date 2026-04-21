import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import { getStaffProcessorContext, isPlatformAdmin } from '@/lib/staffContext';
import { formatDisplayDateTime } from '@/lib/dateFormat';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fmtDate(v: string | null | undefined) {
  return formatDisplayDateTime(v);
}

function actorLabel(row: any) {
  if (row.actor_username) return row.actor_username;
  if (row.actor_email) return row.actor_email;
  if (row.actor_auth_type === 'supabase') return 'Email staff user';
  if (row.actor_auth_type === 'local') return 'Local staff user';
  return 'Unknown user';
}

export default async function ActivityReportPage() {
  const processor = await getStaffProcessorContext();
  const platformAdmin = await isPlatformAdmin();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <main style={{ maxWidth: 1040, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          Missing Supabase environment variables.
        </div>
      </main>
    );
  }

  if (!platformAdmin && processor.role !== 'admin') {
    return (
      <main style={{ maxWidth: 1040, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Activity History</h1>
          <div style={{ color: '#475569' }}>
            Processor admin access is required to review settings, user, and workflow history for this processor.
          </div>
        </div>
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  let query = supabase
    .from('processor_audit_log')
    .select('id,actor_auth_type,actor_email,actor_username,actor_role,action,target_type,target_id,target_label,summary,details,created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  if (processor.id) {
    query = query.eq('processor_id', processor.id);
  }

  const { data, error } = await query;

  return (
    <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: '#f8fafc',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#cbd5e1' }}>
          Processor Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Activity History</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Recent workflow, settings, notification, print, and user-management changes for <strong>{processor.slug || 'this processor'}</strong>.
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>
          {String(error.message || error)}
        </div>
      ) : null}

      <section style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontWeight: 900, color: '#0f172a' }}>Recent activity</div>
          <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            This is the first audit layer, focused on actions owners are most likely to care about when something changes.
          </div>
        </div>

        {!data?.length ? (
          <div style={{ padding: 16, color: '#475569', lineHeight: 1.55 }}>
            No activity is logged yet. Actions like saving intakes, changing settings, printing, sending notifications, and updating staff will start showing here automatically.
          </div>
        ) : (
          <div style={{ display: 'grid' }}>
            {data.map((row: any, idx: number) => (
              <div
                key={row.id}
                style={{
                  padding: 16,
                  display: 'grid',
                  gap: 8,
                  borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
                  background: idx % 2 ? '#fbfdff' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{row.summary}</div>
                    <div style={{ color: '#475569', fontSize: 14 }}>
                      {actorLabel(row)}
                      {row.actor_role ? ` • ${String(row.actor_role).replace('readonly', 'read-only')}` : ''}
                      {' • '}
                      {fmtDate(row.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontSize: 12, fontWeight: 800 }}>
                      {row.action}
                    </span>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155', fontSize: 12, fontWeight: 800 }}>
                      {row.target_type}
                    </span>
                    {row.target_label ? (
                      <span style={{ padding: '4px 8px', borderRadius: 999, background: '#fff7ed', color: '#9a3412', fontSize: 12, fontWeight: 800 }}>
                        {row.target_label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
