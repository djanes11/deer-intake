import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { SITE } from '@/lib/config';
import { CutOptionSettings, normalizeCutOptionSettings } from '@/lib/cutOptions';
import { DEFAULT_SITE_PRICING, SitePricing, normalizePricing } from '@/lib/pricing';
import { defaultSpecialtyCatalog, getProcessorSpecialtyCatalog, SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import {
  AddOnCatalogItem,
  defaultAddOnCatalog,
  defaultNotificationTemplates,
  defaultProcessCatalog,
  normalizeAddOnCatalog,
  normalizeNotificationTemplates,
  normalizeProcessCatalog,
  NotificationTemplateSet,
  ProcessTypeCatalogItem,
} from '@/lib/processorCatalog';
import { getDefaultProcessorContext, getProcessorContextForHostname } from '@/lib/processorContext';
import { normalizeStateFormType } from '@/lib/stateforms/catalog';
import { StateFormType } from '@/lib/stateforms/types';

export type PublicHourRow = {
  label: string;
  value: string;
};

export type PublicBrandingSettings = {
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

export type ProcessorFeatureSettings = {
  plan: 'basic' | 'texting' | 'custom';
  smsEnabled: boolean;
  webbsEnabled: boolean;
};

export type PublicSiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: PublicHourRow[];
  pricing: SitePricing;
  processCatalog: ProcessTypeCatalogItem[];
  addOnCatalog: AddOnCatalogItem[];
  specialtyCatalog: SpecialtyCatalogItem[];
  notificationTemplates: NotificationTemplateSet;
  branding: PublicBrandingSettings;
  features: ProcessorFeatureSettings;
  cutOptions: CutOptionSettings;
  stateFormType: StateFormType;
  updated_at?: string | null;
};

export function normalizeProcessorFeatures(raw: any): ProcessorFeatureSettings {
  const plan: ProcessorFeatureSettings['plan'] =
    raw?.plan === 'basic' || raw?.plan === 'texting' || raw?.plan === 'custom'
      ? raw.plan
      : 'basic';

  if (plan === 'basic') {
    return { plan, smsEnabled: false, webbsEnabled: false };
  }
  if (plan === 'texting') {
    return { plan, smsEnabled: true, webbsEnabled: false };
  }
  return {
    plan,
    smsEnabled: true,
    webbsEnabled: raw?.webbsEnabled !== false,
  };
}

function fallbackHours(): PublicHourRow[] {
  return Array.isArray(SITE.hours)
    ? SITE.hours.map((h) => ({ label: String(h.label || ''), value: String(h.value || '') }))
    : [];
}

export function normalizeHours(input: unknown): PublicHourRow[] {
  if (!Array.isArray(input)) return fallbackHours();
  const hours = input
    .map((row: any) => ({
      label: String(row?.label || '').trim(),
      value: String(row?.value || '').trim(),
    }))
    .filter((row) => row.label || row.value);
  return hours.length ? hours : fallbackHours();
}

export function defaultPublicSiteSettings(): PublicSiteSettings {
  return {
    public_intake_enabled: true,
    banner_enabled: false,
    banner_message: '',
    hours: fallbackHours(),
    pricing: DEFAULT_SITE_PRICING,
    processCatalog: defaultProcessCatalog(DEFAULT_SITE_PRICING),
    addOnCatalog: defaultAddOnCatalog(DEFAULT_SITE_PRICING),
    specialtyCatalog: defaultSpecialtyCatalog(DEFAULT_SITE_PRICING),
    notificationTemplates: defaultNotificationTemplates(String(SITE.name || 'Game Butcher Board')),
    branding: {
      name: String(SITE.name || 'Game Butcher Board'),
      locationLabel: String((SITE as any).locationLabel || ''),
      tagline: String((SITE as any).publicTagline || ''),
      logoUrl: String((SITE as any).logoUrl || '/wgbb-logo.png'),
      phoneDisplay: String(SITE.phone || ''),
      phoneE164: String((SITE as any).phoneE164 || ''),
      email: '',
      address: String(SITE.address || ''),
      mapsUrl: String(SITE.mapsUrl || ''),
    },
    features: {
      ...normalizeProcessorFeatures({ plan: 'custom', smsEnabled: true, webbsEnabled: true }),
    },
    cutOptions: normalizeCutOptionSettings({}),
    stateFormType: 'indiana',
    updated_at: null,
  };
}

async function getRequestHostname() {
  try {
    const h = await headers();
    return h.get('x-forwarded-host') || h.get('host') || '';
  } catch {
    return '';
  }
}

export async function getPublicSiteSettings(hostname?: string | null): Promise<PublicSiteSettings> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return defaultPublicSiteSettings();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const processor = hostname
      ? await getProcessorContextForHostname(hostname)
      : await getDefaultProcessorContext();
    let query = supabase
      .from('site_settings')
      .select('public_intake_enabled,banner_enabled,banner_message,hours,updated_at,standard_processing_price,caped_price,cape_donate_price,beef_fat_add_on,webbs_add_on,summer_sausage_price_per_lb,snack_stix_price_per_lb,process_catalog,add_on_catalog,notification_templates,cut_option_settings,state_form_type');

    query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);

    const { data, error } = await query.single();

    if (error || !data) return defaultPublicSiteSettings();

    let branding = defaultPublicSiteSettings().branding;
    let features = defaultPublicSiteSettings().features;
    const pricing = normalizePricing(data);
    let processCatalog = normalizeProcessCatalog((data as any).process_catalog, pricing);
    let addOnCatalog = normalizeAddOnCatalog((data as any).add_on_catalog, pricing);
    const specialtyCatalog = await getProcessorSpecialtyCatalog(processor.id, pricing);
    let notificationTemplates = normalizeNotificationTemplates((data as any).notification_templates, branding.name);
    if (processor.id) {
      const { data: processorRow, error: processorError } = await supabase
        .from('processors')
        .select('name,public_name,public_tagline,logo_url,support_phone_display,support_phone_e164,support_email,public_address,public_maps_url,location_label,features')
        .eq('id', processor.id)
        .maybeSingle();

      if (!processorError && processorRow) {
        branding = {
          name: String(processorRow.public_name || processorRow.name || branding.name),
          locationLabel: String(processorRow.location_label || branding.locationLabel),
          tagline: String(processorRow.public_tagline || branding.tagline),
          logoUrl: String(processorRow.logo_url || branding.logoUrl),
          phoneDisplay: String(processorRow.support_phone_display || branding.phoneDisplay),
          phoneE164: String(processorRow.support_phone_e164 || branding.phoneE164),
          email: String(processorRow.support_email || branding.email),
          address: String(processorRow.public_address || branding.address),
          mapsUrl: String(processorRow.public_maps_url || branding.mapsUrl),
        };
        const rawFeatures = (processorRow as any).features || {};
        features = normalizeProcessorFeatures(rawFeatures);
        addOnCatalog = normalizeAddOnCatalog(
          addOnCatalog.map((item) =>
            item.legacyBooleanKey === 'webbsOrder' ? { ...item, active: item.active && features.webbsEnabled } : item
          ),
          pricing,
        );
        notificationTemplates = normalizeNotificationTemplates((data as any).notification_templates, branding.name);
      }
    }

    return {
      public_intake_enabled: !!data.public_intake_enabled,
      banner_enabled: !!data.banner_enabled,
      banner_message: String(data.banner_message || ''),
      hours: normalizeHours(data.hours),
      pricing,
      processCatalog,
      addOnCatalog,
      specialtyCatalog,
      notificationTemplates,
      branding,
      features,
      cutOptions: normalizeCutOptionSettings((data as any).cut_option_settings),
      stateFormType: normalizeStateFormType((data as any).state_form_type),
      updated_at: data.updated_at ?? null,
    };
  } catch {
    return defaultPublicSiteSettings();
  }
}
