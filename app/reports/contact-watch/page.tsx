import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getStaffProcessorContext } from '@/lib/staffContext';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { getPublicSiteSettings } from '@/lib/siteSettings';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Track = 'meat' | 'cape' | 'specialty' | 'webbs';

type Row = {
  id: string;
  tag: string | null;
  confirmation: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  caping_status: string | null;
  webbs_status: string | null;
  specialty_status: string | null;
  specialty_products: boolean | null;
  picked_up_processing: boolean | null;
  picked_up_cape: boolean | null;
  picked_up_webbs: boolean | null;
  finished_email_sent_at: string | null;
  meat_finished_sms_sent_at: string | null;
  cape_finished_email_sent_at: string | null;
  cape_finished_sms_sent_at: string | null;
  specialty_finished_email_sent_at: string | null;
  specialty_finished_sms_sent_at: string | null;
  webbs_delivered_email_sent_at: string | null;
  webbs_delivered_sms_sent_at: string | null;
  last_call_at: string | null;
  pref_email: boolean | null;
  pref_sms: boolean | null;
  pref_call: boolean | null;
  sms_consent: boolean | null;
  dropoff_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  processing_finished_at: string | null;
};

type WatchRow = {
  id: string;
  tag: string;
  customer: string;
  confirmation: string;
  phone: string;
  email: string;
  track: Track;
  trackLabel: string;
  status: string;
  readyAt: string | null;
  dropoffDate: string | null;
  contactMethod: string;
  contactDestination: string;
  reason: string;
  lastFailure?: string;
};

function lower(v: unknown) {
  return String(v || '').trim().toLowerCase();
}

function isCalled(v: unknown) {
  return lower(v) === 'called';
}

function readyLike(v: unknown) {
  const s = lower(v);
  return /finish|ready|complete|completed|done/.test(s);
}

function capeReady(v: unknown) {
  const s = lower(v);
  return /cape|caped|finish|ready|complete|completed|done/.test(s);
}

