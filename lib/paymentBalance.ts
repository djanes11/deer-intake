/** Money already received is independent of the order's current price. */
export function amountPaid(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function paymentBalance(price: unknown, received: unknown) {
  const charge = amountPaid(price);
  const paid = amountPaid(received);
  const difference = Math.round((charge - paid) * 100) / 100;
  return { paid, due: Math.max(0, difference), overpaid: Math.max(0, -difference) };
}

export function paymentReviewMessage(processingPrice: unknown, processingPaid: unknown, specialtyPrice: unknown, specialtyPaid: unknown) {
  const processing = paymentBalance(processingPrice, processingPaid).overpaid;
  const specialty = paymentBalance(specialtyPrice, specialtyPaid).overpaid;
  const parts = [processing > 0 ? `processing $${processing.toFixed(2)}` : '', specialty > 0 ? `specialty $${specialty.toFixed(2)}` : ''].filter(Boolean);
  return parts.length ? `Payment review needed: ${parts.join(' and ')} paid above the current charge. Recorded payments are preserved. Review any refund or credit separately; changing this order does not issue a refund.` : '';
}
