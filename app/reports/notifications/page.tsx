import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

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
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
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

export default async function NotificationActivityPage() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: 16 }}>
        <h2 style={{ margin: 0 }}>Notification Activity</h2>
        <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid #fdba74', background: '#fff7ed', color: '#9a3412', fontWeight: 800 }}>
          Missing Supabase environment variables.
        </div>
      </div>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const [{ data: jobRows, error: jobErr }, { data: smsRows, error: smsErr }] = await Promise.all([
    supabase
      .from('jobs')
      .select('tag,customer_name,email,dropoff_email_sent_at,finished_email_sent_at,cape_finished_email_sent_at,specialty_finished_email_sent_at,webbs_delivered_email_sent_at,updated_at')
      .or('dropoff_email_sent_at.not.is.null,finished_email_sent_at.not.is.null,cape_finished_email_sent_at.not.is.null,specialty_finished_email_sent_at.not.is.null,webbs_delivered_email_sent_at.not.is.null')
      .order('updated_at', { ascending: false })
      .limit(250),
    supabase
      .from('sms_logs')
      .select('created_at,phone,template,status,jobs(tag,customer_name)')
      .order('created_at', { ascending: false })
      .limit(250),
  ]);

  const activities = [...normalizeEmailActivities(jobRows || []), ...normalizeSmsActivities(smsRows || [])]
    .filter((row) => row.sentAt)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 200);

  const smsCount = activities.filter((row) => row.channel === 'sms').length;
  const emailCount = activities.filter((row) => row.channel === 'email').length;

  return (
    <div style={{ maxWidth: 1280, margin: '24px auto', padding: 16, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Notification Activity</h2>
          <div style={{ marginTop: 6, color: '#475569', fontWeight: 700, fontSize: 13 }}>
            Recent SMS and email notifications sent to customers.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: '#eef6ee', color: '#25603a', fontWeight: 800 }}>{smsCount} SMS</div>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: '#eef2ff', color: '#3730a3', fontWeight: 800 }}>{emailCount} Email</div>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: '#f8fafc', color: '#334155', fontWeight: 800 }}>{activities.length} Total</div>
        </div>
      </div>

      {jobErr || smsErr ? (
        <div style={{ padding: 12, borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 800 }}>
          Load failed: {String((jobErr as any)?.message || (smsErr as any)?.message || jobErr || smsErr)}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '170px 92px 170px minmax(180px,1.2fr) 120px minmax(180px,1fr) 120px', gap: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 900, color: '#0f172a' }}>
          <div style={{ padding: 12 }}>Sent</div>
          <div style={{ padding: 12 }}>Channel</div>
          <div style={{ padding: 12 }}>Event</div>
          <div style={{ padding: 12 }}>Customer</div>
          <div style={{ padding: 12 }}>Tag</div>
          <div style={{ padding: 12 }}>Destination</div>
          <div style={{ padding: 12 }}>Status</div>
        </div>

        {activities.length === 0 ? (
          <div style={{ padding: 16, color: '#475569' }}>No notification activity yet.</div>
        ) : activities.map((row, idx) => (
          <div
            key={`${row.channel}-${row.event}-${row.sentAt}-${idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '170px 92px 170px minmax(180px,1.2fr) 120px minmax(180px,1fr) 120px',
              gap: 0,
              borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
              background: idx % 2 ? '#fcfcfd' : '#fff',
            }}
          >
            <div style={{ padding: 12 }}>{fmtDate(row.sentAt)}</div>
            <div style={{ padding: 12 }}>
              <span style={{
                display: 'inline-flex',
                padding: '4px 8px',
                borderRadius: 999,
                background: row.channel === 'sms' ? '#ecfdf5' : '#eef2ff',
                color: row.channel === 'sms' ? '#166534' : '#3730a3',
                fontWeight: 800,
                fontSize: 12,
              }}>
                {row.channel.toUpperCase()}
              </span>
            </div>
            <div style={{ padding: 12, fontWeight: 700 }}>{row.event}</div>
            <div style={{ padding: 12 }}>{row.customer}</div>
            <div style={{ padding: 12, fontFamily: 'monospace', fontWeight: 700 }}>{row.tag || '-'}</div>
            <div style={{ padding: 12, wordBreak: 'break-word' }}>{row.destination || '-'}</div>
            <div style={{ padding: 12, fontWeight: 700, color: row.status === 'sent' || row.status === 'queued' ? '#166534' : '#92400e' }}>{row.status || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
