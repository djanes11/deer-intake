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
  pricePerLb: number;
};

export const SPECIALTY_ITEMS: SpecialtyItemDef[] = [
  {
    key: 'originalSummerSausageLbs',
    dbKey: 'original_summer_sausage_lbs',
    legacyDbKey: 'summer_sausage_lbs',
    label: 'Original Summer Sausage (lb)',
    shortLabel: 'Original SS',
    pricePerLb: 5,
  },
  {
    key: 'summerSausageCheeseLbs',
    dbKey: 'summer_sausage_cheese_lbs',
    legacyDbKey: 'summer_sausage_cheese_lbs',
    label: 'Summer Sausage + Cheese (lb)',
    shortLabel: 'SS + Cheese',
    pricePerLb: 5,
  },
  {
    key: 'jalapenoSummerSausageCheeseLbs',
    dbKey: 'jalapeno_summer_sausage_cheese_lbs',
    legacyDbKey: 'sliced_jerky_lbs',
    label: 'Jalapeno Summer Sausage + Cheddar (lb)',
    shortLabel: 'Jalapeno SS + Cheddar',
    pricePerLb: 5,
  },
  {
    key: 'originalSnackSticksLbs',
    dbKey: 'original_snack_sticks_lbs',
    label: 'Original Snack Stix (lb)',
    shortLabel: 'Original Stix',
    pricePerLb: 8,
  },
  {
    key: 'originalSnackSticksCheeseLbs',
    dbKey: 'original_snack_sticks_cheese_lbs',
    label: 'Original Snack Stix + Cheddar (lb)',
    shortLabel: 'Stix + Cheddar',
    pricePerLb: 8,
  },
  {
    key: 'jalapenoSnackSticksCheeseLbs',
    dbKey: 'jalapeno_snack_sticks_cheese_lbs',
    label: 'Jalapeno Snack Stix + Cheddar (lb)',
    shortLabel: 'Jalapeno Stix + Cheddar',
    pricePerLb: 8,
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

export function specialtyBreakdown(job: Record<string, any> | null | undefined) {
  return SPECIALTY_ITEMS.map((item) => ({
    ...item,
    pounds: specialtyValue(job, item.key),
    total: specialtyValue(job, item.key) * item.pricePerLb,
  }));
}

export function specialtyTotalLbs(job: Record<string, any> | null | undefined): number {
  return specialtyBreakdown(job).reduce((sum, item) => sum + item.pounds, 0);
}

export function specialtyPrice(job: Record<string, any> | null | undefined): number {
  return specialtyBreakdown(job).reduce((sum, item) => sum + item.total, 0);
}

export function hasSpecialtySelection(job: Record<string, any> | null | undefined): boolean {
  return specialtyTotalLbs(job) > 0;
}
