import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { writeAuditEntry } from '@/lib/auditLog';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { sendSquarePaymentConfirmation } from '@/lib/squarePaymentConfirmation';
import { getSupabaseServer } from '@/lib/supabaseClient';

type SquareReportRow = {
  id: string;
  jobId: string;
  tag: string;
  confirmation: string;
  customer: string;
  email: string;
  phone: string;
  contactPreference: string;
  status: string;
  squareEnvironment: string;
  checkoutUrl: string;
  squarePaymentId: string;
  createdAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  lastEventAt: string | null;
  amountCents: number;
  processingAmountCents: number;
  onlineFeeCents: number;
  appProcessingPrice: number;
  appProcessingPaid: number;
  appPaidProcessing: boolean;
  appPaymentMethod: string;
  issueLevel: 'critical' | 'warning' | 'ok';
  issueLabels: string[];
  category: 'needs_attention' | 'open' | 'paid' | 'all';
  paymentConfirmationChannel: string;
  paymentConfirmationSentAt: string | null;
  paymentConfirmationError: string;
  expectedConfirmationChannel: 'sms' | 'email' | '';
  expectedConfirmationDestination: string;
  canRetryConfirmation: boolean;
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

function hasEmail(value: unknown) {
  const email = str(value);
  return /\S+@\S+\.\S+/.test(email) ? email : '';
}

function hasPhone(value: unknown) {
  const phone = str(value);
  return phone.replace(/\D/g, '').length >= 10 ? phone : '';
}

function contactForJob(job: any): {
  preference: string;
  channel: 'sms' | 'email' | '';
  destination: string;
} {
  const phone = hasPhone(job?.phone);
  const email = hasEmail(job?.email);
  if (job?.pref_sms && job?.sms_consent && phone) {
    return { preference: 'Text', channel: 'sms', destination: phone };
  }
  if (job?.pref_email && email) {
    return { preference: 'Email', channel: 'email', destination: email };
  }
  if (job?.pref_call) {
    return {
      preference: 'Phone Call',
      channel: email ? 'email' : '',
      destination: email,
    };
  }
  return { preference: 'Not set', channel: '', destination: '' };
}

function mapSquareRow(row: any): SquareReportRow {
  const job = normalizeJob(row);
  const amountCents = cents(row?.amount_cents);
  const onlineFeeCents = cents(row?.online_fee_cents);
  const processingAmountCents = row?.processing_amount_cents == null
    ? Math.max(0, amountCents - onlineFeeCents)
    : cents(row?.processing_amount_cents);
  const status = str(row?.status).toLowerCase() || 'unknown';
  const completed = status === 'completed' || !!row?.completed_at;
  const appProcessingPrice = money(job?.price_processing);
  const appProcessingPaid = money(job?.amount_paid_processing);
  const appPaidProcessing = !!job?.paid_processing || (appProcessingPrice > 0 && appProcessingPaid >= appProcessingPrice);
  const paymentMethod = str(job?.payment_method_processing).toLowerCase();
  const confirmationSentAt = row?.payment_confirmation_sms_sent_at || row?.payment_confirmation_email_sent_at || null;
  const confirmationError = str(row?.payment_confirmation_error);
  const expectedContact = contactForJob(job);
  const staleOpen = !completed && rowAgeDays(row?.created_at || null) >= 1;
  const issueLabels: string[] = [];
  let issueLevel: SquareReportRow['issueLevel'] = 'ok';

  if (!job) {
    issueLabels.push('Job missing');
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
  if (completed && confirmationError) {
    issueLabels.push('Payment confirmation failed');
    issueLevel = issueLevel === 'critical' ? 'critical' : 'warning';
  }
  if (completed && expectedContact.channel && !confirmationSentAt) {
    issueLabels.push('Payment confirmation not sent');
    issueLevel = issueLevel === 'critical' ? 'critical' : 'warning';
  }
  if (completed && !expectedContact.channel) {
    issueLabels.push('No eligible payment confirmation destination');
    issueLevel = issueLevel === 'critical' ? 'critical' : 'warning';
  }
  if (staleOpen) {
    issueLabels.push('Open Square link older than 24 hours');
    issueLevel = issueLevel === 'ok' ? 'warning' : issueLevel;
  }
  if (!completed && !issueLabels.length) {
    issueLabels.push('Square link created, not paid yet');
  }
  if (completed && appPaidProcessing && !issueLabels.length) {
    issueLabels.push('Square paid and app is marked paid');
  }
  if (completed && appPaidProcessing && paymentMethod !== 'card') {
    issueLabels.push('App paid method is not card');
    issueLevel = issueLevel === 'critical' ? 'critical' : 'warning';
  }

  const needsAttention = issueLevel !== 'ok';
  const category = needsAttention
    ? 'needs_attention'
    : completed
      ? 'paid'
      : 'open';

  return {
    id: str(row?.id),
    jobId: str(row?.job_id || job?.id),
    tag: str(job?.tag || row?.tag),
    confirmation: str(job?.confirmation || row?.confirmation),
    customer: str(job?.customer_name || row?.customer_name || 'Unknown customer'),
    email: str(job?.email),
    phone: str(job?.phone),
    contactPreference: expectedContact.preference,
    status,
    squareEnvironment: str(row?.square_environment),
    checkoutUrl: str(row?.square_checkout_url),
    squarePaymentId: str(row?.square_payment_id),
    createdAt: row?.created_at || null,
    completedAt: row?.completed_at || null,
    updatedAt: row?.updated_at || null,
    lastEventAt: row?.last_event_at || null,
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
    paymentConfirmationChannel: str(row?.payment_confirmation_channel),
    paymentConfirmationSentAt: confirmationSentAt,
    paymentConfirmationError: confirmationError,
    expectedConfirmationChannel: expectedContact.channel,
    expectedConfirmationDestination: expectedContact.destination,
    canRetryConfirmation: completed && !!expectedContact.channel && !confirmationSentAt,
  };
}

function summarize(rows: SquareReportRow[]) {
  return {
    total: rows.length,
    openLinks: rows.filter((row) => row.category === 'open').length,
    needsAttention: rows.filter((row) => row.category === 'needs_attention').length,
    completedNotApplied: rows.filter((row) => row.issueLabels.includes('Square paid, job not marked paid')).length,
    confirmationIssues: rows.filter((row) => row.canRetryConfirmation || row.paymentConfirmationError).length,
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
  return /square_payment_links|schema cache|payment_confirmation_|relation .* does not exist|column .* does not exist/i.test(message);
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
        last_event_type,last_event_at,completed_at,payment_confirmation_channel,payment_confirmation_email_sent_at,
        payment_confirmation_sms_sent_at,payment_confirmation_sms_sid,payment_confirmation_error,created_at,updated_at,
        jobs(id,tag,confirmation,customer_name,email,phone,pref_email,pref_sms,pref_call,sms_consent,price_processing,amount_paid_processing,paid_processing,payment_method_processing,paid_processing_at,pending_deleted_at,webbs_order)
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
      canRetryConfirmations: processor?.role === 'admin',
    });
  } catch (err: any) {
    const error = missingSquareMigrationError(err)
      ? 'Square payment reporting needs the Square payment SQL migrations before this report can load.'
      : String(err?.message || err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'manage_notifications');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const linkId = str(body?.linkId);
    if (!linkId) {
      return NextResponse.json({ ok: false, error: 'linkId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let linkQuery = supabase
      .from('square_payment_links')
      .select('id,job_id,processor_id,tag,confirmation,customer_name,amount_cents,processing_amount_cents,online_fee_cents,status,payment_confirmation_channel,payment_confirmation_email_sent_at,payment_confirmation_sms_sent_at,payment_confirmation_error')
      .eq('id', linkId);
    if (processor?.id) linkQuery = linkQuery.eq('processor_id', processor.id);

    const { data: link, error: linkError } = await linkQuery.maybeSingle();
    if (linkError) throw linkError;
    if (!link) return NextResponse.json({ ok: false, error: 'Square payment link was not found.' }, { status: 404 });
    if (str((link as any).status).toLowerCase() !== 'completed') {
      return NextResponse.json({ ok: false, error: 'Only completed Square payments can receive a payment confirmation.' }, { status: 400 });
    }

    let jobQuery = supabase
      .from('jobs')
      .select('id,processor_id,tag,confirmation,customer_name,email,phone,pref_email,pref_sms,pref_call,sms_consent,price_processing,amount_paid_processing,paid_processing,payment_method_processing')
      .eq('id', (link as any).job_id);
    if (processor?.id) jobQuery = jobQuery.eq('processor_id', processor.id);

    const { data: job, error: jobError } = await jobQuery.maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ ok: false, error: 'The job for this Square payment was not found.' }, { status: 404 });

    const result = await sendSquarePaymentConfirmation({ supabase, link, job, force: true });

    await writeAuditEntry({
      req,
      processorId: processor?.id,
      action: 'payment.confirmation_retried',
      targetType: 'square_payment_link',
      targetId: linkId,
      targetLabel: str((job as any).tag || (job as any).confirmation || linkId),
      summary: `Retried Square payment confirmation for ${str((job as any).customer_name || (job as any).tag || linkId)}`,
      details: result,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    const error = missingSquareMigrationError(err)
      ? 'Square payment confirmation tracking columns are missing. Run the Square payment confirmation SQL migration first.'
      : String(err?.message || err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
