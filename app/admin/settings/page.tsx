'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';
import { DEFAULT_SITE_PRICING, SitePricing, formatMoney, normalizePricing } from '@/lib/pricing';
import { defaultSpecialtyCatalog, normalizeSpecialtyCatalog, SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import {
  AddOnCatalogItem,
  defaultAddOnCatalog,
  defaultNotificationTemplates,
  defaultProcessCatalog,
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
  const [section, setSection] = useState<'branding' | 'intake' | 'banner' | 'hours' | 'pricing' | 'processes' | 'addons' | 'specialty' | 'notifications'>('branding');

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

  const sectionTabs = [
    { key: 'branding', label: 'Branding & Contact' },
    { key: 'intake', label: 'Public Intake' },
    { key: 'banner', label: 'Banner' },
    { key: 'hours', label: 'Hours' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'processes', label: 'Process Types' },
    { key: 'addons', label: 'Add-Ons' },
    { key: 'specialty', label: 'Specialty Products' },
    { key: 'notifications', label: 'Notifications' },
  ] as const;
  const sectionCard: React.CSSProperties = {
    border: '1px solid #d6dee8',
    borderRadius: 16,
    padding: 18,
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    display: 'grid',
    gap: 12,
  };
  const sectionButton = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? '#bfd2c2' : '#d6dee8'}`,
    background: active ? '#eef8f0' : '#ffffff',
    color: active ? '#173321' : '#334155',
    fontWeight: 800,
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '24px auto',
        padding: 16,
        color: '#0f172a',
      }}
    >
      <div
        style={{
          marginBottom: 16,
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #122217 0%, #22412d 100%)',
          color: '#f8fafc',
          border: '1px solid #2f6f3f',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#b9ddc2' }}>
          Staff Controls
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05, color: '#ffffff' }}>Public Site Settings</h2>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 700, lineHeight: 1.5 }}>
          Update the public intake status, banner message, and customer-facing pickup hours from one place.
        </div>
      </div>

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
          { label: 'Add-ons', value: String(normalizeAddOnCatalog(s.addOnCatalog, s.pricing).filter((item) => item.active).length), note: 'Optional extras on intake forms' },
          { label: 'Specialty items', value: String(normalizeSpecialtyCatalog(s.specialtyCatalog, s.pricing).filter((item) => item.active).length), note: 'Shown on intake forms' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: '1px solid #d6dee8',
              borderRadius: 14,
              background: '#ffffff',
              padding: 16,
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {sectionTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            style={sectionButton(section === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {section === 'branding' && (
        <div style={sectionCard}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Brand & Contact</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These details show up on the public site for this processor. Plan tiers and feature access now live on the processor management page.
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
          <div style={{ fontSize: 13, color: '#475569' }}>
            Need to change plan tier, SMS access, Webbs access, or hostnames? Use <a href="/admin/processors" style={{ color: '#1d4ed8', fontWeight: 800 }}>Processor Management</a>.
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
            <div key={`${item.slug || 'new'}-${index}`} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
            Add optional extras to the intake form and control their pricing. Legacy workflow items like beef fat and Webbs can stay mapped here too.
          </div>
          {addOnDraftRows(s.addOnCatalog, s.pricing).map((item, index) => (
            <div key={`${item.slug || 'new'}-${index}`} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
              key={item.id || `${item.slug}-${index}`}
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
          }}
        >
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
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: msg === 'Saved' ? '#166534' : '#334155',
            }}
          >
            {msg}
          </div>
        </div>
      </div>
    </div>
  );
}
