import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { SITE } from '@/lib/config';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import type { CutOptionSettings } from '@/lib/cutOptions';
import { DEFAULT_SITE_PRICING, normalizePricing } from '@/lib/pricing';
import type { SitePricing } from '@/lib/pricing';
import { defaultSpecialtyCatalog, getProcessorSpecialtyCatalog } from '@/lib/specialtyCatalog';
import type { SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import {
  defaultAddOnCatalog,
  defaultNotificationTemplates,
  defaultProcessCatalog,
  normalizeAddOnCatalog,
  normalizeNotificationTemplates,
  normalizeProcessCatalog,
} from '@/lib/processorCatalog';
import type {
  AddOnCatalogItem,
  NotificationTemplateSet,
  ProcessTypeCatalogItem,
} from '@/lib/processorCatalog';
import { getDefaultProcessorContext, getProcessorContextForHostname, type ProcessorContext } from '@/lib/processorContext';
import { normalizeStateFormType } from '@/lib/stateforms/catalog';
import type { StateFormType } from '@/lib/stateforms/types';

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
  scanEnabled: boolean;
  capeScanEnabled: boolean;
  specialtyEnabled: boolean;
};

export type PublicFaqItem = {
  question: string;
  answer: string;
};

export type PublicCopySettings = {
  homeHeadline: string;
  homeIntro: string;
  homeHowItWorks: string[];
  pricingNote: string;
  beforeDropoffChecklist: string[];
  intakeHighlights: string[];
  reviewChecklist: string[];
  customerInfoIntro: string;
  confirmationLabel: string;
  confirmationPlaceholder: string;
  confirmationHelpText: string;
  confirmationValidation: 'exact_13' | 'digits_only' | 'freeform';
  turnaroundEstimate: string;
  acceptedPaymentMethods: Array<'cash' | 'card' | 'check' | 'other'>;
  callBeforePickup: boolean;
  storageFeeStartsAfterDays: number;
  storageFeePolicy: string;
  pickupInstructions: string;
  thankYouMessage: string;
  statusIntro: string;
  statusBestWay: string;
  statusLookupHelp: string;
  confirmationSearchHelp: string;
  tagLabel: string;
  tagPlaceholder: string;
  tagFormat: 'digits_only' | 'letters_numbers';
  tagMinLength: number;
  startingTagNumber: string;
  tagSearchHelp: string;
  faqItems: PublicFaqItem[];
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
  publicCopy: PublicCopySettings;
  updated_at?: string | null;
};

