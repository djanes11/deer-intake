export type ProcessTypeCatalogItem = {
  slug: string;
  name: string;
  basePrice: number;
  pricingMode: 'flat' | 'per_lb';
  pricePerLb: number;
  minimumPrice: number;
  active: boolean;
  sortOrder: number;
  triggersCapeWorkflow: boolean;
  donationOnly: boolean;
};

export type AddOnCatalogItem = {
  slug: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
  legacyBooleanKey?: 'beefFat' | 'webbsOrder' | null;
};

export type JobAddOnItem = {
  slug: string;
  name: string;
  selected: boolean;
  price: number;
  sortOrder: number;
  legacyBooleanKey?: 'beefFat' | 'webbsOrder' | null;
};

export type NotificationTemplateEventKey =
  | 'intake'
  | 'meat_finished'
  | 'cape_finished'
  | 'specialty_finished'
  | 'webbs_delivered';

export type NotificationTemplateSet = Record<
  NotificationTemplateEventKey,
  {
    emailSubject: string;
    emailBody: string;
    smsBody: string;
  }
>;

type PricingLike = {
  standard_processing_price?: number;
  caped_price?: number;
  cape_donate_price?: number;
  beef_fat_add_on?: number;
  webbs_add_on?: number;
};

function money(value: unknown, fallback = 0): number {
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sortOrder(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function defaultProcessCatalog(pricing?: PricingLike | null): ProcessTypeCatalogItem[] {
  return [
    {
      slug: 'standard-processing',
      name: 'Standard Processing',
      basePrice: money(pricing?.standard_processing_price, 130),
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 10,
      triggersCapeWorkflow: false,
      donationOnly: false,
    },
    {
      slug: 'caped',
      name: 'Caped',
      basePrice: money(pricing?.caped_price, 150),
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 20,
      triggersCapeWorkflow: true,
      donationOnly: false,
    },
    {
      slug: 'skull-cap',
      name: 'Skull-Cap',
      basePrice: money(pricing?.standard_processing_price, 130),
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 30,
      triggersCapeWorkflow: false,
      donationOnly: false,
    },
    {
      slug: 'european',
      name: 'European',
      basePrice: money(pricing?.standard_processing_price, 130),
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 40,
      triggersCapeWorkflow: false,
      donationOnly: false,
    },
    {
      slug: 'cape-donate',
      name: 'Cape & Donate',
      basePrice: money(pricing?.cape_donate_price, 50),
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 50,
      triggersCapeWorkflow: true,
      donationOnly: true,
    },
    {
      slug: 'donate',
      name: 'Donate',
      basePrice: 0,
      pricingMode: 'flat',
      pricePerLb: 0,
      minimumPrice: 0,
      active: true,
      sortOrder: 60,
      triggersCapeWorkflow: false,
      donationOnly: true,
    },
  ];
}

export function normalizeProcessCatalog(input: unknown, pricing?: PricingLike | null): ProcessTypeCatalogItem[] {
  const rows = Array.isArray(input) && input.length ? input : defaultProcessCatalog(pricing);
  return rows
    .map((item, index) => {
      const name = String((item as any)?.name || '').trim();
      const slug = slugify((item as any)?.slug || name);
      if (!name && !slug) return null;
      return {
        slug,
        name: name || slug,
        basePrice: money(
          (item as any)?.basePrice ?? (item as any)?.price,
          (item as any)?.pricingMode === 'per_lb' ? money((item as any)?.minimumPrice, 0) : 0
        ),
        pricingMode: 'flat',
        pricePerLb: 0,
        minimumPrice: 0,
        active: (item as any)?.active !== false,
        sortOrder: sortOrder((item as any)?.sortOrder, (index + 1) * 10),
        triggersCapeWorkflow: !!((item as any)?.triggersCapeWorkflow),
        donationOnly: !!((item as any)?.donationOnly),
      } satisfies ProcessTypeCatalogItem;
    })
    .filter(Boolean)
    .sort((a, b) => a!.sortOrder - b!.sortOrder) as ProcessTypeCatalogItem[];
}

export function defaultAddOnCatalog(pricing?: PricingLike | null): AddOnCatalogItem[] {
  return [
    {
      slug: 'beef-fat',
      name: 'Beef Fat',
      price: money(pricing?.beef_fat_add_on, 5),
      active: true,
      sortOrder: 10,
      legacyBooleanKey: 'beefFat',
    },
    {
      slug: 'webbs-order',
      name: 'Webbs Add-On',
      price: money(pricing?.webbs_add_on, 20),
      active: true,
      sortOrder: 20,
      legacyBooleanKey: 'webbsOrder',
    },
  ];
}

export function normalizeAddOnCatalog(input: unknown, pricing?: PricingLike | null): AddOnCatalogItem[] {
  const rows = Array.isArray(input) && input.length ? input : defaultAddOnCatalog(pricing);
  return rows
    .map((item, index) => {
      const name = String((item as any)?.name || '').trim();
      const slug = slugify((item as any)?.slug || name);
      if (!name && !slug) return null;
      const legacyBooleanKey = (item as any)?.legacyBooleanKey;
      return {
        slug,
        name: name || slug,
        price: money((item as any)?.price, 0),
        active: (item as any)?.active !== false,
        sortOrder: sortOrder((item as any)?.sortOrder, (index + 1) * 10),
        legacyBooleanKey:
          legacyBooleanKey === 'beefFat' || legacyBooleanKey === 'webbsOrder' ? legacyBooleanKey : null,
      } satisfies AddOnCatalogItem;
    })
    .filter(Boolean)
    .sort((a, b) => a!.sortOrder - b!.sortOrder) as AddOnCatalogItem[];
}

export function filterVisibleAddOnItems<T extends { legacyBooleanKey?: 'beefFat' | 'webbsOrder' | null }>(
  items: T[],
  webbsEnabled: boolean,
): T[] {
  return items.filter((item) => item.legacyBooleanKey !== 'webbsOrder' || !webbsEnabled);
}

export function normalizeJobAddOnItems(input: unknown): JobAddOnItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      const slug = slugify((item as any)?.slug || (item as any)?.name);
      const name = String((item as any)?.name || '').trim();
      if (!slug && !name) return null;
      const legacyBooleanKey = (item as any)?.legacyBooleanKey;
      return {
        slug,
        name: name || slug,
        selected: !!(item as any)?.selected,
        price: money((item as any)?.price, 0),
        sortOrder: sortOrder((item as any)?.sortOrder, (index + 1) * 10),
        legacyBooleanKey:
          legacyBooleanKey === 'beefFat' || legacyBooleanKey === 'webbsOrder' ? legacyBooleanKey : null,
      } satisfies JobAddOnItem;
    })
    .filter(Boolean)
    .sort((a, b) => a!.sortOrder - b!.sortOrder) as JobAddOnItem[];
}

