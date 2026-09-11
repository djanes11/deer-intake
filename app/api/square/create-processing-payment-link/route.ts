import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getProcessorContextForHostname } from '@/lib/processorContext';
import { sharedRateLimit } from '@/lib/ratelimit';
import { createSquareProcessingPaymentLink, deleteSquarePaymentLink, getSquareConfig, squareMoneyCents } from '@/lib/square';
import { SQUARE_ONLINE_PAYMENT_FEE_CENTS } from '@/lib/paymentConfig';
import { getSupabaseServer } from '@/lib/supabaseClient';

function getIp(req: NextRequest): string {
  return (
    (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function publicBaseUrl(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  const envUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  return String(envUrl || '').trim().replace(/\/$/, '');
}

function money(value: unknown) {
  const n = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  try {
    const rl = await sharedRateLimit(getIp(req), 'square-create-link', 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Too many payment link attempts. Please wait a minute and try again.' }, { status: 429 });
    }

    const config = getSquareConfig();

    const body = await req.json().catch(() => ({}));
    const publicToken = String(body?.publicToken || '').trim();
    if (!publicToken) {
      return NextResponse.json({ ok: false, error: 'Missing saved intake token.' }, { status: 400 });
    }

    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const processor = await getProcessorContextForHostname(hostname);
    const supabase = getSupabaseServer();

    let jobQuery = supabase
      .from('jobs')
      .select('id,processor_id,tag,confirmation,customer_name,email,phone,public_token,webbs_order,price_processing,amount_paid_processing,paid_processing,payment_method_processing,paid_processing_at,pending_deleted_at,dropoff_date')
      .eq('public_token', publicToken)
      .is('pending_deleted_at', null);
    if (processor.id) jobQuery = jobQuery.eq('processor_id', processor.id);

    const { data: job, error: jobError } = await jobQuery.maybeSingle();
    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Saved intake was not found.' }, { status: 404 });
    }
    if (!(job as any).webbs_order) {
      return NextResponse.json({ ok: false, error: 'Online processing payment is only needed for Webbs public intakes.' }, { status: 400 });
    }

    const priceProcessing = money((job as any).price_processing);
    const amountPaid = money((job as any).amount_paid_processing);
    const due = Math.max(0, priceProcessing - amountPaid);
    const processingAmountCents = squareMoneyCents(due);
    const onlineFeeCents = SQUARE_ONLINE_PAYMENT_FEE_CENTS;
    const amountCents = processingAmountCents + onlineFeeCents;
    if ((job as any).paid_processing || processingAmountCents <= 0) {
      return NextResponse.json({ ok: true, paid: true, message: 'Regular processing is already marked paid.' });
    }

    const linkAmounts = {
      amount_cents: amountCents, processing_amount_cents: processingAmountCents,
      online_fee_cents: onlineFeeCents, square_environment: config.environment,
    };
    const publish = async (link: Record<string, any>) => {
      const { data, error } = await supabase.rpc('publish_square_checkout', {
        p_job_id: job.id, p_processor_id: job.processor_id,
        p_expected_price: priceProcessing, p_expected_paid: amountPaid,
        p_link: { ...linkAmounts, ...link },
      });
      if (error) throw error;
      if (!data) throw new Error('Could not validate checkout. Please try again.');
      return data;
    };
    const preflight = await publish({});
    if (preflight.checkoutUrl) {
      return NextResponse.json({ ok: true, ...preflight, amountCents, processingAmountCents, onlineFeeCents });
    }

    const root = publicBaseUrl(req);
    const confirmation = String((job as any).confirmation || '');
    const redirectUrl = root
      ? `${root}/status?confirmation=${encodeURIComponent(confirmation)}`
      : `/status?confirmation=${encodeURIComponent(confirmation)}`;
    const idempotencyKey = crypto.randomUUID();
    const created = await createSquareProcessingPaymentLink({
      idempotencyKey,
      amountCents,
      customerName: String((job as any).customer_name || ''),
      confirmation,
      buyerEmail: String((job as any).email || ''),
      buyerPhone: String((job as any).phone || ''),
      tag: (job as any).tag,
      redirectUrl,
      note: `Regular processing: $${(processingAmountCents / 100).toFixed(2)} | Online payment fee: $${(onlineFeeCents / 100).toFixed(2)} | job:${(job as any).id} | confirmation:${confirmation}`,
    });

    let published;
    try {
      published = await publish({
        square_payment_link_id: created.paymentLinkId, square_order_id: created.orderId,
        square_checkout_url: created.url, square_long_url: created.longUrl || null,
        idempotency_key: idempotencyKey, raw_create_response: created.raw,
      });
    } catch (error) {
      // Never expose a checkout based on a balance that changed during the Square request.
      await deleteSquarePaymentLink(created.paymentLinkId).catch(cancelError => console.error('Square checkout cleanup required', created.paymentLinkId, cancelError));
      // Also handles an ambiguous RPC response that committed before the connection failed.
      await supabase.from('square_payment_links').update({ status: 'superseded' }).eq('square_payment_link_id', created.paymentLinkId).in('status', ['pending', 'created', 'open']);
      throw error;
    }
    if (published.reused) {
      await deleteSquarePaymentLink(created.paymentLinkId).catch(error => console.error('Unused Square checkout cleanup required', created.paymentLinkId, error));
    }
    for (const retired of published.retired || []) {
      // Production credentials cannot cancel sandbox resources (or the reverse).
      if (retired.id && retired.environment === config.environment) {
        await deleteSquarePaymentLink(retired.id).catch(error => console.error('Retired Square checkout cleanup required', retired.id, error));
      }
    }
    return NextResponse.json({
      ok: true, checkoutUrl: published.checkoutUrl, reused: published.reused,
      amountCents, processingAmountCents, onlineFeeCents,
    });
  } catch (error: any) {
    console.error('create Square processing payment link error', error);
    const message = String(error?.message || error || 'Could not create Square payment link.');
    const missingTable = /square_payment_links|schema cache|relation .* does not exist/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        error: missingTable
          ? 'Square payment tracking table is missing. Run the Square payment SQL migration first.'
          : message,
      },
      { status: error?.code === '40001' ? 409 : missingTable ? 500 : 400 }
    );
  }
}
