// app/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { getDashboardSummary } from '@/lib/jobsSupabase';
import { getStaffIdentity, getStaffProcessorContext } from '@/lib/staffContext';
import { filterVisibleAddOnItems } from '@/lib/processorCatalog';
import ProcessorInquiryForm from '@/app/components/ProcessorInquiryForm';

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';
const ADMIN_HOSTNAME = (process.env.ADMIN_HOSTNAME || 'admin.wildgamebutcherboard.com').trim().toLowerCase();
const MARKETING_HOSTNAMES = new Set(
  String(process.env.MARKETING_HOSTNAMES || 'wildgamebutcherboard.com,www.wildgamebutcherboard.com')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeHost(input: string | null | undefined) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .split(',')[0]
    ?.split(':')[0] || '';
}

export default async function Home() {
  let requestHost = '';
  try {
    const h = await headers();
    requestHost = normalizeHost(h.get('x-forwarded-host') || h.get('host') || '');
  } catch {
    requestHost = '';
  }

  if (!IS_PUBLIC) {
    if (requestHost === ADMIN_HOSTNAME) {
      redirect('/admin');
    }

    const identity = await getStaffIdentity();
    if (identity.authType === 'none') {
      redirect('/staff/login?next=/');
    }
    if (identity.mustChangePassword) {
      redirect('/staff/account?next=/&force=1');
    }
  }

  if (IS_PUBLIC && MARKETING_HOSTNAMES.has(requestHost)) {
    return <MarketingLanding />;
  }

  const settings = await getPublicSiteSettings();
  const dashboard = IS_PUBLIC ? null : await getDashboardSummary().catch(() => null);
  const staffContext = IS_PUBLIC ? null : await getStaffProcessorContext().catch(() => null);
  return IS_PUBLIC ? (
    <PublicLanding settings={settings} />
  ) : (
    <StaffHome dashboard={dashboard} processorName={settings.branding.name} role={staffContext?.role || null} />
  );
}