export function deriveSelectedAddOnItems(
  job: {
    addOnItems?: unknown;
    beefFat?: unknown;
    webbsOrder?: unknown;
  },
  addOnCatalogInput: unknown,
): JobAddOnItem[] {
  const catalog = normalizeAddOnCatalog(addOnCatalogInput);
  const saved = normalizeJobAddOnItems((job as any)?.addOnItems);
  const savedMap = new Map(saved.map((item) => [item.slug, item]));
  return catalog
    .map((item) => {
      const fromSaved = savedMap.get(item.slug);
      const selected =
        fromSaved?.selected ??
        (item.legacyBooleanKey === 'beefFat'
          ? !!job.beefFat
          : item.legacyBooleanKey === 'webbsOrder'
            ? !!job.webbsOrder
            : false);
      return {
        slug: item.slug,
        name: fromSaved?.name || item.name,
        selected,
        price: fromSaved?.price ?? item.price,
        sortOrder: fromSaved?.sortOrder ?? item.sortOrder,
        legacyBooleanKey: item.legacyBooleanKey ?? null,
      } satisfies JobAddOnItem;
    })
    .filter((item) => item.selected);
}

export function processCatalogLookup(processCatalogInput: unknown) {
  const catalog = normalizeProcessCatalog(processCatalogInput);
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const byName = new Map(catalog.map((item) => [item.name.toLowerCase(), item]));
  return { catalog, bySlug, byName };
}

export function resolveProcessType(
  processType: unknown,
  processCatalogInput: unknown,
): ProcessTypeCatalogItem | null {
  const value = String(processType ?? '').trim();
  if (!value) return null;
  const { bySlug, byName } = processCatalogLookup(processCatalogInput);
  return bySlug.get(slugify(value)) || byName.get(value.toLowerCase()) || null;
}

