// Saved specialty quantities and inventory are always finished (take-home) pounds.
type Product = { slug?: string; name?: string; legacyFieldKey?: string | null };

export function specialtyMeatRatio(item: Product): number {
  const key = `${item.slug ?? ''} ${item.name ?? ''} ${item.legacyFieldKey ?? ''}`;
  return /snack|stix|sticks/i.test(key) ? 2 : 1;
}

export function specialtyMeatLbs(item: Product, takeHomeLbs: number): number {
  return takeHomeLbs * specialtyMeatRatio(item);
}

export function specialtyTakeHomeLbs(item: Product, meatLbs: number): number {
  return meatLbs / specialtyMeatRatio(item);
}

export const SPECIALTY_YIELD_NOTICE = 'Enter the pounds of meat you want to send. Summer sausage: 1 lb meat = approximately 1 lb take-home. Snack sticks: 2 lb meat = approximately 1 lb take-home. You are charged per take-home pound.';
