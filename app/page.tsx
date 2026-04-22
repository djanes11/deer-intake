// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getPublicSiteSettings, normalizeProcessorFeatures } from '@/lib/siteSettings';
import { getDashboardSummary } from '@/lib/jobsSupabase';
import { getStaffIdentity, getStaffProcessorContext } from '@/lib/staffContext';
import { filterVisibleAddOnItems, formatProcessTypePrice } from '@/lib/processorCatalog';
import ProcessorInquiryForm from '@/app/components/ProcessorInquiryForm';
import { buildOnboardingChecklist } from '@/lib/onboardingChecklist';

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

type ProcessorOnboardingSnapshot = ReturnType<typeof buildOnboardingChecklist> & {
  publicHostname: string;
  staffHostname: string;
};

type ProcessorOwnerChecklistItem = {
  key:
    | 'logo'
    | 'contact'
    | 'pricing'
    | 'processes'
    | 'extras'
    | 'messages'
    | 'staff'
    | 'public_intake'
    | 'go_live';
  label: string;
  done: boolean;
  note: string;
  href: string;
  external?: boolean;
};

type ProcessorOwnerChecklistSnapshot = {
  readyCount: number;
  totalCount: number;
  readyToGoLive: boolean;
  publicHostname: string;
  items: ProcessorOwnerChecklistItem[];
};

async function getProcessorOnboardingSnapshot(processorId: string | null | undefined) {
  const id = String(processorId || '').trim();
  if (!id) return null;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: processorRow }, { data: siteSettingsRow }, { count: adminCount }] = await Promise.all([
    supabase
      .from('processors')
      .select('id,public_name,name,support_phone_display,public_address,public_hostname,staff_hostname')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('site_settings')
      .select('processor_id,standard_processing_price,caped_price,cape_donate_price,beef_fat_add_on,webbs_add_on,summer_sausage_price_per_lb,snack_stix_price_per_lb,process_catalog,add_on_catalog,notification_templates,cut_option_settings,state_form_type')
      .eq('processor_id', id)
      .maybeSingle(),
    supabase
      .from('processor_users')
      .select('id', { count: 'exact', head: true })
      .eq('processor_id', id)
      .eq('active', true)
      .eq('role', 'admin'),
  ]);

  if (!processorRow) return null;

  return {
    ...buildOnboardingChecklist({
      publicHostname: processorRow.public_hostname,
      staffHostname: processorRow.staff_hostname,
      adminCount: adminCount || 0,
      processor: {
        publicName: processorRow.public_name || processorRow.name || '',
        supportPhoneDisplay: processorRow.support_phone_display || '',
        publicAddress: processorRow.public_address || '',
      },
      siteSettings: siteSettingsRow || {},
    }),
    publicHostname: String(processorRow.public_hostname || ''),
    staffHostname: String(processorRow.staff_hostname || ''),
  } satisfies ProcessorOnboardingSnapshot;
}

