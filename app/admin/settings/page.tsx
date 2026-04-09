'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';
import { DEFAULT_SITE_PRICING, SitePricing, formatMoney, normalizePricing } from '@/lib/pricing';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import { listStateFormOptions } from '@/lib/stateforms/catalog';
import { StateFormType } from '@/lib/stateforms/types';
import { defaultSpecialtyCatalog, normalizeSpecialtyCatalog, SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import {
  AddOnCatalogItem,
  defaultAddOnCatalog,
  defaultNotificationTemplates,
  defaultProcessCatalog,
  filterVisibleAddOnItems,
  normalizeAddOnCatalog,
  normalizeNotificationTemplates,
  normalizeProcessCatalog,
  NotificationTemplateEventKey,
  NotificationTemplateSet,
  ProcessTypeCatalogItem,
} from '@/lib/processorCatalog';

type HourRow = {
  label: string;
  value: string;
};

type BrandingSettings = {
  name: string;
  locationLabel: string;
  tagline: string;
  logoUrl: string;
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  address: string;
  mapsUrl: string;
};

type PublicFaqItem = {
  question: string;
  answer: string;
};

type PublicCopySettings = {
  intakeHighlights: string[];
  reviewChecklist: string[];
  pickupInstructions: string;
  thankYouMessage: string;
  faqItems: PublicFaqItem[];
};

type SiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: HourRow[];
  pricing: SitePricing;
  processCatalog: ProcessTypeCatalogItem[];
  addOnCatalog: AddOnCatalogItem[];
  specialtyCatalog: SpecialtyCatalogItem[];
  notificationTemplates: NotificationTemplateSet;
  branding: BrandingSettings;
  cutOptions: {
    showFrontShoulderSteaks: boolean;
    showSteakThickness: boolean;
    showBackstrapThickness: boolean;
    showRoastCounts: boolean;
  };
  stateFormType: StateFormType;
  publicCopy: PublicCopySettings;
  features?: {
    plan: 'basic' | 'texting' | 'custom';
    smsEnabled: boolean;
    webbsEnabled: boolean;
  };
  updated_at?: string;
};

const DEFAULT_HOURS: HourRow[] = [
  { label: 'Mon-Fri', value: '6-8 pm' },
  { label: 'Sat', value: '9-5' },
  { label: 'Sun', value: '9-12' },
  { label: 'After Hours', value: 'Overnight drop available' },
];

const DEFAULT_BRANDING: BrandingSettings = {
  name: 'Wild Game Butcher Board',
  locationLabel: 'Palmyra, IN',
  tagline: 'Wild game intake, tracking, and processor operations in one place.',
  logoUrl: '/wgbb-logo.png',
  phoneDisplay: '(502) 643-3916',
  phoneE164: '+15026433916',
  email: '',
  address: '10977 Buffalo Trace Rd, Palmyra, IN 47164',
  mapsUrl: '',
};

const DEFAULT_PUBLIC_COPY: PublicCopySettings = {
  intakeHighlights: [
    'Complete this before leaving your deer so the shop has your cuts and contact details right away.',
    'Staff will assign the permanent deer tag after reviewing the drop-off.',
  ],
  reviewChecklist: [
    'Customer name and confirmation number match your state check-in',
    'Drop-off details and process type are correct',
    'Cuts, specialty items, and contact preference look right',
  ],
  pickupInstructions:
    'Leave a note with your full name, phone number, and the last 5 digits of your confirmation number attached to the deer.',
  thankYouMessage:
    'Save or screenshot this confirmation number before you close this page. You will need it to check your status until staff assign your deer tag.',
  faqItems: [
    {
      question: 'How do I use the Public Intake Form?',
      answer: 'Use the public intake guide for step-by-step instructions, after-hours drop-off expectations, and what to do after you submit.',
    },
    {
      question: 'Where are you located?',
      answer: 'Use the address and map link on this site for directions to the shop.',
    },
    {
      question: 'How will I know my deer is ready?',
      answer: 'We will use the contact method you selected on your intake form for updates, and you can also check status online.',
    },
  ],
};

function normalizeHours(hours: any): HourRow[] {
  if (!Array.isArray(hours) || !hours.length) return DEFAULT_HOURS;
  const rows = hours.map((row) => ({
    label: String(row?.label || ''),
    value: String(row?.value || ''),
  }));
  return rows.length ? rows : DEFAULT_HOURS;
}

function specialtyDraftRows(input: SpecialtyCatalogItem[] | undefined | null, pricing: SitePricing): SpecialtyCatalogItem[] {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((item, index) => ({
    id: item?.id || null,
    slug: String(item?.slug || ''),
    name: String(item?.name || ''),
    shortName: String(item?.shortName || ''),
    unit: 'lb',
    priceType: 'per_lb',
    price: Number.isFinite(Number(item?.price)) ? Number(item?.price) : 0,
    active: item?.active !== false,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : (index + 1) * 10,
    legacyFieldKey: item?.legacyFieldKey || null,
  }));
}

