import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { verifySquareWebhookSignature } from '@/lib/square';
import { getSupabaseServer } from '@/lib/supabaseClient';

function notificationUrl(req: NextRequest) {
  const configured = String(process.env.SQUARE_WEBHOOK_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}/api/square/webhook`;
  return req.url;
}

function money(value: unknown) {
  const n = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function paymentFromEvent(event: any) {
  return event?.data?.object?.payment || event?.data?.object || null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature');
  const webhookUrl = notificationUrl(req);

  if (!verifySquareWebhookSignature({ signature, body: rawBody, notificationUrl: webhookUrl })) {
    return NextResponse.json({ ok: false, error: 'Invalid Square webhook signature.' }, { status: 403 });
  }

  let event: any = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid webhook body.' }, { status: 400 });
  }

  try {
    const type = String(event?.type || '').trim();
    const payment = paymentFromEvent(event);
    const orderId = String(payment?.order_id || '').trim();
    const paymentId = String(payment?.id || '').trim();
    const paymentStatus = String(payment?.status || '').trim().toUpperCase();
    const paymentAmountCents = Number(payment?.amount_money?.amount ?? 0) || 0;

    if (!orderId || !paymentId || !type.startsWith('payment.')) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = getSupabaseServer();
    const { data: link, error: linkError } = await supabase
      .from('square_payment_links')
      .select('id,job_id,processor_id,amount_cents,processing_amount_cents,online_fee_cents,status')
      .eq('square_order_id', orderId)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'unknown_order' });
    }

    const nextLinkStatus =
      paymentStatus === 'COMPLETED'
        ? 'completed'
        : paymentStatus
          ? paymentStatus.toLowerCase()
          : 'updated';

    const linkPatch: Record<string, any> = {
      status: nextLinkStatus,
      square_payment_id: paymentId,
      last_event_type: type,
      last_event_at: new Date().toISOString(),
      raw_last_event: event,
      updated_at: new Date().toISOString(),
    };
    if (paymentStatus === 'COMPLETED') linkPatch.completed_at = new Date().toISOString();

    const { error: updateLinkError } = await supabase
      .from('square_payment_links')
      .update(linkPatch)
      .eq('id', (link as any).id);
    if (updateLinkError) throw updateLinkError;

    if (paymentStatus !== 'COMPLETED') {
      return NextResponse.json({ ok: true, status: nextLinkStatus });
    }

    const expectedAmount = Number((link as any).amount_cents ?? 0) || 0;
    if (expectedAmount > 0 && paymentAmountCents > 0 && paymentAmountCents < expectedAmount) {
      return NextResponse.json({ ok: true, status: 'completed_under_expected_amount' });
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id,processor_id,price_processing,amount_paid_processing,price_specialty,amount_paid_specialty,paid_specialty')
      .eq('id', (link as any).job_id)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ ok: true, ignored: true, reason: 'job_missing' });

    const processingPrice = money((job as any).price_processing);
    const currentProcessingPaid = money((job as any).amount_paid_processing);
    const linkedProcessingPaid = Math.max(0, Number((link as any).processing_amount_cents ?? 0) || 0) / 100;
    const nextProcessingPaid = Math.max(currentProcessingPaid, linkedProcessingPaid || Math.min(processingPrice, paymentAmountCents / 100));
    const paidProcessing = processingPrice <= 0 || nextProcessingPaid >= processingPrice;
    const specialtyPrice = money((job as any).price_specialty);
    const specialtyPaid = !!(job as any).paid_specialty || money((job as any).amount_paid_specialty) >= specialtyPrice;
    const paidOverall = paidProcessing && (specialtyPrice <= 0 || specialtyPaid);

    const { error: updateJobError } = await supabase
      .from('jobs')
      .update({
        amount_paid_processing: nextProcessingPaid,
        paid_processing: paidProcessing,
        payment_method_processing: 'card',
        paid_processing_at: paidProcessing ? new Date().toISOString() : null,
        paid: paidOverall,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (job as any).id);
    if (updateJobError) throw updateJobError;

    return NextResponse.json({ ok: true, status: 'completed' });
  } catch (error: any) {
    console.error('Square webhook error', error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