async function getProcessorOwnerChecklistSnapshot(processorId: string | null | undefined) {
  const id = String(processorId || '').trim();
  if (!id) return null;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: processorRow }, { data: siteSettingsRow }, { data: memberships }, { data: localMemberships }, { data: specialtyRows }] = await Promise.all([
    supabase
      .from('processors')
      .select('id,public_name,name,logo_url,support_phone_display,support_email,public_address,public_hostname,features')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('site_settings')
      .select('public_intake_enabled,standard_processing_price,caped_price,cape_donate_price,process_catalog,add_on_catalog,notification_templates,public_copy')
      .eq('processor_id', id)
      .maybeSingle(),
    supabase
      .from('processor_users')
      .select('role,active')
      .eq('processor_id', id)
      .eq('active', true),
    supabase
      .from('staff_local_users')
      .select('role,active')
      .eq('processor_id', id)
      .eq('active', true),
    supabase
      .from('processor_specialty_items')
      .select('active')
      .eq('processor_id', id),
  ]);

  if (!processorRow) return null;

  const publicHostname = String(processorRow.public_hostname || '');
  const logoUrl = String(processorRow.logo_url || '').trim();
  const phone = String(processorRow.support_phone_display || '').trim();
  const email = String(processorRow.support_email || '').trim();
  const address = String(processorRow.public_address || '').trim();
  const features = normalizeProcessorFeatures((processorRow as any).features || {});
  const processCatalog = Array.isArray((siteSettingsRow as any)?.process_catalog) ? (siteSettingsRow as any).process_catalog : [];
  const addOnCatalog = Array.isArray((siteSettingsRow as any)?.add_on_catalog) ? (siteSettingsRow as any).add_on_catalog : [];
  const notificationTemplates = (siteSettingsRow as any)?.notification_templates || null;
  const publicCopy = (siteSettingsRow as any)?.public_copy || null;
  const activeProcesses = processCatalog.filter((item: any) => item?.active !== false).length;
  const activeAddOns = addOnCatalog.filter((item: any) => item?.active !== false).length;
  const activeSpecialtyItems = Array.isArray(specialtyRows) ? specialtyRows.filter((item: any) => item?.active !== false).length : 0;
  const hasPricing =
    Number((siteSettingsRow as any)?.standard_processing_price || 0) > 0 &&
    Number((siteSettingsRow as any)?.caped_price || 0) > 0 &&
    Number((siteSettingsRow as any)?.cape_donate_price || 0) > 0;
  const activeEmailMembers = Array.isArray(memberships) ? memberships.length : 0;
  const activeLocalMembers = Array.isArray(localMemberships) ? localMemberships.length : 0;
  const activeMembers = activeEmailMembers + activeLocalMembers;
  const nonAdminMembers =
    (Array.isArray(memberships) ? memberships.filter((item: any) => item?.role !== 'admin').length : 0) +
    (Array.isArray(localMemberships) ? localMemberships.filter((item: any) => item?.role !== 'admin').length : 0);
  const faqItems = Array.isArray(publicCopy?.faqItems) ? publicCopy.faqItems : [];
  const answeredFaqItems = faqItems.filter((item: any) => String(item?.question || '').trim() && String(item?.answer || '').trim()).length;
  const notificationTemplateCount =
    notificationTemplates && typeof notificationTemplates === 'object'
      ? Object.values(notificationTemplates).filter((template: any) =>
          String(template?.smsBody || template?.emailBody || template?.subject || '').trim()
        ).length
      : 0;
  const hasMessages =
    notificationTemplateCount > 0 &&
    !!String(publicCopy?.pickupInstructions || '').trim() &&
    answeredFaqItems > 0;
  const publicIntakeEnabled = (siteSettingsRow as any)?.public_intake_enabled !== false;
  const specialtyEnabled = features.specialtyEnabled !== false;
  const extrasHref = activeAddOns > 0 && specialtyEnabled && activeSpecialtyItems === 0 ? '/admin/settings?section=specialty' : '/admin/settings?section=addons';
  const messagesHref =
    !!String(publicCopy?.pickupInstructions || '').trim() && answeredFaqItems > 0 && notificationTemplateCount === 0
      ? '/admin/settings?section=notifications'
      : '/admin/settings?section=copy';

  const items: ProcessorOwnerChecklistItem[] = [
    {
      key: 'logo',
      label: 'Add logo',
      done: !!logoUrl,
      note: !!logoUrl ? 'A logo is set for the public site.' : 'Add the logo customers should see on your public site.',
      href: '/admin/settings?section=branding',
    },
    {
      key: 'contact',
      label: 'Confirm contact info',
      done: !!phone && !!address,
      note: !!phone && !!address ? 'Phone and address are ready for customers.' : 'Add the phone number and address customers should use.',
      href: '/admin/settings?section=branding',
    },
    {
      key: 'pricing',
      label: 'Confirm pricing',
      done: hasPricing,
      note: hasPricing ? 'Base processing prices are in place.' : 'Set the base prices for standard, caped, and cape-donate orders.',
      href: '/admin/settings?section=pricing',
    },
    {
      key: 'processes',
      label: 'Confirm process types',
      done: activeProcesses > 0,
      note: activeProcesses > 0 ? `${activeProcesses} active process type${activeProcesses === 1 ? '' : 's'} ready.` : 'Review which process types customers can choose.',
      href: '/admin/settings?section=processes',
    },
    {
      key: 'extras',
      label: 'Confirm add-ons and specialty',
      done: activeAddOns > 0 && (!specialtyEnabled || activeSpecialtyItems > 0),
      note:
        activeAddOns > 0 && (!specialtyEnabled || activeSpecialtyItems > 0)
          ? !specialtyEnabled
            ? `${activeAddOns} active add-on${activeAddOns === 1 ? '' : 's'} ready, and specialty products are turned off.`
            : `${activeAddOns} active add-on${activeAddOns === 1 ? '' : 's'} and ${activeSpecialtyItems} specialty item${activeSpecialtyItems === 1 ? '' : 's'} ready.`
          : activeAddOns === 0
            ? 'Review add-ons before going live.'
            : 'Review specialty products before going live.',
      href: extrasHref,
    },
    {
      key: 'messages',
      label: 'Review customer messages',
      done: hasMessages,
      note: hasMessages ? 'Public wording, FAQ, and message templates are ready to review.' : 'Review the public wording, FAQ items, and customer message templates.',
      href: messagesHref,
    },
    {
      key: 'staff',
      label: 'Add staff',
      done: nonAdminMembers > 0,
      note: nonAdminMembers > 0 ? `${activeMembers} active login${activeMembers === 1 ? '' : 's'} attached.` : 'Add at least one staff or read-only login for day-to-day use.',
      href: '/staff/team',
    },
    {
      key: 'public_intake',
      label: 'Test public intake',
      done: publicIntakeEnabled && !!publicHostname,
      note: publicIntakeEnabled && !!publicHostname ? 'Public intake is live and ready to open in a browser.' : 'Turn on public intake and confirm the public hostname is ready.',
      href: publicHostname ? `https://${publicHostname}` : '/admin/settings?section=intake',
      external: !!publicHostname,
    },
    {
      key: 'go_live',
      label: 'Ready to go live',
      done: false,
      note: 'Once the items above are done, this processor is ready for customers and staff.',
      href: publicHostname ? `https://${publicHostname}` : '/admin/settings?section=intake',
      external: !!publicHostname,
    },
  ];

  const priorDoneCount = items.slice(0, -1).filter((item) => item.done).length;
  items[items.length - 1] = {
    ...items[items.length - 1],
    done: priorDoneCount === items.length - 1,
    note:
      priorDoneCount === items.length - 1
        ? 'Everything above is ready. Open the public site once more, then go live.'
        : 'Finish the items above, then do one final public intake test before going live.',
  };

  const readyCount = items.filter((item) => item.done).length;
  return {
    readyCount,
    totalCount: items.length,
    readyToGoLive: readyCount === items.length,
    publicHostname,
    items,
  } satisfies ProcessorOwnerChecklistSnapshot;
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

  const staffContext = IS_PUBLIC ? null : await getStaffProcessorContext().catch(() => null);
  const settings = IS_PUBLIC
    ? await getPublicSiteSettings()
    : await getPublicSiteSettings(undefined, staffContext).catch(() => getPublicSiteSettings());
  const dashboard = IS_PUBLIC ? null : await getDashboardSummary().catch(() => null);
  const onboarding = !IS_PUBLIC && staffContext?.role === 'admin'
    ? await getProcessorOnboardingSnapshot(staffContext.id).catch(() => null)
    : null;
  const ownerChecklist = !IS_PUBLIC && staffContext?.role === 'admin'
    ? await getProcessorOwnerChecklistSnapshot(staffContext.id).catch(() => null)
    : null;
  return IS_PUBLIC ? (
    <PublicLanding settings={settings} />
  ) : (
    <StaffHome
      dashboard={dashboard}
      processorName={settings.branding.name}
      role={staffContext?.role || null}
      onboarding={onboarding}
      ownerChecklist={ownerChecklist}
      scanEnabled={settings.features.scanEnabled !== false}
    />
  );
}