export function calcCatalogProcessingPrice(
  job: {
    processType?: unknown;
    processingWeightLbs?: unknown;
    addOnItems?: unknown;
    beefFat?: unknown;
    webbsOrder?: unknown;
  },
  processCatalogInput: unknown,
  addOnCatalogInput: unknown,
): number {
  const processType = resolveProcessType(job.processType, processCatalogInput);
  const base = processType?.basePrice ?? 0;
  if (!base && !deriveSelectedAddOnItems(job, addOnCatalogInput).length) return 0;
  const addOnTotal = deriveSelectedAddOnItems(job, addOnCatalogInput).reduce((sum, item) => sum + money(item.price), 0);
  return base + addOnTotal;
}

export function formatProcessTypePrice(item: ProcessTypeCatalogItem): string {
  return `$${money(item.basePrice, 0).toFixed(2)}`;
}

export function processTypeNeedsCapeWorkflow(
  processType: unknown,
  processCatalogInput?: unknown,
  explicit?: unknown,
): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const processTypeMatch = resolveProcessType(processType, processCatalogInput);
  if (processTypeMatch) return !!processTypeMatch.triggersCapeWorkflow;
  const fallback = String(processType || '').toLowerCase();
  return fallback.includes('cape') && !fallback.includes('skull');
}

export function defaultNotificationTemplates(businessName = 'Game Butcher Board'): NotificationTemplateSet {
  return {
    intake: {
      emailSubject: 'We received your deer ({{tag}})',
      emailBody:
        'Hi {{name}}\n\nWe received your deer ({{tag}}).\n{{intakeLinkLine}}\nIf you need to make any updates or have questions, please contact {{businessName}}{{phoneSuffix}}.',
      smsBody: '{{businessName}}: Deer tagged {{tag}}. {{statusLine}}',
    },
    meat_finished: {
      emailSubject: 'Finished & ready for pickup ({{tag}})',
      emailBody:
        'Hi {{name}}\n\nYour regular processing is finished and ready for pickup.\n{{processingDueLine}}\nPickup hours: {{pickupHours}}\nPlease contact {{businessName}}{{phoneSuffix}} to confirm your pickup time or ask any questions.\nPlease bring a cooler or box to transport your meat.\nReminder: This update is for your regular processing only. We will reach out separately about any additional order items.',
      smsBody: '{{businessName}}: Meat ready for pickup. {{tag}}. {{statusLine}}',
    },
    cape_finished: {
      emailSubject: 'Cape finished & ready for pickup ({{tag}})',
      emailBody:
        'Hi {{name}}\n\nYour cape is finished and ready for pickup.\nPickup hours: {{pickupHours}}\nPlease contact {{businessName}}{{phoneSuffix}} to confirm your pickup time or ask any questions.',
      smsBody: '{{businessName}}: Cape ready for pickup. {{tag}}. {{statusLine}}',
    },
    specialty_finished: {
      emailSubject: 'Specialty products finished ({{tag}})',
      emailBody:
        'Hi {{name}}\n\nYour specialty products are finished and ready for pickup.\n{{specialtyDueLine}}\nPickup hours: {{pickupHours}}\nPlease contact {{businessName}}{{phoneSuffix}} to confirm your pickup time or ask any questions.',
      smsBody: '{{businessName}}: Specialty ready for pickup. {{tag}}. {{statusLine}}',
    },
    webbs_delivered: {
      emailSubject: 'Webbs order delivered ({{tag}})',
      emailBody:
        'Hi {{name}}\n\nYour Webbs order has been delivered and is ready for pickup.\nPickup hours: {{pickupHours}}\nPlease contact {{businessName}}{{phoneSuffix}} to confirm your pickup time or ask any questions.',
      smsBody: '{{businessName}}: Webbs delivered. {{tag}}. {{statusLine}}',
    },
  };
}

export function normalizeNotificationTemplates(input: unknown, businessName = 'Game Butcher Board'): NotificationTemplateSet {
  const defaults = defaultNotificationTemplates(businessName);
  const raw = input && typeof input === 'object' ? (input as Record<string, any>) : {};
  const out = { ...defaults } as NotificationTemplateSet;
  (Object.keys(defaults) as NotificationTemplateEventKey[]).forEach((key) => {
    out[key] = {
      emailSubject: String(raw?.[key]?.emailSubject || defaults[key].emailSubject),
      emailBody: String(raw?.[key]?.emailBody || defaults[key].emailBody),
      smsBody: String(raw?.[key]?.smsBody || defaults[key].smsBody),
    };
  });
  return out;
}

export function renderNotificationTemplate(template: string, vars: Record<string, string | number | boolean | null | undefined>) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}
