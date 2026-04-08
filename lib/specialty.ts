import { DEFAULT_SITE_PRICING, SitePricing, normalizePricing } from '@/lib/pricing';
import {
  defaultSpecialtyCatalog,
  JobSpecialtyItem,
  normalizeJobSpecialtyItems,
  normalizeSpecialtyCatalog,
  SpecialtyCatalogItem,
  SpecialtyLegacyFieldKey,
} from '@/lib/specialtyCatalog';

export type SpecialtyFieldKey = SpecialtyLegacyFieldKey;
export type SpecialtyItemDef = SpecialtyCatalogItem & {
  key: string;
  label: string;
  shortLabel: string;
  category: 'summer' | 'snack' | 'custom';
  dbKey?: string;
  legacyDbKey?: string;
};

function toNumber(v: unknown): number {
  const n =
    typeof v === 'number'
      ? v
      : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function legacyValue(job: Record<string, any> | null | undefined, key: SpecialtyLegacyFieldKey): number {
  switch (key) {
    case 'originalSummerSausageLbs':
      return toNumber(job?.originalSummerSausageLbs ?? job?.original_summer_sausage_lbs ?? job?.summer_sausage_lbs);
    case 'summerSausageCheeseLbs':
      return toNumber(job?.summerSausageCheeseLbs ?? job?.summer_sausage_cheese_lbs);
    case 'jalapenoSummerSausageCheeseLbs':
      return toNumber(job?.jalapenoSummerSausageCheeseLbs ?? job?.jalapeno_summer_sausage_cheese_lbs ?? job?.sliced_jerky_lbs);
    case 'originalSnackSticksLbs':
      return toNumber(job?.originalSnackSticksLbs ?? job?.original_snack_sticks_lbs);
    case 'originalSnackSticksCheeseLbs':
      return toNumber(job?.originalSnackSticksCheeseLbs ?? job?.original_snack_sticks_cheese_lbs);
    case 'jalapenoSnackSticksCheeseLbs':
      return toNumber(job?.jalapenoSnackSticksCheeseLbs ?? job?.jalapeno_snack_sticks_cheese_lbs);
    default:
      return 0;
  }
}

function categoryForItem(item: SpecialtyCatalogItem): 'summer' | 'snack' | 'custom' {
  const text = `${item.slug} ${item.name}`.toLowerCase();
  if (text.includes('summer')) return 'summer';
  if (text.includes('stix') || text.includes('stick')) return 'snack';
  return 'custom';
}

function catalogToDisplayItem(item: SpecialtyCatalogItem): SpecialtyItemDef {
  return {
    ...item,
    key: item.slug,
    label: item.name,
    shortLabel: item.shortName,
    category: categoryForItem(item),
  };
}

export function specialtyCatalog(
  catalogInput?: SpecialtyCatalogItem[] | null,
  pricingInput?: Partial<SitePricing> | null,
): SpecialtyItemDef[] {
  return normalizeSpecialtyCatalog(catalogInput ?? defaultSpecialtyCatalog(pricingInput), pricingInput).map(catalogToDisplayItem);
}

export function specialtySelections(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
): JobSpecialtyItem[] {
  const direct = normalizeJobSpecialtyItems(job?.specialtyItems ?? job?.specialty_items);
  if (direct.length) return direct;

  const catalog = specialtyCatalog(catalogInput, pricingInput);
  return catalog
    .map((item) => {
      const quantity = item.legacyFieldKey ? legacyValue(job, item.legacyFieldKey) : 0;
      return {
        catalogId: item.id ?? null,
        slug: item.slug,
        name: item.name,
        shortName: item.shortName,
        unit: item.unit,
        priceType: item.priceType,
        quantity,
        pricePerUnit: item.price,
        total: quantity * item.price,
        sortOrder: item.sortOrder,
        legacyFieldKey: item.legacyFieldKey,
      } satisfies JobSpecialtyItem;
    })
    .filter((item) => item.quantity > 0);
}

export function specialtyValue(
  job: Record<string, any> | null | undefined,
  key: string,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
): number {
  const matched = specialtySelections(job, pricingInput, catalogInput).find(
    (item) => item.slug === key || item.legacyFieldKey === key,
  );
  return matched?.quantity ?? 0;
}

export function specialtyItemPrice(
  item: SpecialtyCatalogItem | JobSpecialtyItem,
  pricingInput?: Partial<SitePricing> | null,
): number {
  if ('pricePerUnit' in item) return toNumber(item.pricePerUnit);
  if (Number.isFinite(Number(item.price))) return Number(item.price);
  const pricing = normalizePricing(pricingInput ?? DEFAULT_SITE_PRICING);
  return categoryForItem(item) === 'summer'
    ? pricing.summer_sausage_price_per_lb
    : pricing.snack_stix_price_per_lb;
}

export function specialtyBreakdown(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
) {
  const selected = specialtySelections(job, pricingInput, catalogInput);
  const catalog = specialtyCatalog(catalogInput, pricingInput);
  const bySlug = new Map(selected.map((item) => [item.slug, item]));

  return catalog.map((item) => {
    const selectedItem = bySlug.get(item.slug);
    const pounds = selectedItem?.quantity ?? 0;
    const pricePerLb = selectedItem?.pricePerUnit ?? specialtyItemPrice(item, pricingInput);
    return {
      ...item,
      pounds,
      quantity: pounds,
      pricePerLb,
      pricePerUnit: pricePerLb,
      total: selectedItem?.total ?? pounds * pricePerLb,
    };
  });
}

export function specialtyTotalLbs(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
): number {
  return specialtySelections(job, pricingInput, catalogInput).reduce((sum, item) => sum + item.quantity, 0);
}

export function specialtyPrice(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
): number {
  return specialtySelections(job, pricingInput, catalogInput).reduce((sum, item) => sum + item.total, 0);
}

export function hasSpecialtySelection(
  job: Record<string, any> | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
  catalogInput?: SpecialtyCatalogItem[] | null,
): boolean {
  return specialtySelections(job, pricingInput, catalogInput).length > 0;
}
