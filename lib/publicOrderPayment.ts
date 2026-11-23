type Order = Record<string, any>;

export function savedMoney(value: unknown): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? Math.round(Math.max(0, number) * 100) / 100 : undefined;
}
function flag(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  return value === true || ['true', '1', 'yes', 'y', 'paid', 'on', '✓', '✔', 'x'].includes(String(value).trim().toLowerCase());
}
/** Saved charges (including zero) take precedence over today's catalog prices. */
export function publicOrderPayment(row: Order, fallback: { processing?: number; specialty?: number } = {}) {
  const priceProcessing = savedMoney(row.priceProcessing ?? row.price_processing)
    ?? savedMoney(row.processing_price_override ?? row.processingPriceOverride) ?? fallback.processing;
  const priceSpecialty = savedMoney(row.priceSpecialty ?? row.price_specialty)
    ?? savedMoney(row.specialty_price_override ?? row.specialtyPriceOverride) ?? fallback.specialty;
  const amountPaidProcessing = savedMoney(row.amountPaidProcessing ?? row.amount_paid_processing) ?? 0;
  const amountPaidSpecialty = savedMoney(row.amountPaidSpecialty ?? row.amount_paid_specialty) ?? 0;
  const rawOverall = flag(row.paid ?? row.Paid);
  const procFlag = flag(row.paidProcessing ?? row.paid_processing);
  const specFlag = flag(row.paidSpecialty ?? row.paid_specialty);
  const paidProc = procFlag === true || (procFlag === undefined && rawOverall === true) || (priceProcessing !== undefined && amountPaidProcessing >= priceProcessing);
  const paidSpec = specFlag === true || (specFlag === undefined && rawOverall === true) || (priceSpecialty !== undefined && amountPaidSpecialty >= priceSpecialty);
  const completePrices = priceProcessing !== undefined && priceSpecialty !== undefined;
  const priceTotal = completePrices
    ? Math.round((priceProcessing + priceSpecialty) * 100) / 100
    : savedMoney(row.priceTotal ?? row.price_total ?? row.price);
  const owedProcessing = paidProc ? 0 : priceProcessing === undefined ? undefined : Math.max(0, Math.round((priceProcessing - amountPaidProcessing) * 100) / 100);
  const owedSpecialty = paidSpec ? 0 : priceSpecialty === undefined ? undefined : Math.max(0, Math.round((priceSpecialty - amountPaidSpecialty) * 100) / 100);
  const paidOverall = paidProc && paidSpec;
  // An unknown component is not a zero-dollar charge. Keep legacy aggregate
  // totals when needed, but never let a stale aggregate override saved line prices.
  const processingCredit = paidProc && priceProcessing !== undefined ? Math.max(priceProcessing, amountPaidProcessing) : amountPaidProcessing;
  const specialtyCredit = paidSpec && priceSpecialty !== undefined ? Math.max(priceSpecialty, amountPaidSpecialty) : amountPaidSpecialty;
  const owedTotal = paidOverall ? 0 : completePrices
    ? Math.round(((owedProcessing ?? 0) + (owedSpecialty ?? 0)) * 100) / 100
    : priceTotal === undefined ? undefined : Math.max(0, Math.round((priceTotal - processingCredit - specialtyCredit) * 100) / 100);
  return { priceProcessing, priceSpecialty, priceTotal, amountPaidProcessing, amountPaidSpecialty, paidProc, paidSpec, paidOverall, owedProcessing, owedSpecialty, owedTotal };
}
