import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SITE_PRICING, normalizePricing } from '@/lib/pricing';
import type { SitePricing } from '@/lib/pricing';

export type SpecialtyLegacyFieldKey =
  | 'originalSummerSausageLbs'
  | 'summerSausageCheeseLbs'
  | 'jalapenoSummerSausageCheeseLbs'
  | 'originalSnackSticksLbs'
  | 'originalSnackSticksCheeseLbs'
  | 'jalapenoSnackSticksCheeseLbs';

export type SpecialtyCatalogItem = {
  id?: string | null;
  slug: string;
  name: string;
  shortName: string;
  unit: 'lb';
  priceType: 'per_lb';
  price: number;
  active: boolean;
  sortOrder: number;
  legacyFieldKey?: SpecialtyLegacyFieldKey | null;
};

export type JobSpecialtyItem = {
  id?: string | null;
  catalogId?: string | null;
  slug: string;
  name: string;
  shortName: string;
  unit: 'lb';
  priceType: 'per_lb';
  quantity: number;
  pricePerUnit: number;
  total: number;
  sortOrder: number;
  legacyFieldKey?: SpecialtyLegacyFieldKey | null;
};

const DEFAULT_LEGACY_ITEMS: Array<{
  slug: string;
  name: string;
  shortName: string;
  category: 'summer' | 'snack';
  sortOrder: number;
  legacyFieldKey: SpecialtyLegacyFieldKey;
}> = [
  {
    slug: 'original-summer-sausage',
    name: 'Original Summer Sausage',
    shortName: 'Original SS',
    category: 'summer',
    sortOrder: 10,
    legacyFieldKey: 'originalSummerSausageLbs',
  },
  {
    slug: 'summer-sausage-cheese',
    name: 'Summer Sausage + Cheese',
    shortName: 'SS + Cheese',
    category: 'summer',
    sortOrder: 20,
    legacyFieldKey: 'summerSausageCheeseLbs',
  },
  {
    slug: 'jalapeno-summer-sausage-cheese',
    name: 'Jalapeno Summer Sausage + Cheddar',
    shortName: 'Jalapeno SS + Cheddar',
    category: 'summer',
    sortOrder: 30,
    legacyFieldKey: 'jalapenoSummerSausageCheeseLbs',
  },
  {
    slug: 'original-snack-stix',
    name: 'Original Snack Stix',
    shortName: 'Original Stix',
    category: 'snack',
    sortOrder: 40,
    legacyFieldKey: 'originalSnackSticksLbs',
  },
  {
    slug: 'original-snack-stix-cheese',
    name: 'Original Snack Stix + Cheddar',
    shortName: 'Stix + Cheddar',
    category: 'snack',
    sortOrder: 50,
    legacyFieldKey: 'originalSnackSticksCheeseLbs',
  },
  {
    slug: 'jalapeno-snack-stix-cheese',
    name: 'Jalapeno Snack Stix + Cheddar',
    shortName: 'Jalapeno Stix + Cheddar',
    category: 'snack',
    sortOrder: 60,
    legacyFieldKey: 'jalapenoSnackSticksCheeseLbs',
  },
];

function money(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function defaultSpecialtyCatalog(pricingInput?: Partial<SitePricing> | null): SpecialtyCatalogItem[] {
  const pricing = normalizePricing(pricingInput ?? DEFAULT_SITE_PRICING);
  return DEFAULT_LEGACY_ITEMS.map((item) => ({
    slug: item.slug,
    name: item.name,
    shortName: item.shortName,
    unit: 'lb',
    priceType: 'per_lb',
    price:
      item.category === 'summer'
        ? pricing.summer_sausage_price_per_lb
        : pricing.snack_stix_price_per_lb,
    active: true,
    sortOrder: item.sortOrder,
    legacyFieldKey: item.legacyFieldKey,
  }));
}

export function normalizeSpecialtyCatalog(
  input: unknown,
  pricingInput?: Partial<SitePricing> | null,
): SpecialtyCatalogItem[] {
  if (!Array.isArray(input) || !input.length) {
    return defaultSpecialtyCatalog(pricingInput);
  }

  const normalized = input
    .map((raw: any, index) => ({
      id: raw?.id ? String(raw.id) : null,
      slug: String(raw?.slug || raw?.key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      name: String(raw?.name || raw?.label || '').trim(),
      shortName: String(raw?.shortName || raw?.short_label || raw?.name || raw?.label || '').trim(),
      unit: 'lb' as const,
      priceType: 'per_lb' as const,
      price: money(raw?.price, 0),
      active: raw?.active !== false,
      sortOrder: Number.isFinite(Number(raw?.sortOrder)) ? Number(raw.sortOrder) : (index + 1) * 10,
      legacyFieldKey: raw?.legacyFieldKey ? String(raw.legacyFieldKey) as SpecialtyLegacyFieldKey : null,
    }))
    .filter((item) => item.slug && item.name);

  return normalized.length
    ? normalized.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    : defaultSpecialtyCatalog(pricingInput);
}

export function normalizeJobSpecialtyItems(input: unknown): JobSpecialtyItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw: any, index) => {
      const quantity = money(raw?.quantity ?? raw?.pounds, 0);
      const pricePerUnit = money(raw?.pricePerUnit ?? raw?.unit_price ?? raw?.price, 0);
      return {
        id: raw?.id ? String(raw.id) : null,
        catalogId: raw?.catalogId ? String(raw.catalogId) : raw?.processor_specialty_item_id ? String(raw.processor_specialty_item_id) : null,
        slug: String(raw?.slug || raw?.item_slug || raw?.key || '').trim(),
        name: String(raw?.name || raw?.item_name || raw?.label || '').trim(),
        shortName: String(raw?.shortName || raw?.short_name || raw?.name || raw?.item_name || '').trim(),
        unit: 'lb' as const,
        priceType: 'per_lb' as const,
        quantity,
        pricePerUnit,
        total: money(raw?.total ?? raw?.total_price, quantity * pricePerUnit),
        sortOrder: Number.isFinite(Number(raw?.sortOrder ?? raw?.sort_order)) ? Number(raw?.sortOrder ?? raw?.sort_order) : (index + 1) * 10,
        legacyFieldKey: raw?.legacyFieldKey ? String(raw.legacyFieldKey) as SpecialtyLegacyFieldKey : null,
      };
    })
    .filter((item) => item.slug && item.name && item.quantity > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getProcessorSpecialtyCatalog(
  processorId: string | null | undefined,
  pricingInput?: Partial<SitePricing> | null,
): Promise<SpecialtyCatalogItem[]> {
  if (!processorId) {
    return defaultSpecialtyCatalog(pricingInput);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return defaultSpecialtyCatalog(pricingInput);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('processor_specialty_items')
    .select('id,slug,name,short_name,unit,price_type,price,active,sort_order,legacy_field_key')
    .eq('processor_id', processorId)
    .order('sort_order', { ascending: true });

  if (error || !data?.length) {
    return defaultSpecialtyCatalog(pricingInput);
  }

  return normalizeSpecialtyCatalog(
    data.map((row: any) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.short_name,
      unit: row.unit,
      priceType: row.price_type,
      price: row.price,
      active: row.active,
      sortOrder: row.sort_order,
      legacyFieldKey: row.legacy_field_key,
    })),
    pricingInput,
  );
}
