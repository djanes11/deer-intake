type Order = Record<string, any>;
const money = (value: unknown): number | null => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Number(value));
const items = (value: any) => (Array.isArray(value) ? value : []).map((item: any) => [item.slug, Number(item.quantity || 0), Number(item.pricePerUnit ?? item.price ?? 0)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
const processing = (job: Order) => JSON.stringify([job.processType || '', Number(job.processingWeightLbs || 0), !!job.beefFat, !!job.webbsOrder, items((job.addOnItems || []).filter((item: any) => item.selected !== false))]);
const specialty = (job: Order) => JSON.stringify([!!job.specialtyProducts, items(job.specialtyItems), ...['originalSummerSausageLbs', 'summerSausageCheeseLbs', 'jalapenoSummerSausageCheeseLbs', 'originalSnackSticksLbs', 'originalSnackSticksCheeseLbs', 'jalapenoSnackSticksCheeseLbs'].map(key => Number(job[key] || 0))]);
const override = (job: Order, key: string, alias: string) => money(Object.hasOwn(job, key) ? job[key] : job[alias]);

/** Retain historical charges only for unchanged orders; client price snapshots are not an override. */
export function resolveOrderPrices(job: Order, existing: Order | null, computedProcessing: number, computedSpecialty: number) {
  const procOverride = override(job, 'processing_price_override', 'processingPriceOverride');
  const specOverride = override(job, 'specialty_price_override', 'specialtyPriceOverride');
  const sameProcessing = existing && processing(job) === processing(existing) && procOverride === override(existing, 'processing_price_override', 'processingPriceOverride');
  const sameSpecialty = existing && specialty(job) === specialty(existing) && specOverride === override(existing, 'specialty_price_override', 'specialtyPriceOverride');
  const priceProcessing = procOverride ?? (sameProcessing ? money(existing.priceProcessing) : null) ?? computedProcessing;
  const priceSpecialty = !job.specialtyProducts ? 0 : specOverride ?? (sameSpecialty ? money(existing.priceSpecialty) : null) ?? computedSpecialty;
  return { priceProcessing, priceSpecialty, price: Math.round((priceProcessing + priceSpecialty) * 100) / 100 };
}