function processDraftRows(input: ProcessTypeCatalogItem[] | undefined | null, pricing: SitePricing): ProcessTypeCatalogItem[] {
  const rows = Array.isArray(input) ? input : [];
  const fallback = defaultProcessCatalog(pricing);
  return rows.map((item, index) => ({
    slug: String(item?.slug || ''),
    name: String(item?.name || ''),
    basePrice: Number.isFinite(Number(item?.basePrice)) ? Number(item?.basePrice) : Number(fallback[index]?.basePrice ?? 0),
    active: item?.active !== false,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : (index + 1) * 10,
    triggersCapeWorkflow: !!item?.triggersCapeWorkflow,
    donationOnly: !!item?.donationOnly,
  }));
}

function addOnDraftRows(input: AddOnCatalogItem[] | undefined | null, pricing: SitePricing): AddOnCatalogItem[] {
  const rows = Array.isArray(input) ? input : [];
  const fallback = defaultAddOnCatalog(pricing);
  return rows.map((item, index) => ({
    slug: String(item?.slug || ''),
    name: String(item?.name || ''),
    price: Number.isFinite(Number(item?.price)) ? Number(item?.price) : Number(fallback[index]?.price ?? 0),
    active: item?.active !== false,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : (index + 1) * 10,
    legacyBooleanKey: item?.legacyBooleanKey ?? null,
  }));
}

