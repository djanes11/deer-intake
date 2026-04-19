import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';
import { getDefaultProcessorContext } from '@/lib/processorContext';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { formatDisplayDateTime } from '@/lib/dateFormat';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ActivityRow = {
  sentAt: string;
  channel: 'email' | 'sms';
  event: string;
  customer: string;
  tag: string;
  destination: string;
  status: string;
};

const EVENT_LABELS: Record<string, string> = {
  dropoff: 'Drop-Off Tagged',
  meat_finished: 'Meat Finished',
  cape_finished: 'Cape Finished',
  specialty_finished: 'Specialty Finished',
  webbs_delivered: 'Webbs Delivered',
  dropoff_tagged: 'Drop-Off Tagged',
};

function fmtDate(v: string) {
  return formatDisplayDateTime(v);
}

function normalizeEmailActivities(rows: any[]): ActivityRow[] {
  const out: ActivityRow[] = [];
  for (const row of rows || []) {
    const base = {
      customer: String(row.customer_name || 'Unknown Customer'),
      tag: String(row.tag || ''),
      destination: String(row.email || ''),
      channel: 'email' as const,
      status: 'sent',
    };

    if (row.dropoff_email_sent_at) out.push({ ...base, sentAt: row.dropoff_email_sent_at, event: 'Drop-Off Tagged' });
    if (row.finished_email_sent_at) out.push({ ...base, sentAt: row.finished_email_sent_at, event: 'Meat Finished' });
    if (row.cape_finished_email_sent_at) out.push({ ...base, sentAt: row.cape_finished_email_sent_at, event: 'Cape Finished' });
    if (row.specialty_finished_email_sent_at) out.push({ ...base, sentAt: row.specialty_finished_email_sent_at, event: 'Specialty Finished' });
    if (row.webbs_delivered_email_sent_at) out.push({ ...base, sentAt: row.webbs_delivered_email_sent_at, event: 'Webbs Delivered' });
  }
  return out;
}

function normalizeSmsActivities(rows: any[]): ActivityRow[] {
  return (rows || []).map((row) => ({
    sentAt: String(row.created_at || ''),
    channel: 'sms' as const,
    event: EVENT_LABELS[String(row.template || '').trim()] || String(row.template || 'SMS'),
    customer: String(row.jobs?.customer_name || 'Unknown Customer'),
    tag: String(row.jobs?.tag || ''),
    destination: String(row.phone || ''),
    status: String(row.status || ''),
  }));
}

function statusTone(status: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'sent' || s === 'queued' || s === 'delivered') {
    return { bg: '#ecfdf3', fg: '#166534', border: '#b7e4c7' };
  }
  return { bg: '#fff7ed', fg: '#9a3412', border: '#fed7aa' };
}

function displayStatus(status: string) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'queued') return 'sent to Twilio';
  return status || '-';
}

function channelTone(channel: 'email' | 'sms') {
  if (channel === 'sms') {
    return { bg: '#e8f7ec', fg: '#18603a' };
  }
  return { bg: '#eef2ff', fg: '#3730a3' };
}

