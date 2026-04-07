export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import 'server-only';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getStaffIdentity, isPlatformAdmin } from '@/lib/staffContext';

type ProcessorSummary = {
  id: string;
  slug: string;
  name: string;
  publicName: string;
  active: boolean;
  publicHostname: string;
  staffHostname: string;
  plan: 'basic' | 'texting' | 'custom';
  smsEnabled: boolean;
  webbsEnabled: boolean;
  billingStatus: 'setup' | 'trial' | 'active' | 'past_due' | 'paused' | 'internal';
  billingCycle: 'monthly' | 'seasonal' | 'annual' | 'custom';
  monthlyPrice: number | null;
  trialEndsAt?: string | null;
  goLiveAt?: string | null;
  setupCompletedAt?: string | null;
};

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizePlan(raw: any): ProcessorSummary['plan'] {
  return raw === 'texting' || raw === 'custom' ? raw : 'basic';
}

function normalizeBillingStatus(raw: any): ProcessorSummary['billingStatus'] {
  return ['setup', 'trial', 'active', 'past_due', 'paused', 'internal'].includes(String(raw || ''))
    ? (String(raw) as ProcessorSummary['billingStatus'])
    : 'setup';
}

function estimatedMrrFor(row: ProcessorSummary) {
  if (row.monthlyPrice == null) return 0;
  if (row.billingStatus !== 'active') return 0;
  return row.billingCycle === 'monthly' ? row.monthlyPrice : 0;
}