function MarketingLanding() {
  const shell: React.CSSProperties = {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '0 16px 60px',
    color: '#f5ecd8',
  };
  const panel: React.CSSProperties = {
    borderRadius: 24,
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
  const proofPoints = [
    { value: 'One shared system', label: 'Public intake, staff workflow, scanning, labels, and reporting in one product' },
    { value: 'Processor-owned setup', label: 'Customize process types, add-ons, specialty products, pricing, and branding' },
    { value: 'Owner visibility', label: 'Balances, pickup aging, activity history, and processing-time insights' },
  ];
  const previewCards = [
    {
      label: 'Public intake',
      title: 'Customers submit before drop-off',
      image: '/marketing/public-intake.png',
      alt: 'Public intake form for deer drop-off',
      body: 'Mobile-friendly intake captures customer info, cuts, extras, and review steps before the deer reaches the shop.',
      chips: ['Mobile-friendly', 'Cuts', 'Specialty', 'Add-ons'],
    },
    {
      label: 'Staff workflow',
      title: 'Search, print, assign tags, and move faster',
      image: '/marketing/staff-search.png',
      alt: 'Staff search screen for deer records',
      body: 'Staff can search by tag, confirmation, name, or phone to reprint paperwork, check balances, and send updates quickly.',
      chips: ['Search', 'Print', 'Labels', 'Queue'],
    },
    {
      label: 'Production floor',
      title: 'Use scans and labels to move deer cleanly through the shop',
      image: '/marketing/scan-workflow.png',
      alt: 'Scan-based butcher workflow screen',
      body: 'Thermal labels, scan-driven cape and processing status, and butcher-facing details keep the production floor moving without handwritten chaos.',
      chips: ['Scan', 'Cape', 'Processing', 'Finished'],
    },
  ];
  const faqs = [
    {
      question: 'Can each processor customize offerings and pricing?',
      answer:
        'Yes. Process types, add-ons, specialty products, cut-option visibility, pricing, branding, and public-facing copy can all be managed per processor.',
    },
    {
      question: 'Does it support public intake and shop-specific workflows?',
      answer:
        'Yes. Processors can use public intake in the way that fits their shop, and staff can review entries, assign the permanent tag, and print paperwork whenever that workflow makes sense.',
    },
    {
      question: 'Can staff have different access levels?',
      answer:
        'Yes. Processors can use admin, staff, and read-only access so the right people can view, edit, print, scan, or manage settings.',
    },
    {
      question: 'Can this work with labels and scanners?',
      answer:
        'Yes. The workflow supports thermal labels, barcode-based tag handling, scan-driven progression, and quick reprint paths from staff tools.',
    },
  ];

  return (
    <main style={shell}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 0 8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/wgbb-logo.png"
            alt="Wild Game Butcher Board"
            width={48}
            height={48}
            style={{ display: 'block', width: 48, height: 48, borderRadius: 10, objectFit: 'cover', boxShadow: '0 10px 24px rgba(0,0,0,.24)' }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d2b27d' }}>Wild Game Butcher Board</div>
            <div style={{ color: 'rgba(245,236,216,.76)' }}>Deer processing software for processors, staff, and owners</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="#request-demo" style={cta(true)}>Request a Demo</a>
          <Link href="/staff/login" style={cta(false)}>Staff Login</Link>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 12, padding: 28, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gap: 20, alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={eyebrow}>Deer Processing Software</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.04, fontWeight: 950, color: '#fff7e8', maxWidth: 760 }}>
              Software for deer processors who need the whole shop to run smoother.
            </h1>
            <div style={{ color: 'rgba(245,236,216,.84)', fontSize: 15, lineHeight: 1.5, maxWidth: 700 }}>
              Wild Game Butcher Board brings together public intake, staff workflow, scan-based production, thermal labels, customer communication, pickup tracking, and owner reporting in one system.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#request-demo" style={cta(true)}>Request a Demo</a>
              <a href="#how-it-works" style={cta(false)}>See How It Works</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 6 }}>
              {[
                { label: 'Public intake workflow', note: 'Customers can enter cleaner information before staff review the deer' },
                { label: 'Thermal labels + scanning', note: 'Faster floor workflow and clearer tag handling' },
                { label: 'Processor-specific setup', note: 'Process types, add-ons, specialty items, and pricing' },
              ].map((item) => (
                <div key={item.label} style={{ ...sectionCard, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#c88a3d' }}>{item.label}</div>
                  <div style={{ marginTop: 8, color: '#f5ecd8', lineHeight: 1.5 }}>{item.note}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 2 }}>
              {proofPoints.map((item) => (
                <div key={item.value} style={{ ...sectionCard, padding: 14 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, color: '#fff7e8', lineHeight: 1.15 }}>{item.value}</div>
                  <div style={{ marginTop: 5, color: 'rgba(245,236,216,.74)', lineHeight: 1.45, fontSize: 13 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        <div style={eyebrow}>Product Views</div>
        <div style={{ fontSize: 28, fontWeight: 950, color: '#fff7e8' }}>See the actual workflow, not mockups</div>
        <div style={{ color: 'rgba(245,236,216,.76)', lineHeight: 1.55, fontSize: 15, maxWidth: 780 }}>
          These are real screens from the platform. The goal is simple: customers enter cleaner information, staff move faster, and the butcher floor has what it needs without extra paperwork.
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {previewCards.map((card, index) => (
            <div
              key={card.title}
              style={{
                ...sectionCard,
                padding: 16,
                display: 'grid',
                gridTemplateColumns: index === 0 ? 'minmax(0, 1.2fr) minmax(300px, .8fr)' : 'minmax(0, 1fr) minmax(300px, .8fr)',
                gap: 16,
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,.08)',
                  background: 'linear-gradient(180deg, rgba(37,34,31,.96) 0%, rgba(16,15,14,.98) 100%)',
                  padding: 12,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
                }}
              >
                <img
                  src={card.image}
                  alt={card.alt || card.title}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,.08)',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c88a3d' }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff7e8', lineHeight: 1.12 }}>{card.title}</div>
                <div style={{ color: 'rgba(245,236,216,.78)', lineHeight: 1.5, fontSize: 15 }}>{card.body}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {card.chips.map((chip) => (
                    <span
                      key={chip}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid rgba(200,138,61,.16)',
                        background: 'rgba(255,255,255,.03)',
                        fontSize: 12,
                        color: 'rgba(245,236,216,.88)',
                        fontWeight: 700,
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        <div style={eyebrow}>How It Works</div>
        <div style={{ fontSize: 28, fontWeight: 950, color: '#fff7e8' }}>A simple flow from drop-off to pickup</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {workflowSteps.map((step, index) => (
            <div key={step.title} style={{ ...sectionCard, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c88a3d' }}>Step {index + 1}</div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#fff7e8', lineHeight: 1.2 }}>{step.title}</div>
              <div style={{ marginTop: 6, color: 'rgba(245,236,216,.78)', lineHeight: 1.45, fontSize: 14 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12, marginTop: 22 }}>
        <div style={eyebrow}>Feature Areas</div>
        <div style={{ fontSize: 28, fontWeight: 950, color: '#fff7e8' }}>The main parts of the platform</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {featureGroups.map((group) => (
            <div key={group.title} style={{ ...sectionCard, padding: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff7e8' }}>{group.title}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {group.items.map((item) => (
                  <div key={item} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start' }}>
                    <div style={{ width: 9, height: 9, marginTop: 7, borderRadius: 999, background: '#c88a3d' }} />
                    <div style={{ color: 'rgba(245,236,216,.82)', lineHeight: 1.45, fontSize: 14 }}>{item}</div>
                  </div>
                ))}
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
                'Tell us whether you use public intake, labels, texting, scanning, or specialty products',
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

      <section style={{ display: 'grid', gap: 14, marginTop: 24 }}>
        <div style={eyebrow}>FAQ</div>
        <div style={{ fontSize: 26, fontWeight: 950, color: '#fff7e8' }}>Questions processors usually ask first</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {faqs.map((item) => (
            <details key={item.question} style={{ ...sectionCard, padding: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 17, fontWeight: 900, color: '#fff7e8' }}>{item.question}</summary>
              <div style={{ marginTop: 10, color: 'rgba(245,236,216,.8)', lineHeight: 1.55, fontSize: 14 }}>{item.answer}</div>
            </details>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28, padding: '8px 0 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: 'rgba(245,236,216,.7)' }}>
        <div>Wild Game Butcher Board</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <a href="#request-demo" style={{ color: '#f5ecd8', textDecoration: 'none' }}>Request a Demo</a>
          <Link href="/staff/login" style={{ color: '#f5ecd8', textDecoration: 'none' }}>Staff Login</Link>
        </div>
      </section>
    </main>
  );
}

function PublicLanding({ settings }: { settings: Awaited<ReturnType<typeof getPublicSiteSettings>> | null }) {
  const pricing = settings?.pricing;
  const branding = settings?.branding;
  const features = settings?.features;
  const publicCopy = settings?.publicCopy;
  const hours = settings?.hours || [];
  const pricingRows = [
    ...((settings?.processCatalog || []).filter((item) => item.active).map((item) => ({
      label: item.name,
      value: formatProcessTypePrice(item as any),
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
      title: 'Public intake made simpler',
      body: 'Customers can enter cleaner drop-off information ahead of time so staff can review the deer and assign the permanent tag without extra paperwork.',
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
  const acceptedPaymentLabels = ((publicCopy?.acceptedPaymentMethods || []) as string[])
    .map((method) => ({ cash: 'Cash', card: 'Card', check: 'Check', other: 'Other' }[method] || method))
    .filter(Boolean);
  const policyRows = [
    publicCopy?.turnaroundEstimate ? { label: 'Turnaround', value: publicCopy.turnaroundEstimate } : null,
    acceptedPaymentLabels.length ? { label: 'Payment', value: acceptedPaymentLabels.join(', ') } : null,
    publicCopy?.callBeforePickup ? { label: 'Pickup', value: 'Please call before pickup so staff can prepare your order.' } : null,
    publicCopy?.storageFeePolicy ? { label: 'Hold Policy', value: publicCopy.storageFeePolicy } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
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
    borderRadius: 18,
    background: 'radial-gradient(circle at top center, rgba(200,138,61,.16) 0%, transparent 36%), linear-gradient(180deg, rgba(33,25,21,1) 0%, rgba(16,13,11,1) 100%)',
    border: `1px solid ${colors.panelBorder}`,
    padding: 22,
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
  const subtitle: React.CSSProperties = { margin: '0 0 16px', color: colors.sub, maxWidth: 720, fontSize: 15, lineHeight: 1.55 };
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
    borderRadius: 16,
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
    padding: '12px 12px',
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
        <h1 style={title}>{publicCopy?.homeHeadline || branding?.tagline || 'Professional wild game processing, with a cleaner customer experience.'}</h1>
        <p style={subtitle}>
          {publicCopy?.homeIntro || 'Submit your intake, choose your cuts, and check status online without guessing what happens next.'}
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
            {(publicCopy?.homeHowItWorks?.length ? publicCopy.homeHowItWorks : [
              'Use the public intake form before or during drop-off so the shop has your information and cut selections right away.',
              'Include your state confirmation number and leave your deer with your name and phone details for easy matching.',
              'Staff assigns the permanent tag, reviews your order, and updates status as work moves forward.',
              'Check status online anytime and pick up promptly once you are notified.',
            ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
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
                <span style={{ fontWeight: 900, fontSize: 20 }}>
                  {typeof item.value === 'number'
                    ? formatMoney(item.value, 'prefix' in item ? String(item.prefix || '') : '')
                    : `${'prefix' in item ? String(item.prefix || '') : ''}${item.value}`}
                </span>
                <span style={{ color: colors.sub, fontSize: 13 }}>{item.note}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, color: colors.sub, fontSize: 13, lineHeight: 1.5 }}>
            {publicCopy?.pricingNote || 'Final totals can vary with cut selections, specialty items, and processor-specific options. Customers can review their selections before submitting.'}
          </div>
        </div>
      </section>

      {policyRows.length ? (
        <section aria-label="Policies" style={{ marginTop: 12 }}>
          <div style={panel}>
            <div style={h3}>What to Expect</div>
            <div style={{ ...twoCol, marginTop: 0 }}>
              {policyRows.map((item) => (
                <div key={item.label} style={{ ...supportRow, background: 'rgba(18,24,22,.88)' }}>
                  <span style={supportLabel}>{item.label}</span>
                  <span style={{ lineHeight: 1.55 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

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
  onboarding,
  ownerChecklist,
  scanEnabled,
}: {
  dashboard: Awaited<ReturnType<typeof getDashboardSummary>> | null;
  processorName: string;
  role: 'admin' | 'staff' | 'readonly' | null;
  onboarding: ProcessorOnboardingSnapshot | null;
  ownerChecklist: ProcessorOwnerChecklistSnapshot | null;
  scanEnabled: boolean;
}) {
  const canEdit = role === 'admin' || role === 'staff';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : role === 'readonly' ? 'Read-only' : 'Unknown';
  const primaryActions = canEdit
    ? [
        { label: 'New Intake', href: '/intake', detail: 'Enter a new deer drop-off or update one by hand', accent: '#5b7a62' },
        { label: scanEnabled ? 'Search Jobs' : 'Update Statuses', href: '/search', detail: scanEnabled ? 'Find a deer, print paperwork, or review details' : 'Find a deer and move it forward manually from search or intake', accent: '#8fb3a8' },
        ...(scanEnabled ? [{ label: 'Scan Tags', href: '/scan', detail: 'Scan tags to move deer through processing', accent: '#c88a3d' }] : []),
      ]
    : [
        { label: 'Search Jobs', href: '/search', detail: 'Find a deer, print paperwork, or review details', accent: '#8fb3a8' },
        { label: 'Call Report', href: '/reports/calls', detail: 'See which deer are ready for customer contact', accent: '#5b7a62' },
        { label: 'Print Queue', href: '/reports/print-queue', detail: 'Print intake sheets and labels that still need paper', accent: '#c88a3d' },
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
    <>
    <main className="watermark staff-dashboard-shell" style={shell}>
      <div style={header}>
        <div style={headerTop} className="staff-dashboard-header-top">
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
              Start with the main jobs for {processorName || 'this processor'} and work through what needs attention today.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }} className="staff-dashboard-meta">
            <div style={processorBadge} aria-label="Current processor" className="staff-dashboard-badge">
              <span style={processorLabel}>Processor</span>
              <span>{processorName || 'Unassigned'}</span>
            </div>
            <div style={roleBadge} aria-label="Current role" className="staff-dashboard-badge">
              <span style={roleLabelStyle}>Access</span>
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {role === 'admin' && ownerChecklist && !ownerChecklist.readyToGoLive ? (
        <section
          style={{
            ...card,
            marginBottom: 16,
            borderColor: ownerChecklist.readyToGoLive ? 'rgba(91,122,98,.3)' : 'rgba(200,138,61,.22)',
            background: ownerChecklist.readyToGoLive ? 'rgba(17,31,22,.96)' : 'rgba(31,23,14,.96)',
          }}
        >
          <div style={{ ...mini, color: ownerChecklist.readyToGoLive ? '#89c096' : '#d2b27d' }}>
            {ownerChecklist.readyToGoLive ? 'Go-Live Ready' : 'Make This Yours'}
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 24 }}>Finish setup, then use this page to run the shop.</div>
            <div style={{ opacity: 0.84, lineHeight: 1.55 }}>
              {ownerChecklist.readyCount}/{ownerChecklist.totalCount} owner setup items are complete. The detailed checklist lives in Processor Settings now, so this dashboard stays focused on day-to-day work.
            </div>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}
            className="staff-dashboard-kpis"
          >
            {[
              {
                label: 'Setup Progress',
                value: `${ownerChecklist.readyCount}/${ownerChecklist.totalCount}`,
                note: 'Owner setup items complete',
              },
              {
                label: 'Still Needs Attention',
                value: String(ownerChecklist.items.filter((item) => !item.done).length),
                note: 'Settings areas still to review',
              },
              {
                label: 'Public Intake',
                value: ownerChecklist.publicHostname ? 'Ready to test' : 'Hostname needed',
                note: ownerChecklist.publicHostname ? 'Open the public site and test one intake' : 'Finish the public hostname before testing',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid rgba(200,138,61,.18)',
                  borderRadius: 14,
                  padding: 14,
                  background: 'rgba(14,13,12,.82)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#d2b27d' }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 900, fontSize: 28 }}>{item.value}</div>
                <div style={{ opacity: 0.8, lineHeight: 1.45, fontSize: 14 }}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#d2b27d' }}>
              Next Best Things To Finish
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {ownerChecklist.items
                .filter((item) => !item.done)
                .slice(0, 3)
                .map((item) => {
                  const rowNode = (
                    <div
                      style={{
                        border: '1px solid rgba(200,138,61,.16)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        background: 'rgba(14,13,12,.72)',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 900 }}>{item.label}</div>
                        <span style={{ color: '#f1d1a0', fontSize: 12, fontWeight: 900, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          Open setup
                        </span>
                      </div>
                      <div style={{ opacity: 0.82, lineHeight: 1.45, fontSize: 14 }}>{item.note}</div>
                    </div>
                  );
                  return item.external ? (
                    <a key={item.key} href={item.href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {rowNode}
                    </a>
                  ) : (
                    <Link key={item.key} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {rowNode}
                    </Link>
                  );
                })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }} className="staff-dashboard-actions">
            <Link href="/admin/settings?section=overview" style={{ textDecoration: 'none' }}>
              <div className="btn secondary dashboard-inline-action" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                Open Processor Settings
              </div>
            </Link>
            <Link href="/staff/team" style={{ textDecoration: 'none' }}>
              <div className="btn secondary dashboard-inline-action" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                Add Staff
              </div>
            </Link>
            {ownerChecklist.publicHostname ? (
              <a href={`https://${ownerChecklist.publicHostname}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div
                  className="btn secondary dashboard-inline-action"
                  style={{ display: 'inline-flex', justifyContent: 'center' }}
                >
                  Test Public Intake
                </div>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...mini, color: '#c88a3d' }}>Primary Actions</div>
        <div style={{ display: 'grid', gap: 6, marginTop: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 24 }}>Start with one of these</div>
          <div style={{ opacity: 0.82 }}>
            {canEdit
              ? (scanEnabled ? 'Choose the task you are doing right now: enter a deer, scan tags on the floor, or look up an existing record.' : 'This processor is using the manual workflow, so intake and search are the two main places to work.')
              : 'Your access is focused on viewing, printing, and monitoring progress. Search and reports are the main places to work.'}
          </div>
        </div>
        <div style={primaryGrid} className="staff-dashboard-primary-grid">
          {primaryActions.map((action) => (
            <Link key={action.label} href={action.href} style={linkStyle}>
              <div
                className="staff-dashboard-primary-card"
                style={{ ...card, padding: 18, background: 'rgba(14,13,12,.9)', borderColor: 'rgba(200,138,61,.12)' }}
              >
                <div style={{ ...mini, color: action.accent }}>Go To</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8 }}>{action.label}</div>
                <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>{action.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div style={splitGrid} className="staff-dashboard-split-grid">
        <section style={card}>
          <div style={{ ...mini, color: '#8fb3a8' }}>Queue Snapshot</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
            {queueHighlights.map((item) => (
              <Link key={item.label} href={item.href} style={linkStyle}>
                <div className="staff-dashboard-queue-row" style={{ ...row, gridTemplateColumns: '1fr auto', background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>{item.label}</div>
                    <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.45 }}>{item.hint}</div>
                  </div>
                  <div className="staff-dashboard-queue-value" style={{ fontSize: 30, fontWeight: 950 }}>{item.value}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={card}>
          <div style={{ ...mini, color: '#8fb3a8' }}>Today’s Focus</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div className="staff-dashboard-focus-row" style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#5b7a62')} />
              <div>Use <strong>Search</strong> when you need to find one deer, reprint paperwork, or check a customer record.</div>
            </div>
            <div className="staff-dashboard-focus-row" style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#c88a3d')} />
              <div>{canEdit ? (scanEnabled ? 'The scan page will move deer forward in the right order based on how that deer was set up.' : 'This processor is using manual status updates, so intake and search are the main places to update deer.') : 'Read-only access still lets you print sheets and labels without changing statuses.'}</div>
            </div>
            <div className="staff-dashboard-focus-row" style={{ ...row, background: 'rgba(14,13,12,.88)', borderColor: 'rgba(255,255,255,.06)' }}>
              <div style={dot('#8fb3a8')} />
              <div>{role === 'admin' ? 'Owner Snapshot below shows what is ready, what is unpaid, and how work is moving.' : 'Use the reports below to see what is ready, what has been called, and what still needs action.'}</div>
            </div>
          </div>
        </section>
      </div>

      <div style={statsGrid} className="staff-dashboard-stats-grid">
        {[
          { label: 'Specialty Report - Open pounds', value: dashboard?.specialtyOpen ?? 0, href: '/reports/specialty' },
          { label: 'Today Drop-Offs', value: dashboard?.todayDropoffs ?? 0, href: '/search' },
          { label: 'State Form - Season PDF', value: dashboard?.seasonEntries ?? 0, href: '/reports/state-form' },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={linkStyle}>
            <div className="staff-dashboard-stat-card" style={{ ...card, padding: 14 }}>
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
          <div style={ownerGrid} className="staff-dashboard-owner-grid">
            {[
              { label: 'Ready for Pickup', value: dashboard?.readyForPickup ?? 0 },
              { label: 'Unpaid Processing', value: dashboard?.unpaidProcessing ?? 0 },
              { label: 'Unpaid Specialty', value: dashboard?.unpaidSpecialty ?? 0 },
              { label: 'Intakes (Last 7 Days)', value: dashboard?.recentIntakes7d ?? 0 },
              { label: 'Open Balance', value: fmtMoney(((dashboard as any)?.openProcessingAmount ?? 0) + ((dashboard as any)?.openSpecialtyAmount ?? 0)) },
              { label: 'Ready & Unpaid', value: fmtMoney((dashboard as any)?.readyUnpaidAmount ?? 0) },
            ].map((item) => (
              <div
                className="staff-dashboard-owner-card"
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
          <div style={{ ...ownerGrid, marginTop: 12, marginBottom: 0 }} className="staff-dashboard-owner-grid staff-dashboard-owner-grid-secondary">
            {[
              { label: 'Avg Processing Time', value: fmtHours((dashboard as any)?.avgProcessingHours) },
              { label: 'Avg Ready Hold Time', value: fmtDays((dashboard as any)?.avgReadyAgeDays) },
              { label: 'Oldest Ready Deer', value: fmtDays((dashboard as any)?.oldestReadyDays) },
              { label: 'Ready 3+ Days', value: (dashboard as any)?.readyHeld3d ?? 0 },
              { label: 'Ready 7+ Days', value: (dashboard as any)?.readyHeld7d ?? 0 },
              { label: 'Ready 14+ Days', value: (dashboard as any)?.readyHeld14d ?? 0 },
            ].map((item) => (
              <div
                className="staff-dashboard-owner-card"
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
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} className="staff-dashboard-actions">
              <Link
                href="/reports/owner-insights"
                className="dashboard-inline-link"
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
                className="dashboard-inline-link"
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

      <div style={splitGrid} className="staff-dashboard-reports-grid">
        <div style={{ ...card, gridColumn: 'span 2' }} className="staff-dashboard-reports-card">
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            Reports
          </div>

          <div style={list}>
            <Link href="/reports/calls" style={linkStyle}>
              <div className="staff-dashboard-report-row" style={row}>
                <div style={dot('rgba(51,117,71,.9)')} />
                <div style={{ fontWeight: 800 }}>Call Report - Ready to Call {dashboard ? `(${dashboard.calledQueue})` : ''}</div>
              </div>
            </Link>

            <Link href="/reports/specialty" style={linkStyle}>
              <div className="staff-dashboard-report-row" style={row}>
                <div style={dot('rgba(200,70,25,.9)')} />
                <div style={{ fontWeight: 800 }}>Specialty Totals - Open lbs</div>
              </div>
            </Link>

            <Link href="/overnight/review" style={linkStyle}>
              <div className="staff-dashboard-report-row" style={row}>
                <div style={dot('rgba(167,115,18,.9)')} />
                <div style={{ fontWeight: 800 }}>Public Intake - Needs Tag {dashboard ? `(${dashboard.pendingTags})` : ''}</div>
              </div>
            </Link>

            <Link href="/reports/called" style={linkStyle}>
              <div className="staff-dashboard-report-row" style={row}>
                <div style={dot('rgba(115,75,170,.95)')} />
                <div style={{ fontWeight: 800 }}>Called - Pickup Queue</div>
              </div>
            </Link>

            <Link href="/reports/state-form" style={linkStyle}>
              <div className="staff-dashboard-report-row" style={row}>
                <div style={dot('rgba(79,126,91,.9)')} />
                <div style={{ fontWeight: 800 }}>State Form - Season PDF {dashboard ? `(${dashboard.seasonEntries})` : ''}</div>
              </div>
            </Link>
          </div>
        </div>

        <div style={card} className="staff-dashboard-reference-card">
          <div style={mini}>Reference</div>
          <div className="staff-dashboard-reference-links">
            <Link href="/tips" style={linkStyle}>
              <div className="staff-dashboard-reference-link">
                <div style={{ fontWeight: 900, fontSize: 18 }}>Tip Sheet</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>Short reminders for staff</div>
              </div>
            </Link>
            <Link href="/faq" style={linkStyle}>
              <div className="staff-dashboard-reference-link">
                <div style={{ fontWeight: 900, fontSize: 18 }}>FAQ</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  Customer questions &amp; answers
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
    <style>{`
      .staff-dashboard-primary-card,
      .staff-dashboard-queue-row,
      .staff-dashboard-report-row,
      .staff-dashboard-reference-link,
      .dashboard-inline-action,
      .dashboard-inline-link,
      .staff-dashboard-badge {
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
      }

      .staff-dashboard-primary-card:hover,
      .staff-dashboard-queue-row:hover,
      .staff-dashboard-report-row:hover,
      .staff-dashboard-reference-link:hover,
      .dashboard-inline-link:hover {
        transform: translateY(-1px);
        border-color: rgba(200, 138, 61, 0.24);
      }

      .staff-dashboard-reference-links {
        display: grid;
        gap: 10px;
        margin-top: 10px;
      }

      .staff-dashboard-reference-link {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px;
        background: rgba(14, 13, 12, 0.88);
      }

      @media (max-width: 920px) {
        .staff-dashboard-header-top,
        .staff-dashboard-split-grid,
        .staff-dashboard-reports-grid {
          grid-template-columns: 1fr !important;
        }

        .staff-dashboard-meta {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
        }

        .staff-dashboard-badge,
        .dashboard-inline-action,
        .dashboard-inline-link {
          width: 100%;
          justify-content: center;
        }

        .staff-dashboard-reports-card {
          grid-column: auto !important;
        }
      }

      @media (max-width: 700px) {
        .staff-dashboard-shell {
          padding-top: 16px;
        }

        .staff-dashboard-header-top {
          gap: 14px;
        }

        .staff-dashboard-meta,
        .staff-dashboard-primary-grid,
        .staff-dashboard-stats-grid,
        .staff-dashboard-owner-grid,
        .staff-dashboard-kpis {
          grid-template-columns: 1fr !important;
        }

        .staff-dashboard-primary-card,
        .staff-dashboard-owner-card,
        .staff-dashboard-stat-card {
          padding: 16px !important;
        }

        .staff-dashboard-queue-row {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          align-items: start !important;
        }

        .staff-dashboard-queue-value {
          justify-self: start;
          min-width: 56px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(200, 138, 61, 0.14);
          border: 1px solid rgba(200, 138, 61, 0.2);
          font-size: 22px !important;
          line-height: 1;
        }

        .staff-dashboard-focus-row,
        .staff-dashboard-report-row {
          grid-template-columns: 1fr !important;
          gap: 8px !important;
          align-items: start !important;
        }

        .staff-dashboard-focus-row > :first-child,
        .staff-dashboard-report-row > :first-child {
          width: 12px;
          height: 12px;
          margin-bottom: 2px;
        }

        .staff-dashboard-actions {
          display: grid !important;
          grid-template-columns: 1fr;
        }
      }
    `}</style>
    </>
  );
}