export function normalizeProcessorFeatures(raw: any): ProcessorFeatureSettings {
  const plan: ProcessorFeatureSettings['plan'] =
    raw?.plan === 'basic' || raw?.plan === 'texting' || raw?.plan === 'custom'
      ? raw.plan
      : 'basic';

  if (plan === 'basic') {
    return {
      plan,
      smsEnabled: false,
      webbsEnabled: false,
      scanEnabled: raw?.scanEnabled !== false,
      capeScanEnabled: raw?.scanEnabled === false ? false : raw?.capeScanEnabled !== false,
      specialtyEnabled: raw?.specialtyEnabled !== false,
    };
  }
  if (plan === 'texting') {
    return {
      plan,
      smsEnabled: true,
      webbsEnabled: false,
      scanEnabled: raw?.scanEnabled !== false,
      capeScanEnabled: raw?.scanEnabled === false ? false : raw?.capeScanEnabled !== false,
      specialtyEnabled: raw?.specialtyEnabled !== false,
    };
  }
  return {
    plan,
    smsEnabled: true,
    webbsEnabled: raw?.webbsEnabled !== false,
    scanEnabled: raw?.scanEnabled !== false,
    capeScanEnabled: raw?.scanEnabled === false ? false : raw?.capeScanEnabled !== false,
    specialtyEnabled: raw?.specialtyEnabled !== false,
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
    publicCopy: {
      homeHeadline: 'Professional wild game processing, with a cleaner customer experience.',
      homeIntro: 'Submit your intake, choose your cuts, and check status online without guessing what happens next.',
      homeHowItWorks: [
        'Use the public intake form before or during drop-off so the shop has your information and cut selections right away.',
        'Include your state confirmation number and leave your deer with your name and phone details for easy matching.',
        'Staff assigns the permanent tag, reviews your order, and updates status as work moves forward.',
        'Check status online anytime and pick up promptly once you are notified.',
      ],
      pricingNote:
        'Final totals can vary with cut selections, specialty items, and processor-specific options. Customers can review their selections before submitting.',
      beforeDropoffChecklist: [
        'Have your state harvest/check-in confirmation number ready',
        'Leave your name, phone number, and confirmation details with the deer',
        'Staff will assign the permanent deer tag after reviewing the intake',
      ],
      intakeHighlights: [
        'Complete this before leaving your deer so the shop has your cuts and contact details right away.',
        'Staff will assign the permanent deer tag after reviewing the drop-off.',
      ],
      reviewChecklist: [
        'Customer name and state confirmation number match',
        'Drop-off details and process type are correct',
        'Cuts, specialty items, and contact preference look right',
      ],
      customerInfoIntro:
        'Fill in your state confirmation number, your name, and the best phone number to reach you. Then finish your address so staff can match your deer quickly.',
      confirmationLabel: 'Confirmation #',
      confirmationPlaceholder: 'State confirmation #',
      confirmationHelpText: 'Use the confirmation number from your state harvest/check-in system.',
      confirmationValidation: 'exact_13',
      turnaroundEstimate: 'Turnaround time depends on season volume and the cuts you choose. The shop will contact you when your order is ready.',
      acceptedPaymentMethods: ['cash', 'check', 'card'],
      callBeforePickup: false,
      storageFeeStartsAfterDays: 0,
      storageFeePolicy: '',
      pickupInstructions:
        'Leave a note with your full name, phone number, and the last 5 digits of your confirmation number attached to the deer.',
      thankYouMessage:
        'Save or screenshot this confirmation number before you close this page. You will need it to check your status until staff assign your deer tag.',
      statusIntro:
        'Use your confirmation number, or use your deer tag and last name after staff have assigned the real tag. This page updates as your order moves through the shop.',
      statusBestWay:
        'Confirmation number works best before staff assign the permanent tag. After the tag is assigned, you can also search with the tag number and customer last name.',
      statusLookupHelp:
        'Most customers should start with the confirmation number. Only use tag number + last name after staff have assigned the permanent tag.',
      confirmationSearchHelp:
        'Best for most customers. Use the number from your intake or state harvest/check-in.',
      tagLabel: 'Tag Number',
      tagPlaceholder: 'Deer tag number',
      tagFormat: 'digits_only',
      tagMinLength: 5,
      startingTagNumber: '1000',
      tagSearchHelp:
        'Only use this after staff have assigned the real deer tag.',
      faqItems: [
        {
          question: 'How do I use the Public Intake Form?',
          answer: 'Open the public intake form, fill in the steps from top to bottom, and save your confirmation number when you finish.',
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
    },
    updated_at: null,
  };
}

export function normalizePublicCopy(input: any): PublicCopySettings {
  const defaults = defaultPublicSiteSettings().publicCopy;
  const normalizeLines = (value: unknown, fallback: string[]) => {
    if (!Array.isArray(value)) return fallback;
    const rows = value.map((item) => String(item || '').trim()).filter(Boolean);
    return rows.length ? rows : fallback;
  };
  const faqItems = Array.isArray(input?.faqItems)
    ? input.faqItems
        .map((item: any) => ({
          question: String(item?.question || '').trim(),
          answer: String(item?.answer || '').trim(),
        }))
        .filter((item: PublicFaqItem) => item.question && item.answer)
    : defaults.faqItems;

  return {
    homeHeadline: String(input?.homeHeadline || '').trim() || defaults.homeHeadline,
    homeIntro: String(input?.homeIntro || '').trim() || defaults.homeIntro,
    homeHowItWorks: normalizeLines(input?.homeHowItWorks, defaults.homeHowItWorks),
    pricingNote: String(input?.pricingNote || '').trim() || defaults.pricingNote,
    beforeDropoffChecklist: normalizeLines(input?.beforeDropoffChecklist, defaults.beforeDropoffChecklist),
    intakeHighlights: normalizeLines(input?.intakeHighlights, defaults.intakeHighlights),
    reviewChecklist: normalizeLines(input?.reviewChecklist, defaults.reviewChecklist),
    customerInfoIntro: String(input?.customerInfoIntro || '').trim() || defaults.customerInfoIntro,
    confirmationLabel: String(input?.confirmationLabel || '').trim() || defaults.confirmationLabel,
    confirmationPlaceholder: String(input?.confirmationPlaceholder || '').trim() || defaults.confirmationPlaceholder,
    confirmationHelpText: String(input?.confirmationHelpText || '').trim() || defaults.confirmationHelpText,
    confirmationValidation:
      input?.confirmationValidation === 'digits_only' || input?.confirmationValidation === 'freeform'
        ? input.confirmationValidation
        : defaults.confirmationValidation,
    turnaroundEstimate: String(input?.turnaroundEstimate || '').trim() || defaults.turnaroundEstimate,
    acceptedPaymentMethods: (() => {
      if (!Array.isArray(input?.acceptedPaymentMethods)) return defaults.acceptedPaymentMethods;
      const methods = input.acceptedPaymentMethods
        .map((item: any) => String(item || '').trim().toLowerCase())
        .filter((item: string) => ['cash', 'card', 'check', 'other'].includes(item)) as PublicCopySettings['acceptedPaymentMethods'];
      return methods.length ? methods : defaults.acceptedPaymentMethods;
    })(),
    callBeforePickup: !!input?.callBeforePickup,
    storageFeeStartsAfterDays: Math.max(0, Math.min(60, Number(input?.storageFeeStartsAfterDays || 0) || 0)),
    storageFeePolicy: String(input?.storageFeePolicy || '').trim(),
    pickupInstructions: String(input?.pickupInstructions || '').trim() || defaults.pickupInstructions,
    thankYouMessage: String(input?.thankYouMessage || '').trim() || defaults.thankYouMessage,
    statusIntro: String(input?.statusIntro || '').trim() || defaults.statusIntro,
    statusBestWay: String(input?.statusBestWay || '').trim() || defaults.statusBestWay,
    statusLookupHelp: String(input?.statusLookupHelp || '').trim() || defaults.statusLookupHelp,
    confirmationSearchHelp: String(input?.confirmationSearchHelp || '').trim() || defaults.confirmationSearchHelp,
    tagLabel: String(input?.tagLabel || '').trim() || defaults.tagLabel,
    tagPlaceholder: String(input?.tagPlaceholder || '').trim() || defaults.tagPlaceholder,
    tagFormat: input?.tagFormat === 'letters_numbers' ? 'letters_numbers' : defaults.tagFormat,
    tagMinLength: Math.min(12, Math.max(1, Number(input?.tagMinLength || defaults.tagMinLength) || defaults.tagMinLength)),
    startingTagNumber: String(input?.startingTagNumber || '').trim() || defaults.startingTagNumber,
    tagSearchHelp: String(input?.tagSearchHelp || '').trim() || defaults.tagSearchHelp,
    faqItems: faqItems.length ? faqItems : defaults.faqItems,
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

export async function getPublicSiteSettings(
  hostname?: string | null,
  processorOverride?: ProcessorContext | null
): Promise<PublicSiteSettings> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return defaultPublicSiteSettings();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const requestHostname = hostname || (processorOverride ? '' : await getRequestHostname());
    const processor = processorOverride
      ? processorOverride
      : requestHostname
      ? await getProcessorContextForHostname(requestHostname)
      : await getDefaultProcessorContext();
    let query = supabase
      .from('site_settings')
      .select('public_intake_enabled,banner_enabled,banner_message,hours,updated_at,standard_processing_price,caped_price,cape_donate_price,beef_fat_add_on,webbs_add_on,summer_sausage_price_per_lb,snack_stix_price_per_lb,process_catalog,add_on_catalog,notification_templates,cut_option_settings,state_form_type,public_copy');

    query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);

    const { data, error } = await query.single();

    if (error || !data) return defaultPublicSiteSettings();

    let branding = defaultPublicSiteSettings().branding;
    let features = defaultPublicSiteSettings().features;
    const pricing = normalizePricing(data);
    let processCatalog = normalizeProcessCatalog((data as any).process_catalog, pricing);
    let addOnCatalog = normalizeAddOnCatalog((data as any).add_on_catalog, pricing);
    let specialtyCatalog = await getProcessorSpecialtyCatalog(processor.id, pricing);
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
        if (features.specialtyEnabled === false) {
          specialtyCatalog = [];
        }
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
      publicCopy: normalizePublicCopy((data as any).public_copy),
      updated_at: data.updated_at ?? null,
    };
  } catch {
    return defaultPublicSiteSettings();
  }
}