export default function AdminSettingsPage() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [section, setSection] = useState<'branding' | 'intake' | 'copy' | 'banner' | 'hours' | 'pricing' | 'processes' | 'addons' | 'specialty' | 'notifications'>('branding');

  const headers: Record<string, string> = useMemo(
    () => ({
      'content-type': 'application/json',
      ...tokenHeader(),
    }),
    []
  );

  const load = async () => {
    setMsg('');
    const res = await fetch('/api/admin/site-settings', { headers, cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    setS({
      ...(j.settings as SiteSettings),
      hours: normalizeHours(j?.settings?.hours),
      pricing: normalizePricing(j?.settings),
      processCatalog: processDraftRows(normalizeProcessCatalog(j?.settings?.processCatalog, normalizePricing(j?.settings)), normalizePricing(j?.settings)),
      addOnCatalog: addOnDraftRows(normalizeAddOnCatalog(j?.settings?.addOnCatalog, normalizePricing(j?.settings)), normalizePricing(j?.settings)),
      specialtyCatalog: specialtyDraftRows(
        normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, j?.settings),
        normalizePricing(j?.settings),
      ),
      notificationTemplates: normalizeNotificationTemplates(j?.settings?.notificationTemplates, j?.settings?.branding?.name || DEFAULT_BRANDING.name),
      cutOptions: normalizeCutOptionSettings(j?.settings?.cutOptions),
      stateFormType: j?.settings?.stateFormType || 'indiana',
      publicCopy: j?.settings?.publicCopy || DEFAULT_PUBLIC_COPY,
      branding: {
        ...DEFAULT_BRANDING,
        ...(j?.settings?.branding || {}),
      },
    });
  };

  useEffect(() => {
    load().catch((e) => setMsg(String((e as any)?.message || e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!s) return;
    setBusy(true);
    setMsg('');
    try {
      const payload = {
        ...s,
        hours: normalizeHours(s.hours).filter((row) => row.label.trim() || row.value.trim()),
        ...normalizePricing(s.pricing),
        processCatalog: normalizeProcessCatalog(s.processCatalog, s.pricing),
        addOnCatalog: normalizeAddOnCatalog(s.addOnCatalog, s.pricing),
        specialtyCatalog: normalizeSpecialtyCatalog(s.specialtyCatalog, s.pricing),
        notificationTemplates: normalizeNotificationTemplates(s.notificationTemplates, s.branding.name),
      };
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setS({
        ...(j.settings as SiteSettings),
        hours: normalizeHours(j?.settings?.hours),
        pricing: normalizePricing(j?.settings),
        processCatalog: processDraftRows(normalizeProcessCatalog(j?.settings?.processCatalog, normalizePricing(j?.settings)), normalizePricing(j?.settings)),
        addOnCatalog: addOnDraftRows(normalizeAddOnCatalog(j?.settings?.addOnCatalog, normalizePricing(j?.settings)), normalizePricing(j?.settings)),
        specialtyCatalog: specialtyDraftRows(
          normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, j?.settings),
          normalizePricing(j?.settings),
        ),
        notificationTemplates: normalizeNotificationTemplates(j?.settings?.notificationTemplates, j?.settings?.branding?.name || DEFAULT_BRANDING.name),
        cutOptions: normalizeCutOptionSettings(j?.settings?.cutOptions),
        stateFormType: j?.settings?.stateFormType || 'indiana',
        publicCopy: j?.settings?.publicCopy || DEFAULT_PUBLIC_COPY,
        branding: {
          ...DEFAULT_BRANDING,
          ...(j?.settings?.branding || {}),
        },
      });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const updatePricing = (key: keyof SitePricing, value: string) => {
    if (!s) return;
    setS({
      ...s,
      pricing: {
        ...normalizePricing(s.pricing),
        [key]: value,
      } as SitePricing,
    });
  };

  const updateHour = (index: number, key: keyof HourRow, value: string) => {
    if (!s) return;
    const nextHours = normalizeHours(s.hours).map((row, i) => (i === index ? { ...row, [key]: value } : row));
    setS({ ...s, hours: nextHours });
  };

  const updateProcessTypeItem = (index: number, key: keyof ProcessTypeCatalogItem, value: string | boolean) => {
    if (!s) return;
    const current = processDraftRows(s.processCatalog, s.pricing);
    const next = current.map((item, i) =>
      i === index
        ? {
            ...item,
            [key]:
              key === 'basePrice'
                ? Number(value || 0)
                : key === 'sortOrder'
                  ? Number(value || (i + 1) * 10)
                  : value,
          }
        : item
    );
    if (key === 'name') {
      const row = next[index];
      if (row && !String(row.slug || '').trim()) {
        row.slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
    }
    setS({ ...s, processCatalog: next });
  };

  const addProcessType = () => {
    if (!s) return;
    const current = processDraftRows(s.processCatalog, s.pricing);
    setS({
      ...s,
      processCatalog: [
        ...current,
        { slug: '', name: '', basePrice: 0, active: true, sortOrder: (current.length + 1) * 10, triggersCapeWorkflow: false, donationOnly: false },
      ],
    });
  };

  const removeProcessType = (index: number) => {
    if (!s) return;
    setS({ ...s, processCatalog: processDraftRows(s.processCatalog, s.pricing).filter((_, i) => i !== index) });
  };

  const updateAddOnItem = (index: number, key: keyof AddOnCatalogItem, value: string | boolean) => {
    if (!s) return;
    const current = addOnDraftRows(s.addOnCatalog, s.pricing);
    const next = current.map((item, i) =>
      i === index
        ? {
            ...item,
            [key]:
              key === 'price'
                ? Number(value || 0)
                : key === 'sortOrder'
                  ? Number(value || (i + 1) * 10)
                  : value,
          }
        : item
    );
    if (key === 'name') {
      const row = next[index];
      if (row && !String(row.slug || '').trim()) {
        row.slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
    }
    setS({ ...s, addOnCatalog: next });
  };

  const addAddOn = () => {
    if (!s) return;
    const current = addOnDraftRows(s.addOnCatalog, s.pricing);
    if (current.some((item) => !String(item.name || '').trim() && !String(item.slug || '').trim())) {
      setS({ ...s, addOnCatalog: current });
      return;
    }
    setS({
      ...s,
      addOnCatalog: [
        ...current,
        { slug: '', name: '', price: 0, active: true, sortOrder: (current.length + 1) * 10, legacyBooleanKey: null },
      ],
    });
  };

  const removeAddOn = (index: number) => {
    if (!s) return;
    setS({ ...s, addOnCatalog: addOnDraftRows(s.addOnCatalog, s.pricing).filter((_, i) => i !== index) });
  };

  const updateNotificationTemplate = (
    eventKey: NotificationTemplateEventKey,
    field: 'emailSubject' | 'emailBody' | 'smsBody',
    value: string,
  ) => {
    if (!s) return;
    setS({
      ...s,
      notificationTemplates: {
        ...normalizeNotificationTemplates(s.notificationTemplates, s.branding.name),
        [eventKey]: {
          ...normalizeNotificationTemplates(s.notificationTemplates, s.branding.name)[eventKey],
          [field]: value,
        },
      },
    });
  };

  const updateSpecialtyItem = (index: number, key: keyof SpecialtyCatalogItem, value: string | boolean) => {
    if (!s) return;
    const next = specialtyDraftRows(s.specialtyCatalog, s.pricing).map((item, i) =>
      i === index
        ? {
            ...item,
            [key]:
              key === 'price'
                ? Number(value || 0)
                : key === 'sortOrder'
                  ? Number(value || (i + 1) * 10)
                  : value,
          }
        : item
    );
    if (key === 'name') {
      const current = next[index];
      if (current && !String(current.slug || '').trim()) {
        next[index] = {
          ...current,
          slug: String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        };
      }
    }
    if (key === 'shortName') {
      const current = next[index];
      if (current && !String(current.name || '').trim() && String(value || '').trim()) {
        next[index] = {
          ...current,
          name: String(value || '').trim(),
        };
      }
    }
    setS({ ...s, specialtyCatalog: next });
  };

  const addSpecialtyItem = () => {
    if (!s) return;
    const current = specialtyDraftRows(s.specialtyCatalog, s.pricing);
    if (current.some((item) => !String(item.name || '').trim() && !String(item.slug || '').trim())) {
      setS({ ...s, specialtyCatalog: current });
      return;
    }
    setS({
      ...s,
      specialtyCatalog: [
        ...current,
        {
          slug: '',
          name: '',
          shortName: '',
          unit: 'lb',
          priceType: 'per_lb',
          price: 0,
          active: true,
          sortOrder: (current.length + 1) * 10,
        },
      ],
    });
  };

  const removeSpecialtyItem = (index: number) => {
    if (!s) return;
    const current = specialtyDraftRows(s.specialtyCatalog, s.pricing);
    setS({ ...s, specialtyCatalog: current.filter((_, i) => i !== index) });
  };

  if (!s) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: '24px auto',
          padding: 16,
          color: '#0f172a',
          background: '#f8fafc',
          border: '1px solid #dbe4ee',
          borderRadius: 16,
        }}
      >
        Loading... {msg ? <div style={{ marginTop: 8, color: '#991b1b', fontWeight: 700 }}>{msg}</div> : null}
      </div>
    );
  }

  const visibleAddOnRows = addOnDraftRows(s.addOnCatalog, s.pricing)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => filterVisibleAddOnItems([item], s.features?.webbsEnabled !== false).length > 0);
  const visibleActiveAddOnCount = filterVisibleAddOnItems(
    normalizeAddOnCatalog(s.addOnCatalog, s.pricing).filter((item) => item.active),
    s.features?.webbsEnabled !== false
  ).length;

  const sectionTabs = [
    { key: 'branding', label: 'Branding & Contact' },
    { key: 'intake', label: 'Public Intake' },
    { key: 'copy', label: 'Public Copy & FAQ' },
    { key: 'banner', label: 'Banner' },
    { key: 'hours', label: 'Hours' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'processes', label: 'Process Types' },
    { key: 'addons', label: 'Add-Ons' },
    { key: 'specialty', label: 'Specialty Products' },
    { key: 'notifications', label: 'Notifications' },
  ] as const;
  const sectionDescriptions: Record<(typeof sectionTabs)[number]['key'], string> = {
    branding: 'Business identity, contact details, address, and public-facing branding.',
    intake: 'Turn intake on or off, choose a state form, and control cut-option visibility.',
    copy: 'Edit the wording customers see during intake, review, thank-you, and FAQ flows.',
    banner: 'Manage temporary alerts or notices shown across the public site.',
    hours: 'Set the pickup and contact hours shown on the public site.',
    pricing: 'Control base processing prices and system-owned add-on pricing fields.',
    processes: 'Choose which process types are available and what each one costs.',
    addons: 'Manage generic add-ons that staff and customers can select on intake.',
    specialty: 'Control specialty products, names, and per-pound pricing.',
    notifications: 'Customize the template wording for customer emails and texts.',
  };
  const currentSectionIndex = Math.max(0, sectionTabs.findIndex((tab) => tab.key === section));
  const currentSection = sectionTabs[currentSectionIndex] || sectionTabs[0];
  const previousSection = currentSectionIndex > 0 ? sectionTabs[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex < sectionTabs.length - 1 ? sectionTabs[currentSectionIndex + 1] : null;
  const sectionCard: React.CSSProperties = {
    border: '1px solid rgba(200,138,61,.14)',
    borderRadius: 22,
    padding: 20,
    background: 'rgba(255,255,255,.97)',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
    display: 'grid',
    gap: 12,
  };
  const sectionButton = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? '#e1c08b' : '#d6dee8'}`,
    background: active ? '#fff7eb' : '#ffffff',
    color: active ? '#7c4b17' : '#334155',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: active ? '0 8px 18px rgba(200,138,61,.12)' : '0 6px 14px rgba(15,23,42,.04)',
  });

  return (
    <main className="app-frame" style={{ maxWidth: 1040, color: '#0f172a' }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">
              Staff Controls
            </div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>Public Site Settings</h1>
            <div className="app-copy">
              Manage the processor-facing pieces of the product from one place: branding, public intake behavior, offerings, public wording, and customer communication defaults.
            </div>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>Best use of this page</div>
            <div style={{ color: 'rgba(245,236,216,.82)', lineHeight: 1.55 }}>
              Treat this as the processor’s control center. Platform plans and billing belong in Processor Management, while this page controls what customers and staff actually see and use.
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Public intake', value: s.public_intake_enabled ? 'Live' : 'Off', note: 'Customer drop-off form status' },
          { label: 'Banner', value: s.banner_enabled ? 'Shown' : 'Hidden', note: 'Public alert messaging' },
          { label: 'Process types', value: String(normalizeProcessCatalog(s.processCatalog, s.pricing).filter((item) => item.active).length), note: 'Selectable on intake forms' },
          { label: 'Add-ons', value: String(visibleActiveAddOnCount), note: 'Optional extras on intake forms' },
          { label: 'Specialty items', value: String(normalizeSpecialtyCatalog(s.specialtyCatalog, s.pricing).filter((item) => item.active).length), note: 'Shown on intake forms' },
          { label: 'Public FAQs', value: String((s.publicCopy?.faqItems || []).length), note: 'Shop-specific help on the public site' },
        ].map((item) => (
          <div
            key={item.label}
            className="app-surface-light"
            style={{
              padding: 16,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: '#0f172a' }}>{item.value}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <section className="app-surface-light" style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div className="app-section-head">
          <div className="app-section-title">Settings Areas</div>
          <div className="app-section-copy">Work through one settings section at a time to keep changes easier to review and save.</div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <aside
          className="app-surface-light"
          style={{
            padding: 14,
            display: 'grid',
            gap: 12,
            position: 'sticky',
            top: 78,
          }}
        >
          <div className="app-section-head">
            <div className="app-section-title">Navigate Settings</div>
            <div className="app-section-copy">
              {currentSection ? `${currentSectionIndex + 1} of ${sectionTabs.length}: ${currentSection.label}` : 'Choose a section.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {sectionTabs.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSection(tab.key)}
                style={{
                  ...sectionButton(section === tab.key),
                  width: '100%',
                  textAlign: 'left',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.72 }}>
                  Section {index + 1}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
              Current Section
            </div>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>{currentSection.label}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              {sectionDescriptions[currentSection.key]}
            </div>
            <button
              onClick={save}
              disabled={busy}
              style={{
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid #235532',
                background: '#2f6f3f',
                color: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
                opacity: busy ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
            <div style={{ fontSize: 13, fontWeight: 800, color: msg === 'Saved' ? '#166534' : '#64748b' }}>
              {msg || 'Changes save across every section on this page.'}
            </div>
          </div>
        </aside>

      <div style={{ display: 'grid', gap: 14 }}>
        {section === 'branding' && (
        <div style={sectionCard}>
          <div className="app-section-head">
            <div className="app-section-title">Branding & Contact</div>
            <div className="app-section-copy">
              These details appear on the public site for this processor. Plan tiers and feature access are managed from Processor Management.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              ['Business name', 'name'],
              ['Location label', 'locationLabel'],
              ['Public tagline', 'tagline'],
              ['Logo URL', 'logoUrl'],
              ['Phone display', 'phoneDisplay'],
              ['Phone E.164', 'phoneE164'],
              ['Support email', 'email'],
              ['Address', 'address'],
              ['Google Maps URL', 'mapsUrl'],
            ].map(([label, key]) => (
              <label key={key} style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{label}</span>
                <input
                  value={(s.branding as any)?.[key] || ''}
                  onChange={(e) =>
                    setS({
                      ...s,
                      branding: {
                        ...DEFAULT_BRANDING,
                        ...s.branding,
                        [key]: e.target.value,
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                />
              </label>
            ))}
          </div>
        </div>
        )}

        {section === 'intake' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Public Intake</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={!!s.public_intake_enabled}
              onChange={(e) => setS({ ...s, public_intake_enabled: e.target.checked })}
            />
            Public intake enabled
          </label>
          <div
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: s.public_intake_enabled ? '#ecfdf5' : '#fff7ed',
              color: s.public_intake_enabled ? '#166534' : '#9a3412',
              border: `1px solid ${s.public_intake_enabled ? '#bbf7d0' : '#fed7aa'}`,
            }}
          >
            {s.public_intake_enabled ? 'Public intake is live' : 'Public intake is off'}
          </div>
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Turn this off when you are at capacity or temporarily closed. The public pages will show the intake as unavailable.
          </div>
          <div
            style={{
              marginTop: 6,
              padding: 14,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Cut Option Visibility</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Use these toggles to simplify the cut section for this processor without changing saved order data.
            </div>
            <label style={{ display: 'grid', gap: 6, fontWeight: 800, color: '#0f172a' }}>
              <span>Official state form</span>
              <select
                value={s.stateFormType || 'indiana'}
                onChange={(e) => setS({ ...s, stateFormType: e.target.value as StateFormType })}
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              >
                {listStateFormOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              This controls which official state wildlife processor PDF is generated from the intake data. Michigan forms will also collect hunting license number on intake.
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={!!s.cutOptions?.showFrontShoulderSteaks}
                onChange={(e) => setS({ ...s, cutOptions: { ...s.cutOptions, showFrontShoulderSteaks: e.target.checked } })}
              />
              Show front shoulder steak option
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={!!s.cutOptions?.showSteakThickness}
                onChange={(e) => setS({ ...s, cutOptions: { ...s.cutOptions, showSteakThickness: e.target.checked } })}
              />
              Show steak thickness option
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={!!s.cutOptions?.showBackstrapThickness}
                onChange={(e) => setS({ ...s, cutOptions: { ...s.cutOptions, showBackstrapThickness: e.target.checked } })}
              />
              Show backstrap thickness option
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={!!s.cutOptions?.showRoastCounts}
                onChange={(e) => setS({ ...s, cutOptions: { ...s.cutOptions, showRoastCounts: e.target.checked } })}
              />
              Show roast count inputs
            </label>
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Need to change plan tier, SMS access, Webbs access, or hostnames? Use <a href="/admin/processors" style={{ color: '#1d4ed8', fontWeight: 800 }}>Processor Management</a>.
          </div>
        </div>
        )}

        {section === 'copy' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Public Copy & FAQ</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Customize the wording customers see during public intake, after they submit, and on the public FAQ page.
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Intake intro highlights</span>
            <textarea
              rows={4}
              value={(s.publicCopy?.intakeHighlights || []).join('\n')}
              onChange={(e) =>
                setS({
                  ...s,
                  publicCopy: {
                    ...DEFAULT_PUBLIC_COPY,
                    ...s.publicCopy,
                    intakeHighlights: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                  },
                })
              }
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="One highlight per line"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Review checklist</span>
            <textarea
              rows={4}
              value={(s.publicCopy?.reviewChecklist || []).join('\n')}
              onChange={(e) =>
                setS({
                  ...s,
                  publicCopy: {
                    ...DEFAULT_PUBLIC_COPY,
                    ...s.publicCopy,
                    reviewChecklist: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
                  },
                })
              }
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="One checklist item per line"
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Pickup instructions</span>
            <textarea
              rows={3}
              value={s.publicCopy?.pickupInstructions || ''}
              onChange={(e) =>
                setS({
                  ...s,
                  publicCopy: {
                    ...DEFAULT_PUBLIC_COPY,
                    ...s.publicCopy,
                    pickupInstructions: e.target.value,
                  },
                })
              }
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Thank-you message</span>
            <textarea
              rows={4}
              value={s.publicCopy?.thankYouMessage || ''}
              onChange={(e) =>
                setS({
                  ...s,
                  publicCopy: {
                    ...DEFAULT_PUBLIC_COPY,
                    ...s.publicCopy,
                    thankYouMessage: e.target.value,
                  },
                })
              }
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            />
          </label>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Public FAQ Items</div>
            {(s.publicCopy?.faqItems || []).map((item, index) => (
              <div key={`faq-${index}`} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <input
                  value={item.question}
                  onChange={(e) => {
                    const next = [...(s.publicCopy?.faqItems || [])];
                    next[index] = { ...next[index], question: e.target.value };
                    setS({ ...s, publicCopy: { ...DEFAULT_PUBLIC_COPY, ...s.publicCopy, faqItems: next } });
                  }}
                  placeholder="Question"
                  style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                />
                <textarea
                  rows={3}
                  value={item.answer}
                  onChange={(e) => {
                    const next = [...(s.publicCopy?.faqItems || [])];
                    next[index] = { ...next[index], answer: e.target.value };
                    setS({ ...s, publicCopy: { ...DEFAULT_PUBLIC_COPY, ...s.publicCopy, faqItems: next } });
                  }}
                  placeholder="Answer"
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                />
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setS({
                        ...s,
                        publicCopy: {
                          ...DEFAULT_PUBLIC_COPY,
                          ...s.publicCopy,
                          faqItems: (s.publicCopy?.faqItems || []).filter((_, i) => i !== index),
                        },
                      })
                    }
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#991b1b', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Remove FAQ
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() =>
                  setS({
                    ...s,
                    publicCopy: {
                      ...DEFAULT_PUBLIC_COPY,
                      ...s.publicCopy,
                      faqItems: [...(s.publicCopy?.faqItems || []), { question: '', answer: '' }],
                    },
                  })
                }
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}
              >
                Add FAQ Item
              </button>
              <button
                type="button"
                onClick={() => setS({ ...s, publicCopy: DEFAULT_PUBLIC_COPY })}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}
              >
                Reset Public Copy Defaults
              </button>
            </div>
          </div>
        </div>
        )}

        {section === 'banner' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Banner</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={!!s.banner_enabled}
              onChange={(e) => setS({ ...s, banner_enabled: e.target.checked })}
            />
            Show public banner
          </label>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 6, color: '#0f172a' }}>Banner message</div>
            <textarea
              rows={3}
              value={s.banner_message || ''}
              onChange={(e) => setS({ ...s, banner_message: e.target.value })}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
              }}
              placeholder="Example: We are currently full and not accepting public intake submissions."
            />
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 14,
              background: s.banner_enabled ? '#fff7ed' : '#f8fafc',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: '#475569', marginBottom: 6 }}>Banner Preview</div>
            <div
              style={{
                borderRadius: 10,
                padding: '10px 12px',
                background: s.banner_enabled ? '#7c2d12' : '#e2e8f0',
                color: s.banner_enabled ? '#fff7ed' : '#475569',
                fontWeight: 800,
                lineHeight: 1.45,
              }}
            >
              {s.banner_enabled
                ? s.banner_message?.trim() || 'Your banner message will appear here.'
                : 'Banner is currently hidden on the public site.'}
            </div>
          </div>
        </div>
        )}

        {section === 'hours' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Pickup Hours</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These rows show on the public Hours page and any public page that uses the public hours feed.
          </div>

          {normalizeHours(s.hours).map((row, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) minmax(0, 2fr)',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <input
                value={row.label}
                onChange={(e) => updateHour(idx, 'label', e.target.value)}
                placeholder="Label"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <input
                value={row.value}
                onChange={(e) => updateHour(idx, 'value', e.target.value)}
                placeholder="Hours"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setS({ ...s, hours: [...normalizeHours(s.hours), { label: '', value: '' }] })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Add Row
            </button>
            <button
              type="button"
              onClick={() => setS({ ...s, hours: DEFAULT_HOURS })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Defaults
            </button>
          </div>
        </div>
        )}

        {section === 'pricing' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Pricing</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These values drive the intake totals, specialty totals, print sheet pricing, and customer-facing pricing copy.
          </div>

          {[
            ['standard_processing_price', 'Standard Processing'],
            ['caped_price', 'Caped'],
            ['cape_donate_price', 'Cape & Donate'],
            ['beef_fat_add_on', 'Beef Fat Add-On'],
            ['webbs_add_on', 'Webbs Add-On'],
          ].map(([key, label]) => (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(120px, 0.7fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: 10,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{label}</div>
              <input
                inputMode="decimal"
                value={String((s.pricing as any)?.[key] ?? '')}
                onChange={(e) => updatePricing(key as keyof SitePricing, e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', minWidth: 72 }}>
                {formatMoney(Number((s.pricing as any)?.[key] ?? 0))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setS({ ...s, pricing: DEFAULT_SITE_PRICING })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Pricing Defaults
            </button>
          </div>
        </div>
        )}

        {section === 'processes' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Process Types</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Control which process options appear on intake forms, what they are called, and what base price they use.
          </div>
          {processDraftRows(s.processCatalog, s.pricing).map((item, index) => (
            <div key={`process-${index}`} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 0.8fr', gap: 10 }}>
                <input value={item.name} onChange={(e) => updateProcessTypeItem(index, 'name', e.target.value)} placeholder="Display name" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
                <input value={item.slug} onChange={(e) => updateProcessTypeItem(index, 'slug', e.target.value)} placeholder="slug" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
                <input inputMode="decimal" value={String(item.basePrice ?? '')} onChange={(e) => updateProcessTypeItem(index, 'basePrice', e.target.value)} placeholder="0" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={item.active} onChange={(e) => updateProcessTypeItem(index, 'active', e.target.checked)} /> Active</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={item.triggersCapeWorkflow} onChange={(e) => updateProcessTypeItem(index, 'triggersCapeWorkflow', e.target.checked)} /> Cape workflow</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={item.donationOnly} onChange={(e) => updateProcessTypeItem(index, 'donationOnly', e.target.checked)} /> Donation option</label>
                <button type="button" onClick={() => removeProcessType(index)} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#991b1b', fontWeight: 800, cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={addProcessType} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Add Process Type</button>
            <button type="button" onClick={() => setS({ ...s, processCatalog: defaultProcessCatalog(s.pricing) })} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Reset Defaults</button>
          </div>
        </div>
        )}

        {section === 'addons' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Add-Ons</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Add optional extras to the intake form and control their pricing. Dedicated custom workflows stay out of this generic list so staff do not see duplicate choices.
          </div>
          {s.features?.webbsEnabled ? (
            <div style={{ padding: 12, borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 13, fontWeight: 700 }}>
              Webbs is using the dedicated custom workflow for this processor, so it is hidden from the generic add-on list. Keep using the Webbs pricing field in the Pricing section for that workflow.
            </div>
          ) : null}
          {visibleAddOnRows.map(({ item, index }) => (
            <div key={`addon-${index}`} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 0.8fr auto', gap: 10 }}>
                <input value={item.name} onChange={(e) => updateAddOnItem(index, 'name', e.target.value)} placeholder="Display name" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
                <input value={item.slug} onChange={(e) => updateAddOnItem(index, 'slug', e.target.value)} placeholder="slug" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
                <input inputMode="decimal" value={String(item.price ?? '')} onChange={(e) => updateAddOnItem(index, 'price', e.target.value)} placeholder="0" style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
                {item.legacyBooleanKey ? <div style={{ alignSelf: 'center', fontSize: 12, fontWeight: 800, color: '#475569' }}>System: {item.legacyBooleanKey}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={item.active} onChange={(e) => updateAddOnItem(index, 'active', e.target.checked)} /> Active</label>
                {!item.legacyBooleanKey ? (
                  <button type="button" onClick={() => removeAddOn(index)} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#991b1b', fontWeight: 800, cursor: 'pointer' }}>Remove</button>
                ) : null}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={addAddOn} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Add Add-On</button>
            <button type="button" onClick={() => setS({ ...s, addOnCatalog: defaultAddOnCatalog(s.pricing) })} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Reset Defaults</button>
          </div>
        </div>
        )}

        {section === 'specialty' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Specialty Products</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Control which specialty products appear on the intake forms for this processor and how much each one costs per pound.
          </div>

          {specialtyDraftRows(s.specialtyCatalog, s.pricing).map((item, index) => (
            <div
              key={`specialty-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) auto auto auto',
                gap: 10,
                alignItems: 'center',
                padding: 12,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <input
                value={item.name}
                onChange={(e) => updateSpecialtyItem(index, 'name', e.target.value)}
                placeholder="Display name"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <input
                value={item.shortName}
                onChange={(e) => updateSpecialtyItem(index, 'shortName', e.target.value)}
                placeholder="Short label"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <input
                inputMode="decimal"
                value={String(item.price ?? '')}
                onChange={(e) => updateSpecialtyItem(index, 'price', e.target.value)}
                placeholder="0.00"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', minWidth: 72 }}>
                {formatMoney(Number(item.price ?? 0))}/lb
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) => updateSpecialtyItem(index, 'active', e.target.checked)}
                />
                Active
              </label>
              <button
                type="button"
                onClick={() => removeSpecialtyItem(index)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  color: '#b91c1c',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={addSpecialtyItem}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Add Specialty Item
            </button>
            <button
              type="button"
              onClick={() => setS({ ...s, specialtyCatalog: defaultSpecialtyCatalog(s.pricing) })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Default Catalog
            </button>
          </div>
        </div>
        )}

        {section === 'notifications' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Notification Templates</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Customize the customer-facing email and text copy for major updates. Available placeholders include {'{{name}}'}, {'{{tag}}'}, {'{{businessName}}'}, {'{{phoneSuffix}}'}, {'{{statusLine}}'}, {'{{pickupHours}}'}, {'{{processingDueLine}}'}, {'{{specialtyDueLine}}'}, and {'{{intakeLinkLine}}'}.
          </div>
          {(Object.entries(normalizeNotificationTemplates(s.notificationTemplates, s.branding.name)) as [NotificationTemplateEventKey, NotificationTemplateSet[NotificationTemplateEventKey]][]).map(([eventKey, template]) => (
            <div key={eventKey} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 900, color: '#0f172a', textTransform: 'capitalize' }}>{eventKey.replace(/_/g, ' ')}</div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800 }}>Email Subject</span>
                <input value={template.emailSubject} onChange={(e) => updateNotificationTemplate(eventKey, 'emailSubject', e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800 }}>Email Body</span>
                <textarea rows={5} value={template.emailBody} onChange={(e) => updateNotificationTemplate(eventKey, 'emailBody', e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800 }}>SMS Body</span>
                <textarea rows={2} value={template.smsBody} onChange={(e) => updateNotificationTemplate(eventKey, 'smsBody', e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }} />
              </label>
            </div>
          ))}
          <button type="button" onClick={() => setS({ ...s, notificationTemplates: defaultNotificationTemplates(s.branding.name) })} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Reset Notification Defaults</button>
        </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '8px 4px 0',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {previousSection ? (
              <button
                type="button"
                onClick={() => setSection(previousSection.key)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {`Previous: ${previousSection.label}`}
              </button>
            ) : null}
            {nextSection ? (
              <button
                type="button"
                onClick={() => setSection(nextSection.key)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {`Next: ${nextSection.label}`}
              </button>
            ) : null}
          </div>
          <button
            onClick={save}
            disabled={busy}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #235532',
              background: '#2f6f3f',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      </section>
    </main>
  );
}
