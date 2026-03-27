export type SitePricing = {
  standard_processing_price: number;
  caped_price: number;
  cape_donate_price: number;
  beef_fat_add_on: number;
  webbs_add_on: number;
  summer_sausage_price_per_lb: number;
  snack_stix_price_per_lb: number;
};

export const DEFAULT_SITE_PRICING: SitePricing = {
  standard_processing_price: 130,
  caped_price: 150,
  cape_donate_price: 50,
  beef_fat_add_on: 5,
  webbs_add_on: 20,
  summer_sausage_price_per_lb: 5,
  snack_stix_price_per_lb: 8,
};

function positiveMoney(value: unknown, fallback: number): number {
  const cleaned =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(cleaned) && cleaned >= 0 ? cleaned : fallback;
}

export function normalizePricing(input: unknown): SitePricing {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    standard_processing_price: positiveMoney(raw.standard_processing_price, DEFAULT_SITE_PRICING.standard_processing_price),
    caped_price: positiveMoney(raw.caped_price, DEFAULT_SITE_PRICING.caped_price),
    cape_donate_price: positiveMoney(raw.cape_donate_price, DEFAULT_SITE_PRICING.cape_donate_price),
    beef_fat_add_on: positiveMoney(raw.beef_fat_add_on, DEFAULT_SITE_PRICING.beef_fat_add_on),
    webbs_add_on: positiveMoney(raw.webbs_add_on, DEFAULT_SITE_PRICING.webbs_add_on),
    summer_sausage_price_per_lb: positiveMoney(
      raw.summer_sausage_price_per_lb,
      DEFAULT_SITE_PRICING.summer_sausage_price_per_lb,
    ),
    snack_stix_price_per_lb: positiveMoney(
      raw.snack_stix_price_per_lb,
      DEFAULT_SITE_PRICING.snack_stix_price_per_lb,
    ),
  };
}

export function formatMoney(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function normProc(value?: string | null): string {
  const v = String(value || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}

export function calcProcessingPrice(
  procType: unknown,
  beefFat: unknown,
  webbsOrder: unknown,
  pricingInput?: Partial<SitePricing> | null,
): number {
  const pricing = normalizePricing(pricingInput);
  const p = normProc(String(procType || ''));
  const base =
    p === 'Caped'
      ? pricing.caped_price
      : p === 'Cape & Donate'
        ? pricing.cape_donate_price
        : ['Standard Processing', 'Skull-Cap', 'European'].includes(p)
          ? pricing.standard_processing_price
          : p === 'Donate'
            ? 0
            : 0;
  if (!base) return 0;
  const beef = typeof beefFat === 'boolean' ? beefFat : String(beefFat).toLowerCase() === 'true';
  const webbs = typeof webbsOrder === 'boolean' ? webbsOrder : String(webbsOrder).toLowerCase() === 'true';
  return base + (beef ? pricing.beef_fat_add_on : 0) + (webbs ? pricing.webbs_add_on : 0);
}
