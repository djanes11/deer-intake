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

function workAgeAt(row: Row) {
  return firstDate(row.dropoff_date, row.created_at);
}

function ageColor(value: string | null) {
  const days = ageDays(value) || 0;
  if (days >= 7) return '#b91c1c';
  if (days >= 3) return '#9a3412';
  return '#0f172a';
}

function sortOldestFirst<T extends Row>(input: T[], dateForRow: (row: T) => string | null) {
  return [...input].sort((a, b) => (ageDays(dateForRow(b)) || 0) - (ageDays(dateForRow(a)) || 0));
}

function CapeSection({
  title,
  description,
  rows,
  tone,
  ageLabel,
  dateLabel,
  dateForRow,
  nextStep,
  showContactAction = false,
  showPickupAction = false,
}: {
  title: string;
  description: string;
  rows: Row[];
  tone: 'work' | 'contact' | 'pickup';
  ageLabel: string;
  dateLabel: string;
  dateForRow: (row: Row) => string | null;
  nextStep: string;
  showContactAction?: boolean;
  showPickupAction?: boolean;
}) {
  return (
    <section className={`cape-section cape-section-${tone}`}>
      <div className="cape-section-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="cape-section-count">{rows.length}</div>
      </div>

      {!rows.length ? (
        <div className="cape-section-empty">Nothing in this bucket right now.</div>
      ) : (
        <div className="cape-table-wrap">
          <table className="cape-table">
            <thead>
              <tr>
                <th>{ageLabel}</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Cape Status</th>
                <th>{dateLabel}</th>
                <th>Next Step</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const ageAt = dateForRow(row);
                const searchValue = row.tag || row.confirmation || '';
                return (
                  <tr key={row.id} className={idx % 2 ? 'alt' : ''}>
                    <td className="age-cell" style={{ color: ageColor(ageAt) }}>{ageText(ageAt)}</td>
                    <td>
                      <div className="customer-name">{row.customer_name || 'Unknown customer'}</div>
                      <div className="row-meta">
                        Tag {row.tag || '-'} | Confirmation {row.confirmation || '-'} | Drop-off {formatDisplayDate(row.dropoff_date)}
                      </div>
                    </td>
                    <td>{contactPref(row)}</td>
                    <td><span className={`stage ${tone === 'contact' ? 'warn' : tone === 'pickup' ? 'ready' : ''}`}>{stage(row)}</span></td>
                    <td>{formatDisplayDateTime(ageAt)}</td>
                    <td className="next-step">{nextStep}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn small" href={`/search?q=${encodeURIComponent(searchValue)}`} style={{ textDecoration: 'none' }}>Search</Link>
                        {showContactAction ? (
                          <Link className="btn secondary small" href="/reports/contact-watch" style={{ textDecoration: 'none' }}>Contact</Link>
                        ) : null}
                        {showPickupAction ? (
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
      )}
    </section>
  );
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
  const workRows = sortOldestFirst(
    rows.filter((row) => !capeReady(row.caping_status) && !isCalled(row.caping_status)),
    workAgeAt,
  );
  const contactRows = sortOldestFirst(
    readyRows.filter((row) => !contacted(row)),
    readyAt,
  );
  const pickupRows = sortOldestFirst(
    readyRows.filter((row) => contacted(row)),
    readyAt,
  );
  const needsContact = contactRows.length;
  const held3 = readyRows.filter((row) => (ageDays(readyAt(row)) || 0) >= 3).length;
  const held7 = readyRows.filter((row) => (ageDays(readyAt(row)) || 0) >= 7).length;

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
          { label: 'Need Cape Work', value: workRows.length },
          { label: 'Contact Customer', value: needsContact },
          { label: 'Waiting Pickup', value: pickupRows.length },
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
        <div className="cape-sections">
          <CapeSection
            title="Needs Cape Work"
            description="Cape orders that are not marked finished yet."
            rows={workRows}
            tone="work"
            ageLabel="Since Drop-Off"
            dateLabel="Drop-Off"
            dateForRow={workAgeAt}
            nextStep="Finish cape work"
          />
          <CapeSection
            title="Contact Customer"
            description="Finished capes without a confirmed customer contact."
            rows={contactRows}
            tone="contact"
            ageLabel="Since Finished"
            dateLabel="Finished"
            dateForRow={readyAt}
            nextStep="Contact customer"
            showContactAction
          />
          <CapeSection
            title="Waiting For Pickup"
            description="Customer has been contacted, but the cape is still here."
            rows={pickupRows}
            tone="pickup"
            ageLabel="Since Contact"
            dateLabel="Contacted"
            dateForRow={readyAt}
            nextStep="Record cape pickup"
            showPickupAction
          />
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
        .cape-sections {
          display: grid;
          gap: 18px;
        }
        .cape-section {
          border: 1px solid #d7dee7;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }
        .cape-section-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 16px;
          border-top: 5px solid #64748b;
          background: #f8fafc;
        }
        .cape-section-work .cape-section-head {
          border-top-color: #475569;
        }
        .cape-section-contact .cape-section-head {
          border-top-color: #d97706;
          background: #fffbeb;
        }
        .cape-section-pickup .cape-section-head {
          border-top-color: #15803d;
          background: #f0fdf4;
        }
        .cape-section h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.2;
          color: #0f172a;
        }
        .cape-section p {
          margin: 5px 0 0;
          color: #475569;
          line-height: 1.4;
        }
        .cape-section-count {
          min-width: 52px;
          min-height: 52px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #0f172a;
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }
        .cape-section-empty {
          padding: 18px;
          color: #64748b;
          font-weight: 800;
        }
        .cape-table-wrap {
          overflow-x: auto;
        }
        .cape-table {
          width: 100%;
          min-width: 1040px;
          border-collapse: collapse;
        }
        .cape-table th {
          padding: 11px 12px;
          text-align: left;
          color: #334155;
          background: #f8fafc;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cape-table td {
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          color: #0f172a;
          vertical-align: top;
        }
        .cape-table tr.alt {
          background: #fbfdff;
        }
        .age-cell {
          font-weight: 950;
          white-space: nowrap;
        }
        .customer-name {
          font-weight: 900;
        }
        .row-meta {
          margin-top: 3px;
          color: #64748b;
          font-size: 13px;
        }
        .next-step {
          font-weight: 900;
          color: #334155;
        }
        .row-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
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
        @media (max-width: 720px) {
          .cape-section-head {
            align-items: flex-start;
          }
          .cape-section-count {
            min-width: 44px;
            min-height: 44px;
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  );
}
