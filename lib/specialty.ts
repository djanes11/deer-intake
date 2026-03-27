import { DEFAULT_SITE_PRICING, SitePricing, normalizePricing } from '@/lib/pricing';

export type SpecialtyFieldKey =
  | 'originalSummerSausageLbs'
  | 'summerSausageCheeseLbs'
  | 'jalapenoSummerSausageCheeseLbs'
  | 'originalSnackSticksLbs'
  | 'originalSnackSticksCheeseLbs'
  | 'jalapenoSnackSticksCheeseLbs';

export type SpecialtyItemDef = {
  key: SpecialtyFieldKey;
  dbKey: string;
  legacyDbKey?: string;
  label: string;
  shortLabel: string;
  category: 'summer' | 'snack';
};

export const SPECIALTY_ITEMS: SpecialtyItemDef[] = [
  {
    key: 'originalSummerSausageLbs',
    dbKey: 'original_summer_sausage_lbs',
    legacyDbKey: 'summer_sausage_lbs',
    label: 'Original Summer Sausage (lb)',
    shortLabel: 'Original SS',
    category: 'summer',
  },
  {
    key: 'summerSausageCheeseLbs',
    dbKey: 'summer_sausage_cheese_lbs',
    legacyDbKey: 'summer_sausage_cheese_lbs',
    label: 'Summer Sausage + Cheese (lb)',
    shortLabel: 'SS + Cheese',
    category: 'summer',
  },
  {
    key: 'jalapenoSummerSausageCheeseLbs',
    dbKey: 'jalapeno_summer_sausage_cheese_lbs',
    legacyDbKey: 'sliced_jerky_lbs',
    label: 'Jalapeno Summer Sausage + Cheddar (lb)',
    shortLabel: 'Jalapeno SS + Cheddar',
    category: 'summer',
  },
  {
    key: 'originalSnackSticksLbs',
    dbKey: 'original_snack_sticks_lbs',
    label: 'Original Snack Stix (lb)',
    shortLabel: 'Original Stix',
    category: 'snack',
  },
  {
    key: 'originalSnackSticksCheeseLbs',
    dbKey: 'original_snack_sticks_cheese_lbs',
    label: 'Original Snack Stix + Cheddar (lb)',
    shortLabel: 'Stix + Cheddar',
    category: 'snack',
  },
  {
    key: 'jalapenoSnackSticksCheeseLbs',
    dbKey: 'jalapeno_snack_sticks_cheese_lbs',
    label: 'Jalapeno Snack Stix + Cheddar (lb)',
    shortLabel: 'Jalapeno Stix + Cheddar',
    category: 'snack',
  },
];

function toNumber(v: unknown): number {
  const n =
    typeof v === 'number'
      ? v
      : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function specialtyValue(job: Record<string, any> | null | undefined, key: SpecialtyFieldKey): number {
  const item = SPECIALTY_ITEMS.find((x) => x.key === key);
  if (!item) return 0;
  return toNumber(job?.[item.key] ?? job?.[item.dbKey] ?? (item.legacyDbKey ? job?.[item.legacyDbKey] : undefined));
}

export function specialtyItemPrice(item: SpecialtyItemDef, pricingInput?: Partial<SitePricing> | null): number {
  const pricing = normalizePricing(pricingInput ?? DEFAULT_SITE_PRICING);
  return item.category === 'summer'
    ? pricing.summer_sausage_price_per_lb
    : pricing.snack_stix_price_per_lb;
}

export function specialtyBreakdown(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
) {
  return SPECIALTY_ITEMS.map((item) => ({
    ...item,
    pounds: specialtyValue(job, item.key),
    pricePerLb: specialtyItemPrice(item, pricingInput),
    total: specialtyValue(job, item.key) * specialtyItemPrice(item, pricingInput),
  }));
}

export function specialtyTotalLbs(job: Record<string, any> | null | undefined): number {
  return specialtyBreakdown(job).reduce((sum, item) => sum + item.pounds, 0);
}

export function specialtyPrice(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
): number {
  return specialtyBreakdown(job, pricingInput).reduce((sum, item) => sum + item.total, 0);
}

export function hasSpecialtySelection(job: Record<string, any> | null | undefined): boolean {
  return specialtyTotalLbs(job) > 0;
}
