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

export const WEBBS_GROUPS: WebbsCatalogGroup[] = [
  {
    title: 'Bacon',
    items: [
      { key: 'venisonSmokedBacon', label: 'Venison Smoked Bacon' },
      { key: 'venisonChipotleBacon', label: 'Venison Chipotle Bacon' },
    ],
  },
  {
    title: 'Summer Sausage',
    items: [
      { key: 'summerSausage', label: 'Summer Sausage' },
      { key: 'summerSausageCheddar', label: 'Summer Sausage w Cheddar' },
      { key: 'jalapenoSummerSausage', label: 'Jalapeno Summer Sausage' },
      { key: 'hotSpicySummerSausage', label: 'Hot & Spicy Summer Sausage' },
      { key: 'hotSpicySummerSausageCheddar', label: 'Hot & Spicy Summer Sausage w Cheddar' },
      { key: 'blazinHotSummerSausage', label: 'Blazin Hot Summer Sausage' },
    ],
  },
  {
    title: 'Salami / Bologna',
    items: [
      { key: 'salami', label: 'Salami' },
      { key: 'salamiHotPepperCheese', label: 'Salami w Hot Pepper Cheese' },
      { key: 'bologna', label: 'Bologna' },
      { key: 'bolognaCheddar', label: 'Bologna w Cheddar' },
    ],
  },
  {
    title: 'Brats / Links',
    items: [
      { key: 'bratswurst', label: 'Bratswurst' },
      { key: 'bratswurstCheddar', label: 'Bratswurst w Cheddar' },
      { key: 'bratswurstGreenPepperOnions', label: 'Bratswurst w Green Pepper Onions' },
      { key: 'italianSausageLink', label: 'Italian Sausage Link' },
      { key: 'polishSausageLink', label: 'Polish Sausage Link' },
      { key: 'polishSausageCheddar', label: 'Polish Sausage w Cheddar' },
      { key: 'cajunSausageLink', label: 'Cajun Sausage Link' },
      { key: 'smokeyJackSausageLink', label: 'Smokey Jack Sausage Link' },
      { key: 'jalapenoCheddarwurstLink', label: 'Jalapeno Cheddarwurst Link' },
    ],
  },
  {
    title: 'Wieners',
    items: [
      { key: 'skinlessWeiners', label: 'Skinless Weiners' },
      { key: 'skinlessWeinersCheddar', label: 'Skinless Weiners w Cheddar' },
      { key: 'cocktailWeiners', label: 'Cocktail Weiners' },
      { key: 'cocktailWeinersCheddar', label: 'Cocktail Weiners w Cheddar' },
    ],
  },
  {
    title: 'Snack Items',
    items: [
      { key: 'snackSticks', label: 'Snack Sticks' },
      { key: 'jerkyRegular', label: 'Jerky - Regular' },
      { key: 'jerkyCajun', label: 'Jerky - Cajun' },
      { key: 'snackLinksJalapenoCheddar', label: 'Snack Links - Jalapeno with Cheddar' },
      { key: 'snackLinksTeriyaki', label: 'Snack Links - Teriyaki' },
      { key: 'snackLinksPepperoni', label: 'Snack Links - Pepperoni' },
      { key: 'snackLinksSouthwest', label: 'Snack Links - Southwest' },
      { key: 'snackLinksOriginal', label: 'Snack Links - Original' },
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

export function webbsOrderTotalLbs(input: any): number {
  return normalizeWebbsOrderItems(input).reduce((sum, item) => sum + item.pounds, 0);
}

export function webbsOrderSummary(input: any): string[] {
  return normalizeWebbsOrderItems(input).map((item) => `${item.label}: ${item.pounds} lb`);
}

export function webbsItemMeta(key: string): WebbsCatalogItem | undefined {
  return WEBBS_ITEM_MAP.get(key);
}