function MarketingLanding() {
  const shell: React.CSSProperties = {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '0 16px 52px',
    color: '#f5ecd8',
  };
  const panel: React.CSSProperties = {
    borderRadius: 22,
    border: '1px solid rgba(200,138,61,.16)',
    background:
      'radial-gradient(circle at top right, rgba(200,138,61,.14) 0%, transparent 34%), linear-gradient(180deg, rgba(21,20,19,.97) 0%, rgba(12,11,10,.99) 100%)',
    boxShadow: '0 24px 50px rgba(0,0,0,.24)',
  };
  const sectionCard: React.CSSProperties = {
    borderRadius: 18,
    border: '1px solid rgba(200,138,61,.12)',
    background: 'rgba(21,20,19,.95)',
    padding: 18,
  };
  const eyebrow: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#d2b27d',
  };
  const cta = (primary = false): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 16px',
    borderRadius: 14,
    textDecoration: 'none',
    fontWeight: 900,
    fontSize: 16,
    minHeight: 48,
    color: primary ? '#16120f' : '#f5ecd8',
    background: primary ? '#d29a45' : 'rgba(21,20,19,.92)',
    border: primary ? '1px solid transparent' : '1px solid rgba(200,138,61,.18)',
  });

  const workflowSteps = [
    {
      title: 'Public intake before drop-off',
      body: 'Customers submit deer details, cuts, specialty products, and add-ons from their phone before they ever walk in.',
    },
    {
      title: 'Staff review and tag assignment',
      body: 'Staff review public intake, assign the permanent tag, and print one-page intake sheets or thermal labels right away.',
    },
    {
      title: 'Scan-driven production',
      body: 'Cape, processing, and finished status can move with simple barcode scans instead of sticky notes and memory.',
    },
    {
      title: 'Pickup, balances, and owner reports',
      body: 'Owners can see who is ready, who still owes, how long deer sit before pickup, and how long processing is taking.',
    },
  ];

  const featureGroups = [
    {
      title: 'Customer Experience',
      items: [
        'After-hours public intake',
        'Status lookup by confirmation',
        'Text and email updates',
        'Clear hours, contact, and pickup expectations',
      ],
    },
    {
      title: 'Staff Workflow',
      items: [
        'Fast intake and search',
        'Thermal labels and intake printing',
        'Scan-based production workflow',
        'Separate staff roles and logins',
      ],
    },
    {
      title: 'Owner Control',
      items: [
        'Balances and ready-but-unpaid tracking',
        'Processing-time and holding-time insights',
        'Pickup and communication reports',
        'Activity history for accountability',
      ],
    },
    {
      title: 'Processor Customization',
      items: [
        'Custom process types',
        'Custom add-ons and specialty catalog',
        'Branding, pricing, and public copy',
        'Cut-option visibility by processor',
      ],
    },
  ];

  const workflowSnapshots = [
    { title: 'Public intake on mobile', body: 'Customers can complete intake from the truck, include cut details, and arrive with a confirmation number already in the system.' },
    { title: 'Staff dashboard and search', body: 'Quick access to intake, search, print, queues, and owner reporting without jumping between notebooks, texts, and spreadsheets.' },
    { title: 'Scan + label production floor flow', body: 'Tag barcodes, butcher overlays, and thermal labels keep the deer moving and reduce handwriting mistakes on the floor.' },
  ];

  return (
    <main style={shell}>
      <section style={{ ...panel, marginTop: 12, padding: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 22, alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={eyebrow}>Deer Processing Software</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(36px, 7vw, 56px)', lineHeight: 1.02, fontWeight: 950, color: '#fff7e8' }}>
              Built for real processors, not generic inventory software.
            </h1>
            <div style={{ color: 'rgba(245,236,216,.84)', fontSize: 18, lineHeight: 1.6, maxWidth: 720 }}>
              Wild Game Butcher Board brings together public intake, staff workflow, scan-based production, thermal labels, customer communication, and owner reporting in one system.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#request-demo" style={cta(true)}>Request a Demo</a>
              <a href="#how-it-works" style={cta(false)}>See How It Works</a>
              <Link href="/staff/login" style={cta(false)}>Staff Login</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 6 }}>
              {[
                { label: 'After-hours drop-off', note: 'Customers arrive with intake already entered' },
                { label: 'Thermal labels + scanning', note: 'Faster floor workflow and clearer tag handling' },
                { label: 'Processor-specific setup', note: 'Process types, add-ons, specialty items, and pricing' },
              ].map((item) => (
                <div key={item.label} style={{ ...sectionCard, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#c88a3d' }}>{item.label}</div>
                  <div style={{ marginTop: 8, color: '#f5ecd8', lineHeight: 1.5 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...sectionCard, display: 'grid', gap: 14, alignSelf: 'stretch' }}>
            <div style={{ ...eyebrow, color: '#c88a3d' }}>Why processors care</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff7e8' }}>Replace paper, texts, and memory with one operational workflow.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                'Reduce handwritten mistakes at drop-off and on the butcher floor',
                'Customize products, pricing, and cut options for each processor',
                'Track pickup readiness, balances, and how long deer are sitting',
                'Give owners, staff, and read-only users the right level of access',
              ].map((item) => (
                <div key={item} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start', padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ width: 10, height: 10, marginTop: 6, borderRadius: 999, background: '#6a8f70' }} />
                  <div style={{ lineHeight: 1.55 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        <div style={eyebrow}>How It Works</div>
        <div style={{ fontSize: 32, fontWeight: 950, color: '#fff7e8' }}>A processor workflow from drop-off to pickup</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {workflowSteps.map((step, index) => (
            <div key={step.title} style={sectionCard}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c88a3d' }}>Step {index + 1}</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: '#fff7e8' }}>{step.title}</div>
              <div style={{ marginTop: 8, color: 'rgba(245,236,216,.82)', lineHeight: 1.55 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14, marginTop: 24 }}>
        <div style={eyebrow}>Feature Areas</div>
        <div style={{ fontSize: 32, fontWeight: 950, color: '#fff7e8' }}>Built around the way deer processors actually work</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
          {featureGroups.map((group) => (
            <div key={group.title} style={sectionCard}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff7e8' }}>{group.title}</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {group.items.map((item) => (
                  <div key={item} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start' }}>
                    <div style={{ width: 9, height: 9, marginTop: 7, borderRadius: 999, background: '#c88a3d' }} />
                    <div style={{ color: 'rgba(245,236,216,.82)', lineHeight: 1.5 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14, marginTop: 24 }}>
        <div style={eyebrow}>Workflow Snapshots</div>
        <div style={{ fontSize: 32, fontWeight: 950, color: '#fff7e8' }}>What processors can expect to run day to day</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {workflowSnapshots.map((item) => (
            <div key={item.title} style={{ ...sectionCard, minHeight: 210, display: 'grid', alignContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8fb3a8' }}>Example View</div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: '#fff7e8' }}>{item.title}</div>
                <div style={{ marginTop: 8, color: 'rgba(245,236,216,.82)', lineHeight: 1.55 }}>{item.body}</div>
              </div>
              <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: '#d2c4ad', fontSize: 14 }}>
                Best fit for demos: walk processors through how this replaces paper intake, whiteboards, and scattered customer texts.
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="request-demo" style={{ ...panel, marginTop: 26, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, .9fr) minmax(340px, 1.1fr)', gap: 22 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={eyebrow}>Request A Demo</div>
            <div style={{ fontSize: 34, fontWeight: 950, color: '#fff7e8', lineHeight: 1.08 }}>
              Tell us about your processor and we can prepare a demo or onboarding conversation around your workflow.
            </div>
            <div style={{ color: 'rgba(245,236,216,.82)', lineHeight: 1.6 }}>
              Use this form if you want to see the system, ask questions, or share what makes your shop different before getting set up.
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                'Share your annual deer volume and current workflow',
                'Tell us whether you use after-hours drop-off, labels, texting, or specialty products',
                'We can use that to shape a demo and onboarding plan',
              ].map((item) => (
                <div key={item} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start' }}>
                  <div style={{ width: 10, height: 10, marginTop: 7, borderRadius: 999, background: '#6a8f70' }} />
                  <div style={{ color: '#f5ecd8', lineHeight: 1.5 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.96)', borderRadius: 20, padding: 18, border: '1px solid rgba(200,138,61,.14)', boxShadow: '0 18px 36px rgba(15,23,42,.16)' }}>
            <ProcessorInquiryForm />
          </div>
        </div>
      </section>
    </main>
  );
}

function PublicLanding({ settings }: { settings: Awaited<ReturnType<typeof getPublicSiteSettings>> | null }) {
  const pricing = settings?.pricing;
  const branding = settings?.branding;
  const features = settings?.features;
  const hours = settings?.hours || [];
  const pricingRows = [
    ...((settings?.processCatalog || []).filter((item) => item.active).map((item) => ({
      label: item.name,
      value: Number(item.basePrice || 0),
      note: item.triggersCapeWorkflow ? 'Includes cape workflow' : item.donationOnly ? 'Donation option' : 'Base processing option',
    }))),
    ...(filterVisibleAddOnItems(
      (settings?.addOnCatalog || []).filter((item) => item.active),
      features?.webbsEnabled !== false,
    )
      .map((item) => ({
        label: item.name,
        value: Number(item.price || 0),
        note: 'Optional add-on',
        prefix: '+' as const,
      }))),
  ];
  const serviceHighlights = [
    {
      title: 'After-hours drop-off',
      body: 'Submit your intake online, leave your deer with your confirmation details, and staff will assign the permanent tag the next morning.',
    },
    {
      title: features?.smsEnabled ? 'Text or email updates' : 'Status updates online',
      body: features?.smsEnabled
        ? 'Choose how you want to hear from the processor when your order moves forward or is ready for pickup.'
        : 'Check your status online anytime and choose the best contact method this processor offers.',
    },
    {
      title: 'Clear pickup expectations',
      body: 'Customers can track progress, review hours, and pick up quickly once they are notified that the order is ready.',
    },
  ];
  const businessDetails = [
    branding?.locationLabel ? { label: 'Location', value: branding.locationLabel } : null,
    branding?.phoneDisplay ? { label: 'Phone', value: branding.phoneDisplay, href: branding.phoneE164 ? `tel:${branding.phoneE164}` : undefined } : null,
    branding?.email ? { label: 'Email', value: branding.email, href: `mailto:${branding.email}` } : null,
    branding?.address
      ? { label: 'Address', value: branding.address, href: branding.mapsUrl || undefined }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;
  const formatMoney = (value: number, prefix = '') => `${prefix}$${value.toFixed(2)}`;
  const colors = {
    bg: '#120f0d',
    panel: 'rgba(21,20,19,.96)',
    panelBorder: 'rgba(200,138,61,.14)',
    brand: '#c88a3d',
    text: '#f1e7cf',
    sub: 'rgba(241,231,207,.78)',
    accent: '#d7c3a0',
    tileBg: 'rgba(21,20,19,.96)',
    green: '#5b7a62',
  } as const;

  const shell: React.CSSProperties = {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 16px 48px',
    color: colors.text,
  };

  const hero: React.CSSProperties = {
    marginTop: 10,
    borderRadius: 16,
    background: 'radial-gradient(circle at top center, rgba(200,138,61,.16) 0%, transparent 36%), linear-gradient(180deg, rgba(33,25,21,1) 0%, rgba(16,13,11,1) 100%)',
    border: `1px solid ${colors.panelBorder}`,
    padding: 24,
  };
  const eyebrow: React.CSSProperties = {
    color: colors.brand,
    fontWeight: 800,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    fontSize: 12,
  };
  const title: React.CSSProperties = {
    margin: '6px 0 8px',
    fontSize: 'clamp(30px, 7vw, 40px)',
    lineHeight: 1.1,
    fontWeight: 900,
  };
  const subtitle: React.CSSProperties = { margin: '0 0 18px', color: colors.sub, maxWidth: 720 };
  const statGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginTop: 18,
  };
  const statCard: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 14,
    border: `1px solid ${colors.panelBorder}`,
    background: 'rgba(17,16,15,.88)',
  };
  const statTitle: React.CSSProperties = {
    color: colors.brand,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  };
  const statBody: React.CSSProperties = {
    marginTop: 6,
    color: colors.text,
    fontWeight: 800,
    lineHeight: 1.4,
  };

  const ctas: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 };
  const cta = (primary = false): React.CSSProperties => ({
    display: 'inline-block',
    padding: '12px 14px',
    borderRadius: 12,
    textDecoration: 'none',
    color: primary ? '#0b0f0d' : colors.text,
    background: primary ? colors.brand : colors.tileBg,
    border: primary ? '1px solid transparent' : `1px solid ${colors.panelBorder}`,
    fontWeight: 900,
    fontSize: 16,
    minHeight: 46,
  });

  const twoCol: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
    marginTop: 16,
  };
  const panel: React.CSSProperties = {
    background: colors.panel,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: 14,
    padding: 16,
  };
  const h3: React.CSSProperties = { fontWeight: 900, fontSize: 18, marginBottom: 8, color: colors.accent };
  const supportList: React.CSSProperties = {
    display: 'grid',
    gap: 10,
    marginTop: 8,
  };
  const supportRow: React.CSSProperties = {
    display: 'grid',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.panelBorder}`,
    background: 'rgba(18,24,22,.78)',
  };
  const supportLabel: React.CSSProperties = {
    color: colors.brand,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  };

  const list: React.CSSProperties = { display: 'grid', gap: 10, marginTop: 8 };
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 10,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.panelBorder}`,
    background: 'rgba(18,24,22,.92)',
  };
  const dot = (c: string): React.CSSProperties => ({ width: 10, height: 10, borderRadius: 999, background: c });

  const footer: React.CSSProperties = {
    marginTop: 28,
    paddingTop: 16,
    borderTop: `1px solid ${colors.panelBorder}`,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 8,
    fontSize: 13,
    color: colors.sub,
  };

  return (
    <main style={shell}>
      <section style={hero} aria-label="Hero">
        <div style={eyebrow}>Welcome</div>
        <h1 style={title}>{branding?.tagline || 'Professional wild game processing, with a cleaner customer experience.'}</h1>
        <p style={subtitle}>
          Submit your intake, choose your cuts, and check status online without guessing what happens next.
          {branding?.name ? ` ${branding.name}` : ' This processor'} will use your selected contact method when your order is updated.
        </p>
        <div style={ctas}>
          <Link href={settings?.public_intake_enabled ? '/overnight' : '/hours'} style={cta(true)}>
            {settings?.public_intake_enabled ? 'Start Public Intake' : 'Public Intake Closed'}
          </Link>
          <Link href="/status" style={cta(false)}>Check Your Status</Link>
        </div>
        <div style={statGrid}>
          {serviceHighlights.map((item) => (
            <div key={item.title} style={statCard}>
              <div style={statTitle}>{item.title}</div>
              <div style={statBody}>{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={twoCol} aria-label="Info">
        <div style={panel}>
          <div style={h3}>How it Works</div>
          <ol style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 1.6 }}>
            <li>Use the public intake form before or during drop-off so the shop has your information and cut selections right away.</li>
            <li>Include your confirmation number and leave your deer with your name and phone details for easy matching.</li>
            <li>Staff assigns the permanent tag, reviews your order, and updates status as work moves forward.</li>
            <li>Check status online anytime and pick up promptly once you are notified.</li>
          </ol>
          <div style={{ height: 12 }} />
          <Link href="/faq-public" style={cta(false)}>Read the FAQ</Link>
        </div>

        <aside style={panel} aria-label="Hours & Location">
          <div style={h3}>Hours & Contact</div>
          <div style={list}>
            {hours.map((h) => (
              <div style={row} key={`${h.label}:${h.value}`}>
                <div style={dot(colors.green)} />
                <div>{h.label}: {h.value}</div>
              </div>
            ))}
          </div>
          {businessDetails.length ? (
            <div style={supportList}>
              {businessDetails.map((item) => (
                item.href ? (
                  <Link key={`${item.label}:${item.value}`} href={item.href} style={{ ...supportRow, textDecoration: 'none', color: colors.text }}>
                    <span style={supportLabel}>{item.label}</span>
                    <span>{item.value}</span>
                  </Link>
                ) : (
                  <div key={`${item.label}:${item.value}`} style={supportRow}>
                    <span style={supportLabel}>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                )
              ))}
            </div>
          ) : null}
        </aside>
      </section>

      <section aria-label="Pricing" style={{ marginTop: 12 }}>
        <div style={panel}>
          <div style={h3}>Pricing</div>
          <div style={{ ...twoCol, marginTop: 0 }}>
            {pricingRows.map((item) => (
              <div key={item.label} style={{ ...supportRow, background: 'rgba(18,24,22,.88)' }}>
                <span style={supportLabel}>{item.label}</span>
                <span style={{ fontWeight: 900, fontSize: 20 }}>{formatMoney(item.value, 'prefix' in item ? String(item.prefix || '') : '')}</span>
                <span style={{ color: colors.sub, fontSize: 13 }}>{item.note}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, color: colors.sub, fontSize: 13, lineHeight: 1.5 }}>
            Final totals can vary with cut selections, specialty items, and processor-specific options. Customers can review their selections before submitting.
          </div>
        </div>
      </section>

      <footer style={footer} aria-label="Footer">
        <div>&copy; {new Date().getFullYear()} {branding?.name || 'Game Butcher Board'}. All rights reserved.</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/faq-public">FAQ</Link>
          <Link href="/hours">Hours &amp; Location</Link>
          <Link href="/contact">Contact</Link>
          <span style={{ opacity: 0.6 }}>State &amp; local regulations followed.</span>
        </div>
      </footer>
    </main>
  );
}

function StaffHome({
  dashboard,
  processorName,
  role,
}: {
  dashboard: Awaited<ReturnType<typeof getDashboardSummary>> | null;
  processorName: string;
  role: 'admin' | 'staff' | 'readonly' | null;
}) {
  const canEdit = role === 'admin' || role === 'staff';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : role === 'readonly' ? 'Read-only' : 'Unknown';
  const primaryActions = canEdit
    ? [
        { label: 'New Intake', href: '/intake', detail: 'Start a new deer intake form', accent: '#5b7a62' },
        { label: 'Scan Tags', href: '/scan', detail: 'Move deer through scan-based workflow', accent: '#c88a3d' },
        { label: 'Search Jobs', href: '/search', detail: 'Look up deer, print, and review status', accent: '#8fb3a8' },
      ]
    : [
        { label: 'Search Jobs', href: '/search', detail: 'Open deer details, print sheets, and view status', accent: '#8fb3a8' },
        { label: 'Call Report', href: '/reports/calls', detail: 'Review ready-to-call deer without editing them', accent: '#5b7a62' },
        { label: 'Print Queue', href: '/reports/print-queue', detail: 'Print intake sheets and label stock', accent: '#c88a3d' },
      ];
  const queueHighlights = [
    { label: 'Needs Tags', value: dashboard?.pendingTags ?? 0, hint: 'Public intake drop-offs waiting on staff tag assignment', href: '/overnight/review' },
    { label: 'Ready to Call', value: dashboard?.calledQueue ?? 0, hint: 'Orders ready for customer contact or pickup follow-up', href: '/reports/calls' },
    { label: 'Print Queue', value: dashboard?.printQueue ?? 0, hint: 'Sheets marked for printing or reprinting', href: '/reports/print-queue' },
  ];
  const shell: React.CSSProperties = {
    maxWidth: 1100,
    margin: '26px auto',
    padding: '0 16px 40px',
  };

  const header: React.CSSProperties = { marginBottom: 8 };
  const headerTop: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  };
  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.1,
    fontWeight: 900,
  };
  const subtitle: React.CSSProperties = { margin: '6px 0 0', opacity: 0.85 };
  const processorBadge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 999,
    border: '1px solid rgba(200,138,61,.24)',
    background: 'rgba(21,20,19,.92)',
    color: '#f1e7cf',
    fontSize: 13,
    fontWeight: 800,
  };
  const processorLabel: React.CSSProperties = {
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    fontSize: 11,
    color: '#c88a3d',
  };
  const roleBadge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 999,
    border: '1px solid rgba(143,179,168,.2)',
    background: 'rgba(17,16,15,.84)',
    color: '#dfe9dd',
    fontSize: 13,
    fontWeight: 800,
  };
  const roleLabelStyle: React.CSSProperties = {
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    fontSize: 11,
    color: '#8fb3a8',
  };

  const primaryGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  };
  const splitGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)',
    gap: 16,
    marginBottom: 16,
  };
  const statsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  };

  const card: React.CSSProperties = {
    background: 'rgba(21,20,19,.95)',
    border: '1px solid rgba(200,138,61,.14)',
    borderRadius: 14,
    padding: 16,
  };

  const mini: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    opacity: 0.9,
  };

  const linkStyle: React.CSSProperties = {
    textDecoration: 'none',
    color: 'inherit',
  };

  const list: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    marginTop: 8,
  };
  const ownerGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    marginBottom: 16,
  };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 12,
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,.08)',
    background: 'rgba(21,20,19,.92)',
  };

  const dot = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color,
  });
  const fmtHours = (v: number | null | undefined) => (typeof v === 'number' ? `${v.toFixed(1)} hr` : '-');
  const fmtDays = (v: number | null | undefined) => (typeof v === 'number' ? `${v.toFixed(1)} d` : '-');
  const fmtMoney = (v: number | null | undefined) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '$0.00');

  return (
    <main className="watermark" style={shell}>
      <div style={header}>
        <div style={headerTop}>
          <div>
            <div
              style={{
                color: '#89c096',
                fontWeight: 800,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              Staff Dashboard
            </div>
            <h1 style={title}>Wild Game Butcher Board</h1>
            <p style={subtitle}>
              Quick access to the highest-value actions for {processorName || 'this processor'}, with a role-aware view of what needs attention today.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={processorBadge} aria-label="Current processor">
              <span style={processorLabel}>Processor</span>
              <span>{processorName || 'Unassigned'}</span>
            </div>
            <div style={roleBadge} aria-label="Current role">
              <span style={roleLabelStyle}>Access</span>
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...mini, color: '#c88a3d' }}>Primary Actions</div>
        <div style={{ display: 'grid', gap: 6, marginTop: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 24 }}>Start with the work that moves the day forward</div>
          <div style={{ opacity: 0.82 }}>
            {canEdit
              ? 'Create new intakes, scan deer through production, or jump straight into search to reprint, review, and update records.'
              : 'Your access is focused on viewing, printing, and monitoring progress. Search and reports will be your main tools.'}
          </div>
        </div>
        <div style={primaryGrid}>
          {primaryActions.map((action) => (
            <Link key={action.label} href={action.href} style={linkStyle}>
              <div style={{ ...card, padding: 18, background: 'rgba(14,13,12,.9)', borderColor: 'rgba(200,138,61,.12)' }}>
                <div style={{ ...mini, color: action.accent }}>{action.label}</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8 }}>{action.label}</div>
                <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>{action.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div style={splitGrid}>
        <section style={card}>
          <div style={{ ...mini, color: '#8fb3a8' }}>Queue Snapshot</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
            {queueHighlights.map((item) => (
              <Link key={item.label} href={item.href} style={linkStyle}>
                <div style={{ ...row, gridTemplateColumns: '1fr auto', background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{item.label}</div>
                    <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.45 }}>{item.hint}</div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 950 }}>{item.value}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={{ ...mini, color: '#8fb3a8' }}>Today’s Focus</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#5b7a62')} />
              <div>Use <strong>Search</strong> for reprints, customer lookups, and quick detail review.</div>
            </div>
            <div style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#c88a3d')} />
              <div>{canEdit ? 'Scan workflow will advance cape and processing status in order based on the deer’s setup.' : 'Read-only access still lets you print sheets and labels without changing statuses.'}</div>
            </div>
            <div style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#8fb3a8')} />
              <div>{role === 'admin' ? 'Owner Snapshot below highlights pickup readiness, open balances, and processing timing.' : 'Use reports below to review what is ready, called, or waiting on action.'}</div>
            </div>
          </div>
        </section>
      </div>

      <div style={statsGrid}>
        {[
          { label: 'Public Intake Queue', value: dashboard?.pendingTags ?? 0, href: '/overnight/review' },
          { label: 'Print Queue', value: dashboard?.printQueue ?? 0, href: '/reports/print-queue' },
          { label: 'Called Pickup', value: dashboard?.calledQueue ?? 0, href: '/reports/called' },
          { label: 'Specialty Open', value: dashboard?.specialtyOpen ?? 0, href: '/reports/specialty' },
          { label: 'Today Drop-Offs', value: dashboard?.todayDropoffs ?? 0, href: '/search' },
          { label: 'State Form Entries', value: dashboard?.seasonEntries ?? 0, href: '/reports/state-form' },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={linkStyle}>
            <div style={{ ...card, padding: 14 }}>
              <div style={mini}>{item.label}</div>
              <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6 }}>{item.value}</div>
            </div>
          </Link>
        ))}
      </div>

      {role === 'admin' ? (
        <section style={{ ...card, marginBottom: 16 }}>
          <div style={{ ...mini, color: '#c88a3d' }}>Owner Snapshot</div>
          <div style={{ display: 'grid', gap: 6, marginTop: 6, marginBottom: 12, color: '#d7c3a0' }}>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Today’s business view</div>
            <div style={{ opacity: 0.84 }}>Quick counts for pickup readiness, open balances, and recent intake volume.</div>
          </div>
          <div style={ownerGrid}>
            {[
              { label: 'Ready for Pickup', value: dashboard?.readyForPickup ?? 0 },
              { label: 'Unpaid Processing', value: dashboard?.unpaidProcessing ?? 0 },
              { label: 'Unpaid Specialty', value: dashboard?.unpaidSpecialty ?? 0 },
              { label: 'Intakes (Last 7 Days)', value: dashboard?.recentIntakes7d ?? 0 },
              { label: 'Open Balance', value: fmtMoney(((dashboard as any)?.openProcessingAmount ?? 0) + ((dashboard as any)?.openSpecialtyAmount ?? 0)) },
              { label: 'Ready & Unpaid', value: fmtMoney((dashboard as any)?.readyUnpaidAmount ?? 0) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid rgba(200,138,61,.14)',
                  borderRadius: 14,
                  padding: 14,
                  background: 'rgba(14,13,12,.88)',
                }}
              >
                <div style={{ ...mini, color: '#b7a98d' }}>{item.label}</div>
                <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ ...ownerGrid, marginTop: 12, marginBottom: 0 }}>
            {[
              { label: 'Avg Processing Time', value: fmtHours((dashboard as any)?.avgProcessingHours) },
              { label: 'Avg Ready Hold Time', value: fmtDays((dashboard as any)?.avgReadyAgeDays) },
              { label: 'Oldest Ready Deer', value: fmtDays((dashboard as any)?.oldestReadyDays) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid rgba(200,138,61,.14)',
                  borderRadius: 14,
                  padding: 14,
                  background: 'rgba(14,13,12,.88)',
                }}
              >
                <div style={{ ...mini, color: '#b7a98d' }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 950, marginTop: 6 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/reports/owner-insights"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 900,
                  color: '#f1e7cf',
                  border: '1px solid rgba(200,138,61,.24)',
                  background: 'rgba(21,20,19,.92)',
                }}
              >
                Open detailed owner insights
              </Link>
              <Link
                href="/reports/balances"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 900,
                  color: '#f1e7cf',
                  border: '1px solid rgba(88,141,102,.24)',
                  background: 'rgba(21,20,19,.92)',
                }}
              >
                Open balance report
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div style={splitGrid}>
        <div style={{ ...card, gridColumn: 'span 2' }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            Reports
          </div>

          <div style={list}>
            <Link href="/reports/calls" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(51,117,71,.9)')} />
                <div style={{ fontWeight: 800 }}>Call Report - Ready to Call {dashboard ? `(${dashboard.calledQueue})` : ''}</div>
              </div>
            </Link>

            <Link href="/reports/specialty" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(200,70,25,.9)')} />
                <div style={{ fontWeight: 800 }}>Specialty Totals - Open lbs</div>
              </div>
            </Link>

            <Link href="/overnight/review" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(167,115,18,.9)')} />
                <div style={{ fontWeight: 800 }}>Public Intake - Needs Tag {dashboard ? `(${dashboard.pendingTags})` : ''}</div>
              </div>
            </Link>

            <Link href="/reports/called" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(115,75,170,.95)')} />
                <div style={{ fontWeight: 800 }}>Called - Pickup Queue</div>
              </div>
            </Link>

            <Link href="/reports/state-form" style={linkStyle}>
              <div style={row}>
                <div style={dot('rgba(79,126,91,.9)')} />
                <div style={{ fontWeight: 800 }}>State Form - Season PDF {dashboard ? `(${dashboard.seasonEntries})` : ''}</div>
              </div>
            </Link>
          </div>
        </div>

        <div style={card}>
          <div style={mini}>Reference</div>
          <Link href="/tips" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              Tip Sheet
            </div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Short reminders for staff</div>
          <div style={{ height: 10 }} />
          <Link href="/faq" style={linkStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
              FAQ
            </div>
          </Link>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Customer questions &amp; answers
          </div>
        </div>
      </div>
    </main>
  );
}
