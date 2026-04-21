import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getStaffProcessorContext, isPlatformAdmin } from '@/lib/staffContext';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OwnerInsightRow = {
  id: string;
  tag: string | null;
  confirmation: string | null;
  customer_name: string | null;
  phone: string | null;
  status: string | null;
  dropoff_date: string | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  picked_up_processing: boolean | null;
  picked_up_processing_at: string | null;
};

type InsightPolicySettings = {
  storageFeeStartsAfterDays: number;
  storageFeePolicy: string;
};

function diffHours(a: string | null | undefined, b: string | null | undefined) {
  const start = new Date(String(a || ''));
  const end = new Date(String(b || ''));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hours >= 0 ? hours : null;
}

function diffDays(a: string | null | undefined, b: string | null | undefined) {
  const hours = diffHours(a, b);
  return hours == null ? null : hours / 24;
}

function fmtDate(v: string | null | undefined) {
  return formatDisplayDateTime(v);
}

function fmtHours(v: number | null | undefined) {
  return typeof v === 'number' ? `${v.toFixed(1)} hr` : '-';
}

function fmtDays(v: number | null | undefined) {
  return typeof v === 'number' ? `${v.toFixed(1)} d` : '-';
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cardStyle(accent: string): React.CSSProperties {
  return {
    border: `1px solid ${accent}`,
    borderRadius: 16,
    padding: 16,
    background: 'rgba(14,13,12,.88)',
  };
}

export default async function OwnerInsightsPage() {
  const processor = await getStaffProcessorContext();
  const platformAdmin = await isPlatformAdmin();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <main style={{ maxWidth: 1160, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          Missing Supabase environment variables.
        </div>
      </main>
    );
  }

  if (!platformAdmin && processor.role !== 'admin') {
    return (
      <main style={{ maxWidth: 1160, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Owner Insights</h1>
          <div style={{ color: '#475569' }}>
            Processor admin access is required to review longer-term processing speed and ready-for-pickup aging.
          </div>
        </div>
      </main>
    );
  }

  if (!processor.id) {
    return (
      <main style={{ maxWidth: 1160, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Owner Insights</h1>
          <div style={{ color: '#475569' }}>
            The current processor could not be resolved for this session, so owner insights are not available yet.
          </div>
        </div>
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: settingsRow } = await supabase
    .from('site_settings')
    .select('public_copy')
    .eq('processor_id', processor.id)
    .maybeSingle();
  const { data, error } = await supabase
    .from('jobs')
    .select('id,tag,confirmation,customer_name,phone,status,dropoff_date,processing_started_at,processing_finished_at,picked_up_processing,picked_up_processing_at')
    .eq('processor_id', processor.id)
    .limit(2500);

  const rows = (data || []) as OwnerInsightRow[];
  const policy = {
    storageFeeStartsAfterDays: Math.max(0, Number((settingsRow as any)?.public_copy?.storageFeeStartsAfterDays || 0) || 0),
    storageFeePolicy: String((settingsRow as any)?.public_copy?.storageFeePolicy || '').trim(),
  } as InsightPolicySettings;
  const nowIso = new Date().toISOString();

  const slowestProcessing = rows
    .map((row) => ({
      ...row,
      processingHours: diffHours(row.processing_started_at, row.processing_finished_at),
    }))
    .filter((row): row is OwnerInsightRow & { processingHours: number } => typeof row.processingHours === 'number')
    .sort((a, b) => b.processingHours - a.processingHours)
    .slice(0, 20);

  const oldestReady = rows
    .filter((row) => row.status === 'Finished' && !row.picked_up_processing && row.processing_finished_at)
    .map((row) => ({
      ...row,
      readyDays: diffDays(row.processing_finished_at, nowIso),
    }))
    .filter((row): row is OwnerInsightRow & { readyDays: number } => typeof row.readyDays === 'number')
    .sort((a, b) => b.readyDays - a.readyDays)
    .slice(0, 20);

  const processingValues = slowestProcessing.map((row) => row.processingHours);
  const readyValues = oldestReady.map((row) => row.readyDays);
  const readyHeld3d = readyValues.filter((value) => value >= 3).length;
  const readyHeld7d = readyValues.filter((value) => value >= 7).length;
  const readyHeld14d = readyValues.filter((value) => value >= 14).length;
  const readyPastStorageThreshold = policy.storageFeeStartsAfterDays > 0
    ? readyValues.filter((value) => value >= policy.storageFeeStartsAfterDays).length
    : 0;

  return (
    <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
      <section
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
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Owner Insights</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 780, lineHeight: 1.5 }}>
          Use this page to spot slow-processing deer and orders that are ready for pickup but have been sitting too long for <strong>{processor.slug}</strong>.
        </div>
      </section>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>
          {String(error.message || error)}
        </div>
      ) : null}

      {policy.storageFeeStartsAfterDays > 0 ? (
        <section style={{ padding: 14, borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', display: 'grid', gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Ready-order hold watch is on</div>
          <div style={{ lineHeight: 1.5 }}>
            {readyPastStorageThreshold} finished deer have been waiting at least {policy.storageFeeStartsAfterDays} day{policy.storageFeeStartsAfterDays === 1 ? '' : 's'} for pickup.
            {policy.storageFeePolicy ? ` Policy on file: ${policy.storageFeePolicy}` : ''}
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={cardStyle('rgba(200,138,61,.18)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Avg Processing</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{fmtHours(avg(processingValues))}</div>
        </div>
        <div style={cardStyle('rgba(200,138,61,.18)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Median Processing</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{fmtHours(median(processingValues))}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Avg Ready Hold</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{fmtDays(avg(readyValues))}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Oldest Ready</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{fmtDays(readyValues.length ? Math.max(...readyValues) : null)}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Ready 3+ Days</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{readyHeld3d}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Ready 7+ Days</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{readyHeld7d}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Ready 14+ Days</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{readyHeld14d}</div>
        </div>
        {policy.storageFeeStartsAfterDays > 0 ? (
          <div style={cardStyle('rgba(154,52,18,.22)')}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>
              Ready {policy.storageFeeStartsAfterDays}+ Days
            </div>
            <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{readyPastStorageThreshold}</div>
          </div>
        ) : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Slowest Processing Deer</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Deer that spent the longest time between the first butcher scan into Processing and the scan that marked them Finished.
            </div>
          </div>
          {!slowestProcessing.length ? (
            <div style={{ padding: 16, color: '#64748b' }}>No finished processing timestamps yet.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {slowestProcessing.map((row, idx) => (
                <div
                  key={`slow-${row.id}`}
                  style={{
                    padding: 16,
                    display: 'grid',
                    gap: 8,
                    borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
                    background: idx % 2 ? '#fbfdff' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>
                        {row.customer_name || 'Unknown customer'}
                        {row.tag ? (
                          <span style={{ marginLeft: 8, color: '#9a3412', fontWeight: 800 }}>Tag {row.tag}</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 14, color: '#475569' }}>
                        Confirmation {row.confirmation || '-'}
                        {row.phone ? ` | ${row.phone}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <div style={{ fontSize: 22, fontWeight: 950, color: '#9a3412' }}>{fmtHours(row.processingHours)}</div>
                      {row.tag ? (
                        <Link href={`/intake/${encodeURIComponent(row.tag)}`} style={{ fontSize: 13, fontWeight: 800 }}>
                          Open Intake
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13 }}>
                    <span>Started: {fmtDate(row.processing_started_at)}</span>
                    <span>Finished: {fmtDate(row.processing_finished_at)}</span>
                    <span>Dropped off: {formatDisplayDate(row.dropoff_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Oldest Ready for Pickup</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Orders that are ready for pickup and still waiting on the customer, ranked by how long they have been sitting.
            </div>
          </div>
          {!oldestReady.length ? (
            <div style={{ padding: 16, color: '#64748b' }}>No ready-for-pickup deer are currently waiting on pickup. Once finished orders are saved without pickup completed, they will show here with their ready age.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {oldestReady.map((row, idx) => (
                <div
                  key={`ready-${row.id}`}
                  style={{
                    padding: 16,
                    display: 'grid',
                    gap: 8,
                    borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
                    background: idx % 2 ? '#fbfdff' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>
                        {row.customer_name || 'Unknown customer'}
                        {row.tag ? (
                          <span style={{ marginLeft: 8, color: '#166534', fontWeight: 800 }}>Tag {row.tag}</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 14, color: '#475569' }}>
                        Confirmation {row.confirmation || '-'}
                        {row.phone ? ` | ${row.phone}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <div style={{ fontSize: 22, fontWeight: 950, color: '#166534' }}>{fmtDays(row.readyDays)}</div>
                      {row.tag ? (
                        <Link href={`/intake/${encodeURIComponent(row.tag)}`} style={{ fontSize: 13, fontWeight: 800 }}>
                          Open Intake
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13 }}>
                    <span>Finished: {fmtDate(row.processing_finished_at)}</span>
                    <span>Current status: {row.status || '-'}</span>
                    <span>Pickup marked: {row.picked_up_processing_at ? fmtDate(row.picked_up_processing_at) : 'Not picked up'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

