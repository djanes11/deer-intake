export type WebbsCatalogItem = {
  key: string;
  label: string;
};

export type WebbsCatalogGroup = {
  title: string;
  items: WebbsCatalogItem[];
};

export type WebbsOrderItem = {
  key: string;
  label: string;
  pounds: number;
};

export type WebbsAllocationItem = {
  key: string;
  label: string;
  percent: number;
};

export type WebbsOrderStyle = 'itemized_lbs' | 'whole_deer_percent' | 'paper_form';

function toBool(value: any): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(s);
}

export const WEBBS_GROUPS: WebbsCatalogGroup[] = [
  {
    title: 'Bacon',
    items: [
      { key: 'venisonSmokedBacon', label: 'Smoked Venison Bacon' },
      { key: 'venisonChipotleBacon', label: 'Smoked Chipotle Bacon' },
    ],
  },
  {
    title: 'Summer Sausage',
    items: [
      { key: 'summerSausage', label: 'Summer Sausage' },
      { key: 'summerSausageCheddar', label: 'Summer Sausage w/Cheddar' },
      { key: 'jalapenoSummerSausage', label: 'Jalapeno Summer Sausage' },
      { key: 'hotSpicySummerSausage', label: 'Spicey Summer Sausage' },
      { key: 'hotSpicySummerSausageCheddar', label: 'Spicey Summer Sausage w/Cheddar' },
      { key: 'blazinHotSummerSausage', label: 'BLAZIN HOT Summer Sausage' },
    ],
  },
  {
    title: 'Salami / Bologna',
    items: [
      { key: 'salami', label: 'Salami' },
      { key: 'salamiHotPepperCheese', label: 'Salami w/Pepper Jack Cheese' },
      { key: 'bologna', label: 'Bologna' },
      { key: 'bolognaCheddar', label: 'Bologna w/Cheddar' },
    ],
  },
  {
    title: 'Brats / Links',
    items: [
      { key: 'bratswurst', label: 'Bratwurst' },
      { key: 'bratswurstCheddar', label: 'Bratwurst w/Cheddar' },
      { key: 'bratswurstGreenPepperOnions', label: 'Bratwurst w/Green Pepper & Onion' },
      { key: 'italianSausageLink', label: 'Italian Links' },
      { key: 'polishSausageLink', label: 'Polish' },
      { key: 'polishSausageCheddar', label: 'Polish w/Cheddar' },
      { key: 'cajunSausageLink', label: 'Cajun Links' },
      { key: 'smokeyJackSausageLink', label: 'Smoke Jacks (Pepper Jack Cheese)' },
      { key: 'jalapenoCheddarwurstLink', label: 'Jalapeno Cheddarwurst' },
    ],
  },
  {
    title: 'Wieners',
    items: [
      { key: 'skinlessWeiners', label: 'Skinless Weiners' },
      { key: 'skinlessWeinersCheddar', label: 'Skinless Weiners w Cheddar Cheese' },
      { key: 'cocktailWeiners', label: 'Cocktail Weiners' },
      { key: 'cocktailWeinersCheddar', label: 'Cocktail Weiners w/Cheddar' },
    ],
  },
  {
    title: 'Snack Items',
    items: [
      { key: 'snackSticks', label: 'Snack Stix' },
      { key: 'jerkyRegular', label: 'Jerky - Original' },
      { key: 'jerkyCajun', label: 'Jerky - Cajun' },
      { key: 'snackLinksJalapenoCheddar', label: 'Snack Links with Jalapeno & Cheddar' },
      { key: 'snackLinksTeriyaki', label: 'Venison Snack Link - Teriyaki' },
      { key: 'snackLinksPepperoni', label: 'Venison Snack Link - Pepperoni' },
      { key: 'snackLinksSouthwest', label: 'Venison Snack Link - Southwest (Hot)' },
      { key: 'snackLinksOriginal', label: 'Venison Snack Link - Original' },
    ],
  },
];

const WEBBS_ITEM_MAP = new Map(
  WEBBS_GROUPS.flatMap((group) => group.items).map((item) => [item.key, item] as const)
);

