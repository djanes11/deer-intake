import { normalizeAddOnCatalog, normalizeProcessCatalog, resolveProcessType, processTypeAllowedForSex } from '@/lib/processorCatalog';
import type { PublicSiteSettings } from '@/lib/siteSettings';
import { normalizeWebbsOrderItems, normalizeWebbsAllocations, webbsOrderTotalLbs } from '@/lib/webbs';

const TEXT_FIELDS = [
  'confirmation', 'customer', 'phone', 'email', 'huntingLicenseNumber', 'address', 'city', 'state', 'zip',
  'county', 'dropoff', 'sex', 'howKilled', 'notes', 'steak', 'steakOther', 'burgerSize', 'steaksPerPackage',
  'backstrapPrep', 'backstrapThickness', 'backstrapThicknessOther', 'hindRoastCount', 'frontRoastCount',
] as const;

/** Public selections only. Prices, identities, payments, and workflow stamps are server-owned. */
export function publicIntakeInput(raw: Record<string, any>, settings: PublicSiteSettings): Record<string, any> {
  const job: Record<string, any> = {};
  for (const key of TEXT_FIELDS) job[key] = String(raw[key] ?? '').trim();
  for (const key of ['prefEmail', 'prefSMS', 'prefCall', 'smsConsent']) job[key] = raw[key] === true;
  for (const area of ['hind', 'front']) {
    const label = area === 'hind' ? 'Hind' : 'Front';
    job[area] = Object.fromEntries(['Steak', 'Roast', 'Grind', 'None'].map((cut) => [
      `${label} - ${cut}`, raw[area]?.[`${label} - ${cut}`] === true,
    ]));
  }
  const process = resolveProcessType(raw.processType, normalizeProcessCatalog(settings.processCatalog, settings.pricing));
  if (!process?.active || !processTypeAllowedForSex(process, job.sex)) {
    throw new Error('Choose an available process type for this deer.');
  }
  job.processType = process.name;
  job.processTypeRequiresCape = process.triggersCapeWorkflow;
  job.beefFat = raw.beefFat === true;
  job.webbsOrder = raw.webbsOrder === true && settings.features.webbsEnabled !== false;
  const selected = new Set((Array.isArray(raw.addOnItems) ? raw.addOnItems : [])
    .filter((item: any) => item?.selected === true).map((item: any) => String(item.slug)));
  job.addOnItems = normalizeAddOnCatalog(settings.addOnCatalog).filter((item) => item.active).map((item) => ({
    slug: item.slug, name: item.name, price: item.price, sortOrder: item.sortOrder,
    legacyBooleanKey: item.legacyBooleanKey,
    selected: item.legacyBooleanKey === 'webbsOrder' ? job.webbsOrder
      : item.legacyBooleanKey === 'beefFat' ? job.beefFat : selected.has(item.slug),
  }));
  // Explicit false selections for unavailable legacy add-ons prevent fallback selection.
  for (const item of normalizeAddOnCatalog(settings.addOnCatalog).filter((item) => !item.active)) {
    job.addOnItems.push({ ...item, selected: false });
    if (item.legacyBooleanKey) job[item.legacyBooleanKey] = false;
  }
  job.specialtyItems = [];
  if (raw.specialtyProducts === true && settings.features.specialtyEnabled !== false) {
    const submitted = Array.isArray(raw.specialtyItems) ? raw.specialtyItems : [];
    for (const item of settings.specialtyCatalog.filter((item) => item.active)) {
      const selection = submitted.find((entry: any) => entry?.slug === item.slug);
      const quantity = Number(selection ? selection.quantity : item.legacyFieldKey ? raw[item.legacyFieldKey] || 0 : 0);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Specialty pounds must be a valid non-negative number.');
      if (quantity > 0) job.specialtyItems.push({
        catalogId: item.id ?? null, slug: item.slug, name: item.name, shortName: item.shortName,
        unit: item.unit, priceType: item.priceType, quantity, pricePerUnit: item.price,
        total: quantity * item.price, sortOrder: item.sortOrder, legacyFieldKey: item.legacyFieldKey,
      });
    }
  }
  job.specialtyProducts = job.specialtyItems.length > 0;
  if (job.webbsOrder) {
    job.webbsOrderStyle = raw.webbsOrderStyle === 'whole_deer_percent' ? 'whole_deer_percent' : 'itemized_lbs';
    job.webbsItems = job.webbsOrderStyle === 'itemized_lbs'
      ? normalizeWebbsOrderItems((Array.isArray(raw.webbsItems) ? raw.webbsItems : []).map((item: any) => ({ key: item.key, pounds: item.pounds }))) : [];
    job.webbsAllocations = job.webbsOrderStyle === 'whole_deer_percent'
      ? normalizeWebbsAllocations((Array.isArray(raw.webbsAllocations) ? raw.webbsAllocations : []).map((item: any) => ({ key: item.key, percent: item.percent }))) : [];
    job.webbsPounds = webbsOrderTotalLbs(job.webbsItems);
    job.webbsOrderMode = 'online';
  }
  const donated = process.donationOnly || /donate/i.test(process.name);
  job.status = donated ? '' : 'Dropped Off';
  job.capingStatus = process.triggersCapeWorkflow ? 'Dropped Off' : '';
  job.webbsStatus = job.webbsOrder && !donated ? 'Dropped Off' : '';
  job.specialtyStatus = job.specialtyProducts ? 'Dropped Off' : '';
  return job;
}