function webbsReady(v: unknown) {
  const s = lower(v);
  return /deliver|delivered|ready|complete|completed|done/.test(s);
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

function trackLabel(track: Track) {
  if (track === 'meat') return 'Meat';
  if (track === 'cape') return 'Cape';
  if (track === 'specialty') return 'Specialty';
  return 'Webbs';
}

function eventForTrack(track: Track) {
  if (track === 'meat') return 'meat_finished';
  if (track === 'cape') return 'cape_finished';
  if (track === 'specialty') return 'specialty_finished';
  return 'webbs_delivered';
}

function contactPreference(row: Row) {
  const phone = String(row.phone || '').trim();
  const email = String(row.email || '').trim();
  if (row.pref_sms && row.sms_consent && phone) return { method: 'Text', destination: phone };
  if (row.pref_email && email) return { method: 'Email', destination: email };
  if (row.pref_call && phone) return { method: 'Call', destination: phone };
  if (phone) return { method: 'Call', destination: phone };
  if (email) return { method: 'Email', destination: email };
  return { method: 'Missing', destination: 'No usable contact' };
}

function contacted(row: Row, track: Track) {
  if (track === 'meat') return isCalled(row.status) || !!row.finished_email_sent_at || !!row.meat_finished_sms_sent_at;
  if (track === 'cape') return isCalled(row.caping_status) || !!row.cape_finished_email_sent_at || !!row.cape_finished_sms_sent_at;
  if (track === 'specialty') return isCalled(row.specialty_status) || !!row.specialty_finished_email_sent_at || !!row.specialty_finished_sms_sent_at;
  return isCalled(row.webbs_status) || !!row.webbs_delivered_email_sent_at || !!row.webbs_delivered_sms_sent_at;
}

function readyAt(row: Row, track: Track) {
  if (track === 'meat') {
    return firstDate(row.processing_finished_at, row.finished_email_sent_at, row.meat_finished_sms_sent_at, row.updated_at, row.dropoff_date, row.created_at);
  }
  if (track === 'cape') {
    return firstDate(row.cape_finished_email_sent_at, row.cape_finished_sms_sent_at, row.last_call_at, row.updated_at, row.dropoff_date, row.created_at);
  }
  if (track === 'specialty') {
    return firstDate(row.specialty_finished_email_sent_at, row.specialty_finished_sms_sent_at, row.last_call_at, row.updated_at, row.dropoff_date, row.created_at);
  }
  return firstDate(row.webbs_delivered_email_sent_at, row.webbs_delivered_sms_sent_at, row.last_call_at, row.updated_at, row.dropoff_date, row.created_at);
}

function statusFor(row: Row, track: Track) {
  if (track === 'meat') return String(row.status || '');
  if (track === 'cape') return String(row.caping_status || '');
  if (track === 'specialty') return String(row.specialty_status || '');
  return String(row.webbs_status || '');
}

function buildWatchRows(rows: Row[], failures: Map<string, string>, webbsEnabled: boolean): WatchRow[] {
  const out: WatchRow[] = [];
  for (const row of rows) {
    const tracks: Track[] = [];
    if (readyLike(row.status) && !row.picked_up_processing) tracks.push('meat');
    if (capeReady(row.caping_status) && !row.picked_up_cape) tracks.push('cape');
    if (row.specialty_products && readyLike(row.specialty_status)) tracks.push('specialty');
    if (webbsEnabled && webbsReady(row.webbs_status) && !row.picked_up_webbs) tracks.push('webbs');

    for (const track of tracks) {
      if (contacted(row, track)) continue;
      const pref = contactPreference(row);
      const key = `${row.id}|${eventForTrack(track)}`;
      out.push({
        id: row.id,
        tag: String(row.tag || ''),
        customer: String(row.customer_name || 'Unknown customer'),
        confirmation: String(row.confirmation || '-'),
        phone: String(row.phone || ''),
        email: String(row.email || ''),
        track,
        trackLabel: trackLabel(track),
        status: statusFor(row, track) || 'Ready',
        readyAt: readyAt(row, track),
        dropoffDate: row.dropoff_date,
        contactMethod: pref.method,
        contactDestination: pref.destination,
        reason: pref.method === 'Missing' ? 'No usable contact on file' : `No confirmed ${pref.method.toLowerCase()} yet`,
        lastFailure: failures.get(key),
      });
    }
  }

  return out.sort((a, b) => (ageDays(b.readyAt) || 0) - (ageDays(a.readyAt) || 0));
}

export default async function ContactWatchPage() {
  const processor = await getStaffProcessorContext();
  const settings = await getPublicSiteSettings(undefined, processor).catch(() => null);
  const webbsEnabled = settings?.features?.webbsEnabled !== false;

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
  let jobsQuery = supabase
    .from('jobs')
    .select('id,tag,confirmation,customer_name,phone,email,status,caping_status,webbs_status,specialty_status,specialty_products,picked_up_processing,picked_up_cape,picked_up_webbs,finished_email_sent_at,meat_finished_sms_sent_at,cape_finished_email_sent_at,cape_finished_sms_sent_at,specialty_finished_email_sent_at,specialty_finished_sms_sent_at,webbs_delivered_email_sent_at,webbs_delivered_sms_sent_at,last_call_at,pref_email,pref_sms,pref_call,sms_consent,dropoff_date,created_at,updated_at,processing_finished_at')
    .is('pending_deleted_at', null)
    .limit(2500);

  let failuresQuery = supabase
    .from('sms_logs')
    .select('job_id,template,status,error_message,created_at')
    .not('error_code', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (processor.id) {
    jobsQuery = jobsQuery.eq('processor_id', processor.id);
    failuresQuery = failuresQuery.eq('processor_id', processor.id);
  }

  const [{ data: rows, error }, { data: failureRows }] = await Promise.all([
    jobsQuery,
    failuresQuery,
  ]);

  const failures = new Map<string, string>();
  for (const failure of failureRows || []) {
    const key = `${String((failure as any).job_id || '')}|${String((failure as any).template || '')}`;
    if (!key.startsWith('|') && !failures.has(key)) {
      failures.set(key, `${String((failure as any).status || 'failed')}: ${String((failure as any).error_message || 'Text did not send')}`);
    }
  }

  const watchRows = buildWatchRows((rows || []) as Row[], failures, webbsEnabled);
  const missingContact = watchRows.filter((row) => row.contactMethod === 'Missing').length;
  const failedText = watchRows.filter((row) => !!row.lastFailure).length;
  const old3 = watchRows.filter((row) => (ageDays(row.readyAt) || 0) >= 3).length;

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div className="app-kicker">Season Command Center</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 34px)' }}>Needs Contact</h1>
            <div className="app-copy">
              Ready meat, capes, specialty, and partner orders that do not have a confirmed customer contact yet.
            </div>
          </div>
          <Link href="/search" className="btn" style={{ textDecoration: 'none' }}>Open Search</Link>
        </div>
      </section>

      {error ? (
        <div className="err">Load failed: {String(error.message || error)}</div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'Need Contact', value: watchRows.length },
          { label: 'No Contact Info', value: missingContact },
          { label: 'Failed Texts', value: failedText },
          { label: 'Waiting 3+ Days', value: old3 },
        ].map((item) => (
          <div key={item.label} className="metric-card">
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
          </div>
        ))}
      </section>

      {!watchRows.length ? (
        <div className="empty">
          <div className="empty-title">No ready orders are missing customer contact.</div>
          <div className="empty-copy">When a ready item has no successful email, text, or called status, it will show here.</div>
        </div>
      ) : (
        <div className="app-surface-light" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ background: '#f3f6f9', color: '#0f172a', textAlign: 'left' }}>
                  <th style={{ padding: 12 }}>Waiting</th>
                  <th style={{ padding: 12 }}>Track</th>
                  <th style={{ padding: 12 }}>Customer</th>
                  <th style={{ padding: 12 }}>Contact</th>
                  <th style={{ padding: 12 }}>Reason</th>
                  <th style={{ padding: 12 }}>Ready</th>
                  <th style={{ padding: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchRows.map((row, idx) => (
                  <tr key={`${row.id}-${row.track}`} style={{ borderTop: '1px solid #e5e7eb', background: idx % 2 ? '#fbfdff' : '#fff' }}>
                    <td style={{ padding: 12, fontWeight: 950, color: (ageDays(row.readyAt) || 0) >= 3 ? '#9a3412' : '#0f172a' }}>{ageText(row.readyAt)}</td>
                    <td style={{ padding: 12 }}><span className="pill">{row.trackLabel}</span></td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 900 }}>{row.customer}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        Tag {row.tag || '-'} | Confirmation {row.confirmation} | Drop-off {formatDisplayDate(row.dropoffDate)}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 900 }}>{row.contactMethod}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{row.contactDestination}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div>{row.reason}</div>
                      {row.lastFailure ? <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 4 }}>{row.lastFailure}</div> : null}
                    </td>
                    <td style={{ padding: 12 }}>{formatDisplayDateTime(row.readyAt)}</td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link className="btn small" href={`/search?q=${encodeURIComponent(row.tag || row.confirmation)}`} style={{ textDecoration: 'none' }}>Search</Link>
                        {row.contactMethod === 'Call' ? (
                          <Link className="btn secondary small" href="/reports/calls" style={{ textDecoration: 'none' }}>Call Queue</Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .metric-card {
          border: 1px solid rgba(154, 116, 60, 0.18);
          border-radius: 16px;
          padding: 16px;
          background: rgba(14, 13, 12, 0.88);
          color: #f8fafc;
        }
        .metric-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #b7a98d;
        }
        .metric-value {
          font-size: 30px;
          font-weight: 950;
          margin-top: 6px;
        }
        .pill {
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
      `}</style>
    </main>
  );
}