function toPositiveNumber(value: any): number {
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').trim().replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeWebbsOrderItems(input: any): WebbsOrderItem[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string' && input.trim()
      ? (() => {
          try {
            return JSON.parse(input);
          } catch {
            return [];
          }
        })()
      : [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const key = String(item?.key ?? '').trim();
      const meta = WEBBS_ITEM_MAP.get(key);
      const pounds = toPositiveNumber(item?.pounds);
      if (!meta || !pounds) return null;
      return { key: meta.key, label: meta.label, pounds };
    })
    .filter((item): item is WebbsOrderItem => !!item);
}

export function normalizeWebbsAllocations(input: any): WebbsAllocationItem[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string' && input.trim()
      ? (() => {
          try {
            return JSON.parse(input);
          } catch {
            return [];
          }
        })()
      : [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const key = String(item?.key ?? '').trim();
      const meta = WEBBS_ITEM_MAP.get(key);
      const percent = toPositiveNumber(item?.percent);
      if (!meta || !percent) return null;
      return { key: meta.key, label: meta.label, percent };
    })
    .filter((item): item is WebbsAllocationItem => !!item);
}

export function webbsOrderTotalLbs(input: any): number {
  return normalizeWebbsOrderItems(input).reduce((sum, item) => sum + item.pounds, 0);
}

export function webbsOrderSummary(input: any): string[] {
  return normalizeWebbsOrderItems(input).map((item) => `${item.label}: ${item.pounds} lb`);
}

export function webbsAllocationTotalPercent(input: any): number {
  return normalizeWebbsAllocations(input).reduce((sum, item) => sum + item.percent, 0);
}

export function webbsAllocationSummary(input: any): string[] {
  return normalizeWebbsAllocations(input).map((item) => `${item.label}: ${item.percent}%`);
}

export function normalizeWebbsOrderStyle(input: any): WebbsOrderStyle {
  const value = String(input ?? '').trim();
  if (value === 'whole_deer_percent') return 'whole_deer_percent';
  if (value === 'paper_form') return 'paper_form';
  return 'itemized_lbs';
}

export function webbsItemMeta(key: string): WebbsCatalogItem | undefined {
  return WEBBS_ITEM_MAP.get(key);
}

export function hasWebbsOrder(value: any): boolean {
  return toBool(value);
}

export function webbsOrderStyleLabel(input: any): string {
  const style = normalizeWebbsOrderStyle(input);
  if (style === 'whole_deer_percent') return 'Whole deer by percentages';
  if (style === 'paper_form') return 'Paper form';
  return 'Products by pounds';
}

export function webbsPrimarySummary(input: {
  webbsOrder?: any;
  webbsOrderStyle?: any;
  webbsFormNumber?: any;
  webbsPounds?: any;
  webbsItems?: any;
  webbsAllocations?: any;
}): string {
  if (!hasWebbsOrder(input?.webbsOrder)) return 'No Webbs order';

  const style = normalizeWebbsOrderStyle(input?.webbsOrderStyle);
  const formNumber = String(input?.webbsFormNumber ?? '').trim();
  const pounds = toPositiveNumber(input?.webbsPounds);
  const items = normalizeWebbsOrderItems(input?.webbsItems);
  const allocations = normalizeWebbsAllocations(input?.webbsAllocations);

  const parts: string[] = [webbsOrderStyleLabel(style)];
  if (formNumber) parts.push(`Form #${formNumber}`);
  if (style === 'paper_form') {
    if (pounds) parts.push(`${pounds} lb total`);
  } else if (style === 'whole_deer_percent') {
    if (allocations.length) parts.push(`${allocations.length} products`);
    if (allocations.length) parts.push(`${webbsAllocationTotalPercent(allocations)}% assigned`);
  } else {
    if (items.length) parts.push(`${items.length} items`);
    if (items.length) parts.push(`${webbsOrderTotalLbs(items)} lb detailed`);
  }

  return parts.join(' | ');
}

export function webbsSupportSummary(input: { webbsPaperFormCompleted?: any }): string {
  return toBool(input?.webbsPaperFormCompleted) ? 'Paper form also completed' : '';
}
