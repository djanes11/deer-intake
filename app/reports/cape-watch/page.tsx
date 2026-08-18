import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { ReportAccessDenied, requireReportAccess } from '../reportAccess';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = {
  id: string;
  tag: string | null;
  confirmation: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  process_type: string | null;
  process_type_requires_cape: boolean | null;
  status: string | null;
  caping_status: string | null;
  picked_up_cape: boolean | null;
  picked_up_cape_at: string | null;
  cape_finished_email_sent_at: string | null;
  cape_finished_sms_sent_at: string | null;
  last_call_at: string | null;
  pref_email: boolean | null;
  pref_sms: boolean | null;
  pref_call: boolean | null;
  sms_consent: boolean | null;
  dropoff_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function capeReady(value: unknown) {
  const status = lower(value);
  return /cape|caped|finish|finished|ready|complete|completed|done/.test(status);
}

function isCalled(value: unknown) {
  return lower(value) === 'called';
}

function firstDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return raw;
  }
  return null;
}

function ageDays(value: string | null) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const days = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 ? days : null;
}

function ageText(value: string | null) {
  const days = ageDays(value);
  if (days == null) return 'Unknown';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))} hr`;
  return `${days.toFixed(1)} d`;
}

function contacted(row: Row) {
  return isCalled(row.caping_status) || !!row.cape_finished_email_sent_at || !!row.cape_finished_sms_sent_at;
}

function readyAt(row: Row) {
  return firstDate(row.cape_finished_email_sent_at, row.cape_finished_sms_sent_at, row.last_call_at, row.updated_at, row.dropoff_date, row.created_at);
}

function contactPref(row: Row) {
  if (row.pref_sms && row.sms_consent && row.phone) return `Text ${row.phone}`;
  if (row.pref_email && row.email) return `Email ${row.email}`;
  if (row.pref_call && row.phone) return `Call ${row.phone}`;
  if (row.phone) return `Call ${row.phone}`;
  if (row.email) return `Email ${row.email}`;
  return 'No usable contact';
}

function stage(row: Row) {
  const status = String(row.caping_status || '').trim();
  if (isCalled(status)) return 'Called, waiting pickup';
  if (capeReady(status)) return contacted(row) ? 'Finished, contacted' : 'Finished, needs contact';
  return status ? 'Cape work open' : 'Needs cape status';
}

export default async function CapeWatchPage() {
  const access = await requireReportAccess('view');
  if (!access.ok) {
    return <ReportAccessDenied title="Cape Watch" error={access.error} />;
  }

  const processor = access.processor;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <main className="app-frame">
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          Missing Supabase environment variables.
        </div>
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  let query = supabase
    .from('jobs')
    .select('id,tag,confirmation,customer_name,phone,email,process_type,process_type_requires_cape,status,caping_status,picked_up_cape,picked_up_cape_at,cape_finished_email_sent_at,cape_finished_sms_sent_at,last_call_at,pref_email,pref_sms,pref_call,sms_consent,dropoff_date,created_at,updated_at')
    .is('pending_deleted_at', null)
    .or('process_type.ilike.%cape%,process_type_requires_cape.eq.true')
    .order('dropoff_date', { ascending: true })
    .limit(2500);

  if (processor.id) query = query.eq('processor_id', processor.id);

  const { data, error } = await query;
  const rows = ((data || []) as Row[])
    .filter((row) => !row.picked_up_cape)
    .sort((a, b) => {
      const aReady = capeReady(a.caping_status) || isCalled(a.caping_status);
      const bReady = capeReady(b.caping_status) || isCalled(b.caping_status);
      if (aReady !== bReady) return aReady ? -1 : 1;
      return (ageDays(readyAt(b)) || 0) - (ageDays(readyAt(a)) || 0);
    });

  const readyRows = rows.filter((row) => capeReady(row.caping_status) || isCalled(row.caping_status));
  const needsContact = readyRows.filter((row) => !contacted(row)).length;
  const held3 = readyRows.filter((row) => (ageDays(readyAt(row)) || 0) >= 3).length;
  const held7 = readyRows.filter((row) => (ageDays(readyAt(row)) || 0) >= 7).length;
  const openCaping = rows.filter((row) => !capeReady(row.caping_status) && !isCalled(row.caping_status)).length;

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div className="app-kicker">Season Command Center</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 34px)' }}>Cape Watch</h1>
            <div className="app-copy">
              Cape orders that still need cape work, customer contact, or pickup follow-up.
            </div>
          </div>
          <Link href="/reports/called?track=cape" className="btn" style={{ textDecoration: 'none' }}>Open Pickup Queue</Link>
        </div>
      </section>

      {error ? <div className="err">Load failed: {String(error.message || error)}</div> : null}

      <section className="watch-kpis">
        {[
          { label: 'Cape Orders Open', value: rows.length },
          { label: 'Need Cape Work', value: openCaping },
          { label: 'Need Contact', value: needsContact },
          { label: 'Finished 3+ Days', value: held3 },
          { label: 'Finished 7+ Days', value: held7 },
        ].map((item) => (
          <div key={item.label} className="watch-card">
            <div className="watch-label">{item.label}</div>
            <div className="watch-value">{item.value}</div>
          </div>
        ))}
      </section>

      {!rows.length ? (
        <div className="empty">
          <div className="empty-title">No capes are waiting right now.</div>
          <div className="empty-copy">Cape orders will show here until their cape pickup is recorded.</div>
        </div>
      ) : (
        <div className="app-surface-light" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ background: '#f3f6f9', color: '#0f172a', textAlign: 'left' }}>
                  <th style={{ padding: 12 }}>Age</th>
                  <th style={{ padding: 12 }}>Stage</th>
                  <th style={{ padding: 12 }}>Customer</th>
                  <th style={{ padding: 12 }}>Contact</th>
                  <th style={{ padding: 12 }}>Cape Status</th>
                  <th style={{ padding: 12 }}>Ready Basis</th>
                  <th style={{ padding: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isReady = capeReady(row.caping_status) || isCalled(row.caping_status);
                  const age = isReady ? readyAt(row) : firstDate(row.dropoff_date, row.created_at);
                  const days = ageDays(age) || 0;
                  return (
                    <tr key={row.id} style={{ borderTop: '1px solid #e5e7eb', background: idx % 2 ? '#fbfdff' : '#fff' }}>
                      <td style={{ padding: 12, fontWeight: 950, color: isReady && days >= 7 ? '#b91c1c' : isReady && days >= 3 ? '#9a3412' : '#0f172a' }}>
                        {ageText(age)}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span className={`stage ${isReady && !contacted(row) ? 'warn' : isReady ? 'ready' : ''}`}>{stage(row)}</span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 900 }}>{row.customer_name || 'Unknown customer'}</div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                          Tag {row.tag || '-'} | Confirmation {row.confirmation || '-'} | Drop-off {formatDisplayDate(row.dropoff_date)}
                        </div>
                      </td>
                      <td style={{ padding: 12 }}>{contactPref(row)}</td>
                      <td style={{ padding: 12 }}>{row.caping_status || '-'}</td>
                      <td style={{ padding: 12 }}>{isReady ? formatDisplayDateTime(age) : 'Not finished yet'}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link className="btn small" href={`/search?q=${encodeURIComponent(row.tag || row.confirmation || '')}`} style={{ textDecoration: 'none' }}>Search</Link>
                          {isReady ? (
                            <Link className="btn secondary small" href="/reports/called?track=cape" style={{ textDecoration: 'none' }}>Pickup</Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .watch-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .watch-card {
          border: 1px solid rgba(154, 116, 60, 0.18);
          border-radius: 16px;
          padding: 16px;
          background: rgba(14, 13, 12, 0.88);
          color: #f8fafc;
        }
        .watch-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .watch-value {
          font-size: 30px;
          font-weight: 950;
          margin-top: 6px;
        }
        .stage {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: #eef2ff;
          color: #3730a3;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }
        .stage.ready {
          background: #ecfdf5;
          color: #166534;
        }
        .stage.warn {
          background: #fffbeb;
          color: #92400e;
        }
      `}</style>
    </main>
  );
}