export default async function NotificationActivityPage() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={{ maxWidth: 1240, margin: '24px auto', padding: 16 }}>
        <h2 style={{ margin: 0 }}>Notification Activity</h2>
        <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid #fdba74', background: '#fff7ed', color: '#9a3412', fontWeight: 800 }}>
          Missing Supabase environment variables.
        </div>
      </div>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const processor = await getDefaultProcessorContext();
  const settings = await getPublicSiteSettings().catch(() => null);
  const webbsEnabled = settings?.features?.webbsEnabled !== false;

  let jobsQuery = supabase
    .from('jobs')
    .select('tag,customer_name,email,dropoff_email_sent_at,finished_email_sent_at,cape_finished_email_sent_at,specialty_finished_email_sent_at,webbs_delivered_email_sent_at,updated_at')
    .or('dropoff_email_sent_at.not.is.null,finished_email_sent_at.not.is.null,cape_finished_email_sent_at.not.is.null,specialty_finished_email_sent_at.not.is.null,webbs_delivered_email_sent_at.not.is.null');

  let smsQuery = supabase
    .from('sms_logs')
    .select('created_at,phone,template,status,jobs(tag,customer_name)');

  if (processor.id) {
    jobsQuery = jobsQuery.eq('processor_id', processor.id);
    smsQuery = smsQuery.eq('processor_id', processor.id);
  }

  const [{ data: jobRows, error: jobErr }, { data: smsRows, error: smsErr }] = await Promise.all([
    jobsQuery.order('updated_at', { ascending: false }).limit(250),
    smsQuery.order('created_at', { ascending: false }).limit(250),
  ]);

  const activities = [...normalizeEmailActivities(jobRows || []), ...normalizeSmsActivities(smsRows || [])]
    .filter((row) => webbsEnabled || row.event !== 'Webbs Delivered')
    .filter((row) => row.sentAt)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 200);

  const smsCount = activities.filter((row) => row.channel === 'sms').length;
  const emailCount = activities.filter((row) => row.channel === 'email').length;

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div className="app-kicker">Communication</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 34px)' }}>Notification Activity</h1>
            <div className="app-copy">
              Review recent text and email sends so staff can quickly confirm what went out to customers and when.
            </div>
          </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 14px', borderRadius: 999, background: '#e8f7ec', color: '#18603a', fontWeight: 900 }}>{smsCount} SMS</div>
          <div style={{ padding: '8px 14px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontWeight: 900 }}>{emailCount} Email</div>
          <div style={{ padding: '8px 14px', borderRadius: 999, background: '#f8fafc', color: '#334155', fontWeight: 900 }}>{activities.length} Total</div>
        </div>
        </div>
      </section>

      {jobErr || smsErr ? (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 800 }}>
          Load failed: {String((jobErr as any)?.message || (smsErr as any)?.message || jobErr || smsErr)}
        </div>
      ) : null}

      <div className="app-surface-light" style={{ borderRadius: 16, overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '190px 92px 170px minmax(180px,1.2fr) 100px minmax(190px,1fr) 120px',
              gap: 0,
              background: '#f3f6f9',
              borderBottom: '1px solid #dbe4ee',
              fontWeight: 900,
              color: '#0f172a',
              minWidth: 980,
            }}
          >
            <div style={{ padding: 12 }}>Sent</div>
            <div style={{ padding: 12 }}>Channel</div>
            <div style={{ padding: 12 }}>Event</div>
            <div style={{ padding: 12 }}>Customer</div>
            <div style={{ padding: 12 }}>Tag</div>
            <div style={{ padding: 12 }}>Destination</div>
            <div style={{ padding: 12 }}>Status</div>
          </div>

          {activities.length === 0 ? (
            <div style={{ padding: 16, color: '#475569', lineHeight: 1.55 }}>
              No notification activity yet. Email and text updates will appear here after staff send messages manually or the workflow sends ready and status notices.
            </div>
          ) : activities.map((row, idx) => {
            const tone = statusTone(row.status);
            const shownStatus = displayStatus(row.status);
            const chan = channelTone(row.channel);
            return (
              <div
                key={`${row.channel}-${row.event}-${row.sentAt}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '190px 92px 170px minmax(180px,1.2fr) 100px minmax(190px,1fr) 120px',
                  gap: 0,
                  borderTop: idx === 0 ? '0' : '1px solid #edf2f7',
                  background: idx % 2 ? '#fafcfe' : '#ffffff',
                  color: '#0f172a',
                  minWidth: 980,
                }}
              >
                <div style={{ padding: 12, color: '#334155', fontWeight: 600 }}>{fmtDate(row.sentAt)}</div>
                <div style={{ padding: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 9px',
                      borderRadius: 999,
                      background: chan.bg,
                      color: chan.fg,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {row.channel.toUpperCase()}
                  </span>
                </div>
                <div style={{ padding: 12, fontWeight: 800, color: '#1e293b' }}>{row.event}</div>
                <div style={{ padding: 12, color: '#0f172a', fontWeight: 700 }}>{row.customer}</div>
                <div style={{ padding: 12, fontFamily: 'monospace', fontWeight: 800, color: '#475569' }}>{row.tag || '-'}</div>
                <div style={{ padding: 12, wordBreak: 'break-word', color: '#334155', fontWeight: 600 }}>{row.destination || '-'}</div>
                <div style={{ padding: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 9px',
                      borderRadius: 999,
                      background: tone.bg,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                      fontWeight: 900,
                    }}
                  >
                    {shownStatus}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
