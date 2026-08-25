import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { getSupabaseServer } from '@/lib/supabaseClient';

type SquareReportRow = {
  id: string;
  jobId: string;
  tag: string;
  confirmation: string;
  customer: string;
  status: string;
  squareEnvironment: string;
  checkoutUrl: string;
  squarePaymentId: string;
  squareOrderId: string;
  createdAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  lastEventAt: string | null;
  paymentConfirmedAt: string | null;
  amountCents: number;
  processingAmountCents: number;
  onlineFeeCents: number;
  appProcessingPrice: number;
  appProcessingPaid: number;
  appPaidProcessing: boolean;
  appPaymentMethod: string;
  issueLevel: 'critical' | 'warning' | 'ok';
  issueLabels: string[];
  category: 'needs_attention' | 'open' | 'paid';
};

function money(value: unknown) {
  const n = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cents(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function str(value: unknown) {
  return String(value || '').trim();
}

function normalizeJob(row: any) {
  const job = row?.jobs;
  if (Array.isArray(job)) return job[0] || null;
  return job || null;
}

function rowAgeDays(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function mapSquareRow(row: any): SquareReportRow {
  const job = normalizeJob(row);
  const amountCents = cents(row?.amount_cents);
  const onlineFeeCents = cents(row?.online_fee_cents);
  const processingAmountCents = row?.processing_amount_cents == null
    ? Math.max(0, amountCents - onlineFeeCents)
    : cents(row?.processing_amount_cents);
  const status = str(row?.status).toLowerCase() || 'unknown';
  const completedAfterRetired = status === 'completed_after_superseded';
  const completed = status === 'completed' || (!!row?.completed_at && !completedAfterRetired);
  const inactive = ['superseded', 'cancelled', 'canceled', 'voided'].includes(status);
  const appProcessingPrice = money(job?.price_processing);
  const appProcessingPaid = money(job?.amount_paid_processing);
  const appPaidProcessing = !!job?.paid_processing || (appProcessingPrice > 0 && appProcessingPaid >= appProcessingPrice);
  const paymentMethod = str(job?.payment_method_processing).toLowerCase();
  const staleOpen = !completed && !inactive && rowAgeDays(row?.created_at || null) >= 1;
  const issueLabels: string[] = [];
  let issueLevel: SquareReportRow['issueLevel'] = 'ok';

  if (!job) {
    issueLabels.push('Job missing');
    issueLevel = 'critical';
  }
  if (completedAfterRetired) {
    issueLabels.push('Retired Square link was paid after in-person payment');
    issueLevel = 'critical';
  }
  if (completed && !appPaidProcessing) {
    issueLabels.push('Square paid, job not marked paid');
    issueLevel = 'critical';
  }
  if (completed && processingAmountCents > 0 && appProcessingPaid * 100 + 0.5 < processingAmountCents) {
    issueLabels.push('Processing paid amount is lower than Square processing payment');
    issueLevel = 'critical';
  }
  if (completed && appPaidProcessing && paymentMethod !== 'card') {
    issueLabels.push('App paid method is not card');
    issueLevel = issueLevel === 'critical' ? 'critical' : 'warning';
  }
  if (staleOpen) {
    issueLabels.push('Open Square link older than 24 hours');
    issueLevel = issueLevel === 'ok' ? 'warning' : issueLevel;
  }
  if (inactive && appPaidProcessing && !issueLabels.length) {
    issueLabels.push('Paid in app; Square link retired');
  }
  if (inactive && !appPaidProcessing && !issueLabels.length) {
    issueLabels.push('Square link retired');
  }
  if (!completed && !inactive && !issueLabels.length) {
    issueLabels.push('Square link created, not paid yet');
  }
  if (completed && appPaidProcessing && !issueLabels.length) {
    issueLabels.push('Square paid and app is marked paid');
  }

  const category = issueLevel !== 'ok'
    ? 'needs_attention'
    : completed || inactive
      ? 'paid'
      : 'open';

  return {
    id: str(row?.id),
    jobId: str(row?.job_id || job?.id),
    tag: str(job?.tag || row?.tag),
    confirmation: str(job?.confirmation || row?.confirmation),
    customer: str(job?.customer_name || row?.customer_name || 'Unknown customer'),
    status,
    squareEnvironment: str(row?.square_environment),
    checkoutUrl: str(row?.square_checkout_url),
    squarePaymentId: str(row?.square_payment_id),
    squareOrderId: str(row?.square_order_id),
    createdAt: row?.created_at || null,
    completedAt: row?.completed_at || null,
    updatedAt: row?.updated_at || null,
    lastEventAt: row?.last_event_at || null,
    paymentConfirmedAt: completed ? (row?.completed_at || row?.last_event_at || null) : null,
    amountCents,
    processingAmountCents,
    onlineFeeCents,
    appProcessingPrice,
    appProcessingPaid,
    appPaidProcessing,
    appPaymentMethod: paymentMethod || '-',
    issueLevel,
    issueLabels,
    category,
  };
}

function summarize(rows: SquareReportRow[]) {
  return {
    total: rows.length,
    openLinks: rows.filter((row) => row.category === 'open').length,
    needsAttention: rows.filter((row) => row.category === 'needs_attention').length,
    completedNotApplied: rows.filter((row) => row.issueLabels.includes('Square paid, job not marked paid')).length,
    paidOk: rows.filter((row) => row.category === 'paid').length,
    squarePaidCents: rows
      .filter((row) => row.status === 'completed' || row.completedAt)
      .reduce((sum, row) => sum + row.amountCents, 0),
    openLinkCents: rows
      .filter((row) => row.category === 'open')
      .reduce((sum, row) => sum + row.amountCents, 0),
  };
}

function missingSquareMigrationError(error: any) {
  const message = String(error?.message || error || '');
  return /square_payment_links|schema cache|relation .* does not exist|column .* does not exist/i.test(message);
}

export async function GET(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'view');
    if (denied) return denied;

    const supabase = getSupabaseServer();
    const limit = Math.min(500, Math.max(50, Number(new URL(req.url).searchParams.get('limit') || 250) || 250));
    let query = supabase
      .from('square_payment_links')
      .select(`
        id,job_id,processor_id,tag,confirmation,customer_name,amount_cents,processing_amount_cents,online_fee_cents,currency,status,
        square_environment,square_payment_link_id,square_order_id,square_payment_id,square_checkout_url,square_long_url,
        last_event_type,last_event_at,completed_at,created_at,updated_at,
        jobs(id,tag,confirmation,customer_name,price_processing,amount_paid_processing,paid_processing,payment_method_processing,paid_processing_at,pending_deleted_at,webbs_order)
      `);

    if (processor?.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data || []).map(mapSquareRow);
    return NextResponse.json({
      ok: true,
      rows,
      summary: summarize(rows),
    });
  } catch (err: any) {
    const error = missingSquareMigrationError(err)
      ? 'Square payment reporting needs the Square payment SQL migrations before this report can load.'
      : String(err?.message || err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
