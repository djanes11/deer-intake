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

export function specialtyQuantityError(item: Product, takeHomeLbs: number): string | null {
  if (Number.isInteger(takeHomeLbs) && takeHomeLbs >= 0) return null;
  return `${item.name || 'Specialty products'}: choose meat in ${specialtyMeatRatio(item)} lb increments for whole-pound take-home packages. No half-pound packages.`;
}

export const SPECIALTY_YIELD_NOTICE = 'Whole-pound take-home packages only. Enter summer sausage meat in 1 lb increments (1:1). Enter snack-stick meat in 2 lb increments: 2, 4, 6, 8 lb, etc. (2 lb meat = approximately 1 lb take-home). You are charged per take-home pound.';
