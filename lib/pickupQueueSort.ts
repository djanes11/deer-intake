export const PICKUP_SORT_COLUMNS = [
  ['tag', 'Tag'], ['customer', 'Customer'], ['track', 'Track'],
  ['processType', 'Processing type'], ['webbsOrder', "Webb’s"],
  ['processingPayment', 'Processing payment'], ['called', 'Called / ready'],
  ['totalDue', 'Balance'], ['payment', 'Order payment'], ['waiting', 'Waiting'], ['pickedUp', 'Pickup'],
] as const;
export type PickupSortKey = typeof PICKUP_SORT_COLUMNS[number][0];
export type PickupSortRow = {
  tag: string; customer: string; track: string; processType: string; webbsOrder: boolean;
  priceProc: number; procDue: number; totalDue: number; priceSpec: number;
  queueAt?: string; calledAt?: string; readyAt?: string; pickedUp?: boolean;
};
export function processingPaymentLabel(row: Pick<PickupSortRow, 'priceProc' | 'procDue'>) {
  if (row.priceProc <= 0) return 'No charge';
  if (row.procDue <= 0) return 'Paid';
  return row.procDue < row.priceProc ? 'Part paid' : 'Unpaid';
}
const paymentRank = (label: string) => ['No charge', 'Paid', 'Part paid', 'Unpaid'].indexOf(label);
function value(row: PickupSortRow, key: PickupSortKey): string | number | null {
  if (key === 'called' || key === 'waiting') {
    const date = key === 'called' ? row.calledAt || row.readyAt : row.queueAt || row.calledAt || row.readyAt;
    const time = date ? Date.parse(date) : NaN;
    return Number.isFinite(time) ? (key === 'waiting' ? -time : time) : null;
  }
  if (key === 'processingPayment') return paymentRank(processingPaymentLabel(row));
  if (key === 'payment') return row.track !== 'meat' ? 0 : row.totalDue <= 0 ? 1 : row.totalDue < row.priceProc + row.priceSpec ? 2 : 3;
  if (key === 'webbsOrder' || key === 'pickedUp') return Number(!!row[key]);
  return row[key] === '' ? null : row[key];
}
export function sortPickupRows<T extends PickupSortRow>(rows: T[], key: PickupSortKey, direction: 'asc' | 'desc'): T[] {
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    const av = value(a, key), bv = value(b, key);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const comparison = av == null || bv == null ? 0 : typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
    return comparison * (direction === 'asc' ? 1 : -1) || collator.compare(a.tag, b.tag) || collator.compare(a.track, b.track);
  });
}
