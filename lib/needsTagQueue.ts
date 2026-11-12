import { processingPaymentLabel } from '@/lib/pickupQueueSort';

export type Row = {
  id?: string;
  tag?: string;
  confirmation?: string;
  customer_name?: string;
  phone?: string;
  dropoff_date?: string;
  status?: string;
  webbs?: boolean;
  paidProcessing?: boolean;
  processType?: string;
  priceProcessing?: number;
  amountPaidProcessing?: number;
  created_at?: string;
};

function normBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'x';
}

export function normRow(r: any): Row {
  return {
    id: r?.id,
    tag: String(r?.tag ?? ''),
    confirmation: String(r?.confirmation ?? ''),
    customer_name: String(r?.customer_name ?? ''),
    phone: String(r?.phone ?? ''),
    dropoff_date: String(r?.dropoff_date ?? ''),
    status: String(r?.status ?? ''),
    webbs: normBool(r?.webbs_order ?? r?.webbsOrder ?? r?.webbs),
    paidProcessing: normBool(r?.paid_processing ?? r?.paidProcessing),
    processType: String(r?.process_type ?? r?.processType ?? ''),
    priceProcessing: Number(r?.price_processing ?? r?.priceProcessing ?? 0) || 0,
    amountPaidProcessing: Number(r?.amount_paid_processing ?? r?.amountPaidProcessing ?? 0) || 0,
    created_at: String(r?.created_at ?? ''),
  };
}


export const NEEDS_TAG_COLUMNS = [
  ['customer_name', 'Customer'], ['confirmation', 'Confirmation'], ['phone', 'Phone'],
  ['dropoff_date', 'Dropped off'], ['status', 'Status'], ['processType', 'Processing type'],
  ['webbs', 'Webb’s'], ['processingPayment', 'Processing payment'], ['created_at', 'Submitted'],
] as const;
export type NeedsTagSortKey = typeof NEEDS_TAG_COLUMNS[number][0];
export function processingDue(row: Row) {
  return Math.max(0, (row.priceProcessing || 0) - (row.amountPaidProcessing || 0));
}
export function needsTagPayment(row: Row) {
  return processingPaymentLabel({ priceProc: row.priceProcessing || 0, procDue: processingDue(row) });
}
function sortValue(row: Row, key: NeedsTagSortKey): string | number | null {
  if (key === 'processingPayment') return ['No charge', 'Paid', 'Part paid', 'Unpaid'].indexOf(needsTagPayment(row));
  if (key === 'webbs') return Number(!!row.webbs);
  if (key === 'dropoff_date' || key === 'created_at') {
    const time = Date.parse(row[key] || ''); return Number.isFinite(time) ? time : null;
  }
  return row[key]?.trim() || null;
}
export function sortNeedsTagRows(rows: Row[], key: NeedsTagSortKey, direction: 'asc' | 'desc') {
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key), bv = sortValue(b, key);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const comparison = av == null || bv == null ? 0 : typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
    return comparison * (direction === 'asc' ? 1 : -1) || collator.compare(a.id || a.tag || '', b.id || b.tag || '');
  });
}
