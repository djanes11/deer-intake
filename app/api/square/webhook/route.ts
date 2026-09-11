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

    const { data, error } = await getSupabaseServer().rpc('apply_square_processing_payment', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_status: paymentStatus,
      p_amount_cents: paymentAmountCents,
      p_currency: String(payment?.amount_money?.currency || ''),
      p_event_type: type,
      p_event: event,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Square webhook error', error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
