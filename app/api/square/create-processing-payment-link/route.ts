import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getProcessorContextForHostname } from '@/lib/processorContext';
import { sharedRateLimit } from '@/lib/ratelimit';
import { createSquareProcessingPaymentLink, getSquareConfig, squareMoneyCents } from '@/lib/square';
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

    getSquareConfig();

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
    const amountCents = squareMoneyCents(due);
    if ((job as any).paid_processing || amountCents <= 0) {
      return NextResponse.json({ ok: true, paid: true, message: 'Regular processing is already marked paid.' });
    }

    const { data: existingLink, error: existingError } = await supabase
      .from('square_payment_links')
      .select('id,square_checkout_url,amount_cents,status,square_order_id')
      .eq('job_id', (job as any).id)
      .in('status', ['pending', 'created', 'open'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingLink?.square_checkout_url) {
      return NextResponse.json({
        ok: true,
        checkoutUrl: String(existingLink.square_checkout_url),
        amountCents: Number(existingLink.amount_cents || amountCents),
        reused: true,
      });
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
      tag: (job as any).tag,
      redirectUrl,
      note: `Regular processing payment | job:${(job as any).id} | confirmation:${confirmation}`,
    });

    const { error: insertError } = await supabase
      .from('square_payment_links')
      .insert({
        job_id: (job as any).id,
        processor_id: (job as any).processor_id || processor.id || null,
        tag: (job as any).tag || null,
        confirmation,
        customer_name: (job as any).customer_name || null,
        amount_cents: amountCents,
        currency: 'USD',
        status: 'pending',
        square_environment: getSquareConfig().environment,
        square_payment_link_id: created.paymentLinkId,
        square_order_id: created.orderId,
        square_checkout_url: created.url,
        square_long_url: created.longUrl || null,
        idempotency_key: idempotencyKey,
        raw_create_response: created.raw,
      });
    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      checkoutUrl: created.url,
      amountCents,
      reused: false,
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
      { status: missingTable ? 500 : 400 }
    );
  }
}
