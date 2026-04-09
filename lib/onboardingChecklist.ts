import { normalizeStateFormType } from '@/lib/stateforms/catalog';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import { normalizePricing } from '@/lib/pricing';
import { normalizeAddOnCatalog, normalizeProcessCatalog } from '@/lib/processorCatalog';
import { normalizeSpecialtyCatalog } from '@/lib/specialtyCatalog';

export type OnboardingChecklistKey =
  | 'hostnames'
  | 'first_admin'
  | 'branding'
  | 'pricing'
  | 'offerings'
  | 'state_form';

export type OnboardingChecklistItem = {
  key: OnboardingChecklistKey;
  label: string;
  done: boolean;
  note: string;
};

export type OnboardingChecklistSummary = {
  readyCount: number;
  totalCount: number;
  readyToGoLive: boolean;
  items: OnboardingChecklistItem[];
};

type ChecklistInput = {
  publicHostname?: string | null;
  staffHostname?: string | null;
  adminCount?: number | null;
  processor?: {
    publicName?: string | null;
    supportPhoneDisplay?: string | null;
    publicAddress?: string | null;
  } | null;
  siteSettings?: any;
};

export function buildOnboardingChecklist(input: ChecklistInput): OnboardingChecklistSummary {
  const pricing = normalizePricing(input.siteSettings || {});
  const processCatalog = normalizeProcessCatalog((input.siteSettings as any)?.process_catalog, pricing);
  const addOnCatalog = normalizeAddOnCatalog((input.siteSettings as any)?.add_on_catalog, pricing);
  const specialtyCatalog = normalizeSpecialtyCatalog((input.siteSettings as any)?.specialty_catalog, pricing);
  const stateFormType = normalizeStateFormType((input.siteSettings as any)?.state_form_type);
  const cutOptions = normalizeCutOptionSettings((input.siteSettings as any)?.cut_option_settings);

  const publicHostname = String(input.publicHostname || '').trim();
  const staffHostname = String(input.staffHostname || '').trim();
  const adminCount = Number(input.adminCount || 0);
  const publicName = String(input.processor?.publicName || '').trim();
  const supportPhoneDisplay = String(input.processor?.supportPhoneDisplay || '').trim();
  const publicAddress = String(input.processor?.publicAddress || '').trim();

  const activeProcessCount = processCatalog.filter((item) => item.active).length;
  const activeSpecialtyCount = specialtyCatalog.filter((item) => item.active).length;
  const visibleAddOnCount = addOnCatalog.filter((item) => item.active).length;
  const hasPricing =
    Number(pricing.standard_processing_price || 0) > 0 &&
    Number(pricing.caped_price || 0) > 0 &&
    Number(pricing.cape_donate_price || 0) > 0;

  const items: OnboardingChecklistItem[] = [
    {
      key: 'hostnames',
      label: 'Hostnames ready',
      done: !!publicHostname && !!staffHostname,
      note: !!publicHostname && !!staffHostname
        ? `${publicHostname} and ${staffHostname}`
        : 'Set both public and staff hostnames',
    },
    {
      key: 'first_admin',
      label: 'First admin assigned',
      done: adminCount > 0,
      note: adminCount > 0 ? `${adminCount} admin login${adminCount === 1 ? '' : 's'} attached` : 'Create or attach a processor admin',
    },
    {
      key: 'branding',
      label: 'Branding filled out',
      done: !!publicName && !!supportPhoneDisplay && !!publicAddress,
      note: !!publicName && !!supportPhoneDisplay && !!publicAddress
        ? 'Public name, phone, and address are set'
        : 'Finish public name, phone, and address',
    },
    {
      key: 'pricing',
      label: 'Pricing configured',
      done: hasPricing,
      note: hasPricing ? 'Base pricing is set' : 'Set processing, caped, and cape-donate pricing',
    },
    {
      key: 'offerings',
      label: 'Offerings configured',
      done: activeProcessCount > 0 && activeSpecialtyCount > 0,
      note:
        activeProcessCount > 0 && activeSpecialtyCount > 0
          ? `${activeProcessCount} process types, ${activeSpecialtyCount} specialty items, ${visibleAddOnCount} add-ons`
          : 'Review process types, specialty items, and add-ons',
    },
    {
      key: 'state_form',
      label: 'State form selected',
      done: !!stateFormType,
      note: `${stateFormType.charAt(0).toUpperCase()}${stateFormType.slice(1)} form selected${cutOptions.showRoastCounts ? '' : ''}`,
    },
  ];

  const readyCount = items.filter((item) => item.done).length;
  return {
    readyCount,
    totalCount: items.length,
    readyToGoLive: readyCount === items.length,
    items,
  };
}