async function loadAdminDashboard() {
  const supabase = getSupabase();

  const [{ data: processors, error: processorsError }, { count: staffCount, error: staffError }, { count: recentIntakes, error: jobsError }] =
    await Promise.all([
      supabase
        .from('processors')
        .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,billing_status,billing_cycle,monthly_price,trial_ends_at,go_live_at,setup_completed_at')
        .order('slug', { ascending: true }),
      supabase
        .from('processor_users')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .is('pending_deleted_at', null),
    ]);

  if (processorsError) throw processorsError;
  if (staffError) throw staffError;
  if (jobsError) throw jobsError;

  const rows: ProcessorSummary[] = (processors || []).map((row: any) => {
    const rawFeatures = row?.features || {};
    return {
      id: String(row.id),
      slug: String(row.slug || ''),
      name: String(row.name || ''),
      publicName: String(row.public_name || row.name || ''),
      active: !!row.active,
      publicHostname: String(row.public_hostname || ''),
      staffHostname: String(row.staff_hostname || ''),
      plan: normalizePlan(rawFeatures.plan),
      smsEnabled: rawFeatures.smsEnabled !== false,
      webbsEnabled: rawFeatures.webbsEnabled !== false,
      billingStatus: normalizeBillingStatus(row.billing_status),
      billingCycle: ['monthly', 'seasonal', 'annual', 'custom'].includes(String(row.billing_cycle || ''))
        ? (String(row.billing_cycle) as ProcessorSummary['billingCycle'])
        : 'monthly',
      monthlyPrice: row.monthly_price == null ? null : Number(row.monthly_price),
      trialEndsAt: row.trial_ends_at || null,
      goLiveAt: row.go_live_at || null,
      setupCompletedAt: row.setup_completed_at || null,
    };
  });

  const activeProcessors = rows.filter((row) => row.active).length;
  const planMix = rows.reduce(
    (acc, row) => {
      acc[row.plan] += 1;
      return acc;
    },
    { basic: 0, texting: 0, custom: 0 } as Record<ProcessorSummary['plan'], number>
  );

  const billingMix = rows.reduce(
    (acc, row) => {
      acc[row.billingStatus] += 1;
      return acc;
    },
    { setup: 0, trial: 0, active: 0, past_due: 0, paused: 0, internal: 0 } as Record<ProcessorSummary['billingStatus'], number>
  );

  const estimatedMrr = rows.reduce((sum, row) => sum + estimatedMrrFor(row), 0);
  const now = Date.now();
  const trialExpiring = rows
    .filter((row) => row.billingStatus === 'trial' && row.trialEndsAt)
    .map((row) => ({
      ...row,
      daysLeft: Math.ceil((new Date(String(row.trialEndsAt)).getTime() - now) / (24 * 60 * 60 * 1000)),
    }))
    .filter((row) => row.daysLeft >= 0 && row.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const pastDue = rows.filter((row) => row.billingStatus === 'past_due');
  const readyToTrial = rows.filter((row) => row.billingStatus === 'setup' && !!row.setupCompletedAt);

  return {
    processors: rows,
    totalProcessors: rows.length,
    activeProcessors,
    staffUsers: staffCount || 0,
    recentIntakes: recentIntakes || 0,
    planMix,
    billingMix,
    estimatedMrr,
    trialExpiring,
    pastDue,
    readyToTrial,
  };
}

export default async function PlatformAdminHome() {
  const identity = await getStaffIdentity();
  if (identity.authType === 'none') {
    redirect('/staff/login?next=/admin');
  }

  if (!(await isPlatformAdmin())) {
    return (
      <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px' }}>
        <div style={{ border: '1px solid #fecaca', borderRadius: 18, padding: 24, background: '#fff7f7', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#b91c1c' }}>
            Platform Admin
          </div>
          <h1 style={{ margin: 0, fontSize: 30, color: '#7f1d1d' }}>Access Required</h1>
          <p style={{ margin: 0, color: '#7f1d1d', lineHeight: 1.6 }}>
            This subdomain is reserved for Wild Game Butcher Board platform admins. Your staff account is signed in, but it does not have platform-level access.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/staff/logout" style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 12, background: '#991b1b', color: '#fff', fontWeight: 900 }}>
              Sign Out
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const dashboard = await loadAdminDashboard();

  const shell: React.CSSProperties = {
    maxWidth: 1180,
    margin: '24px auto',
    padding: '0 16px 40px',
    display: 'grid',
    gap: 16,
  };

  const hero: React.CSSProperties = {
    padding: '22px 24px',
    borderRadius: 20,
    background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    color: '#f8fafc',
    border: '1px solid #334155',
  };

  const statsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  };

  const statCard: React.CSSProperties = {
    border: '1px solid #d6dee8',
    borderRadius: 16,
    padding: 16,
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  };

  const panel: React.CSSProperties = {
    border: '1px solid #d6dee8',
    borderRadius: 16,
    padding: 18,
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    display: 'grid',
    gap: 14,
  };

  const quickLink: React.CSSProperties = {
    display: 'block',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #d6dee8',
    background: '#f8fafc',
    textDecoration: 'none',
    color: '#0f172a',
    fontWeight: 800,
  };

  const processorGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  };

  const badge = (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontWeight: 800,
    fontSize: 12,
  });

  return (
    <main style={shell}>
      <section style={hero}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#cbd5e1' }}>
          Platform Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 34, lineHeight: 1.05 }}>Wild Game Butcher Board</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.55 }}>
          Platform-wide view of processors, plan tiers, staffing, and recent intake activity. This is the home base for SaaS management, not shop-level operations.
        </div>
      </section>

      <section style={statsGrid} aria-label="Platform overview">
        {[
          { label: 'Processors', value: dashboard.totalProcessors },
          { label: 'Active Processors', value: dashboard.activeProcessors },
          { label: 'Staff Memberships', value: dashboard.staffUsers },
          { label: 'Intakes (Last 7 Days)', value: dashboard.recentIntakes },
          { label: 'Estimated MRR', value: `$${dashboard.estimatedMrr.toFixed(0)}` },
        ].map((item) => (
          <div key={item.label} style={statCard}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 34, fontWeight: 950, color: '#0f172a', marginTop: 6 }}>{item.value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16 }}>
        <div style={panel}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Link href="/admin/processors" style={quickLink}>
              Processor Management
              <div style={{ color: '#475569', fontWeight: 500, marginTop: 4 }}>
                Edit plan tiers, feature flags, and hostnames.
              </div>
            </Link>
            <Link href="/admin/users" style={quickLink}>
              Staff Users
              <div style={{ color: '#475569', fontWeight: 500, marginTop: 4 }}>
                Create staff logins and manage processor memberships.
              </div>
            </Link>
            <Link href="/admin/settings" style={quickLink}>
              Current Processor Settings
              <div style={{ color: '#475569', fontWeight: 500, marginTop: 4 }}>
                Open the shop-level settings page for your current membership.
              </div>
            </Link>
            <Link href="/admin/health" style={quickLink}>
              Admin Health
              <div style={{ color: '#475569', fontWeight: 500, marginTop: 4 }}>
                Check platform environment and background integration status.
              </div>
            </Link>
            <Link href="/" style={quickLink}>
              Back to Staff Dashboard
              <div style={{ color: '#475569', fontWeight: 500, marginTop: 4 }}>
                Return to day-to-day shop operations for your current processor.
              </div>
            </Link>
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Plan Mix</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>Basic</span>
              <strong>{dashboard.planMix.basic}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>Texting</span>
              <strong>{dashboard.planMix.texting}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>Custom</span>
              <strong>{dashboard.planMix.custom}</strong>
            </div>
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Billing Mix</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Setup</span><strong>{dashboard.billingMix.setup}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Trial</span><strong>{dashboard.billingMix.trial}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Active</span><strong>{dashboard.billingMix.active}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Past Due</span><strong>{dashboard.billingMix.past_due}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Paused</span><strong>{dashboard.billingMix.paused}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Internal</span><strong>{dashboard.billingMix.internal}</strong></div>
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Trial Follow-up</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {dashboard.trialExpiring.length ? (
              dashboard.trialExpiring.slice(0, 6).map((processor) => (
                <div key={processor.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{processor.publicName}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      Ends {processor.trialEndsAt ? new Date(processor.trialEndsAt).toLocaleDateString() : '-'}
                    </div>
                  </div>
                  <strong style={{ color: processor.daysLeft <= 2 ? '#b91c1c' : '#9a3412' }}>
                    {processor.daysLeft === 0 ? 'Today' : `${processor.daysLeft}d`}
                  </strong>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b' }}>No trials expiring in the next 7 days.</div>
            )}
          </div>
        </div>

        <div style={panel}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Billing Attention</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {dashboard.pastDue.length ? (
              dashboard.pastDue.slice(0, 6).map((processor) => (
                <div key={processor.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{processor.publicName}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {processor.monthlyPrice != null ? `$${processor.monthlyPrice.toFixed(2)}/${processor.billingCycle}` : 'Pricing not set'}
                    </div>
                  </div>
                  <span style={{ color: '#991b1b', fontWeight: 900 }}>Past due</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b' }}>No processors are marked past due right now.</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ ...panel, gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Lifecycle Nudges</div>
            <div style={{ color: '#475569', marginTop: 4 }}>
              Processors that are clearly through setup and ready for the next billing step.
            </div>
          </div>
          <Link href="/admin/processors" style={{ ...quickLink, padding: '10px 14px', fontWeight: 900 }}>
            Open Processor Management
          </Link>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {dashboard.readyToTrial.length ? (
            dashboard.readyToTrial.slice(0, 6).map((processor) => (
              <div key={processor.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{processor.publicName}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>
                    Setup completed {processor.setupCompletedAt ? new Date(processor.setupCompletedAt).toLocaleDateString() : '-'}
                  </div>
                </div>
                <span style={{ color: '#9a3412', fontWeight: 900 }}>Ready for trial review</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#64748b' }}>No processors are waiting on setup-to-trial review.</div>
          )}
        </div>
      </section>

      <section style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Processors</div>
            <div style={{ color: '#475569', marginTop: 4 }}>
              Snapshot of each processor’s plan and routing setup.
            </div>
          </div>
          <Link href="/admin/processors" style={{ ...quickLink, padding: '10px 14px', fontWeight: 900 }}>
            Open Full Management
          </Link>
        </div>

        <div style={processorGrid}>
          {dashboard.processors.map((processor) => (
            <article key={processor.id} style={{ border: '1px solid #d6dee8', borderRadius: 16, padding: 16, background: '#f8fafc', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>{processor.publicName || processor.name}</div>
                  <div style={{ color: '#64748b', marginTop: 4 }}>
                    <code>{processor.slug}</code>
                  </div>
                </div>
                <span style={processor.active ? badge('#dcfce7', '#166534') : badge('#fee2e2', '#991b1b')}>
                  {processor.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={badge('#e2e8f0', '#0f172a')}>{processor.plan}</span>
                <span style={badge('#fff7ed', '#9a3412')}>{processor.billingStatus.replace('_', ' ')}</span>
                <span style={processor.smsEnabled ? badge('#dbeafe', '#1d4ed8') : badge('#e5e7eb', '#4b5563')}>
                  SMS {processor.smsEnabled ? 'on' : 'off'}
                </span>
                <span style={processor.webbsEnabled ? badge('#ede9fe', '#6d28d9') : badge('#e5e7eb', '#4b5563')}>
                  Webbs {processor.webbsEnabled ? 'on' : 'off'}
                </span>
              </div>

              <div style={{ fontSize: 14, color: '#334155', display: 'grid', gap: 6 }}>
                <div><strong>Public:</strong> {processor.publicHostname || '-'}</div>
                <div><strong>Staff:</strong> {processor.staffHostname || '-'}</div>
                <div><strong>Billing:</strong> {processor.monthlyPrice != null ? `$${processor.monthlyPrice.toFixed(2)}/${processor.billingCycle}` : '-'}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
