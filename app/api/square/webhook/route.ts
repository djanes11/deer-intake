import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { normalizeUsPhone, sendSms } from '@/lib/sms';
import { verifySquareWebhookSignature } from '@/lib/square';
import { getSupabaseServer } from '@/lib/supabaseClient';

function clean(value: unknown) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

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

function hasUsableEmail(value: unknown) {
  const email = clean(value);
  return /\S+@\S+\.\S+/.test(email) ? email : '';
}

function normalizeBaseUrl(input: unknown) {
  const raw = clean(input).replace(/\/$/, '');
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
}

async function publicBaseUrlForPayment(supabase: any, job: any, link: any) {
  const processorId = clean(job?.processor_id || link?.processor_id);
  if (processorId) {
    try {
      const { data, error } = await supabase
        .from('processors')
        .select('public_hostname')
        .eq('id', processorId)
        .maybeSingle();
      if (error) throw error;
      const fromProcessor = normalizeBaseUrl((data as any)?.public_hostname);
      if (fromProcessor) return fromProcessor;
    } catch (error) {
      console.warn('Square payment confirmation public hostname lookup failed; falling back to env URL.', error);
    }
  }

  return normalizeBaseUrl(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '');
}

function statusPageUrl(baseUrl: string, confirmation: string) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return '';
  const conf = clean(confirmation);
  return conf ? `${root}/status?confirmation=${encodeURIComponent(conf)}` : `${root}/status`;
}

function formatCents(value: unknown) {
  const cents = Math.max(0, Math.trunc(Number(value ?? 0) || 0));
  return `$${(cents / 100).toFixed(2)}`;
}

function firstName(value: unknown) {
  return clean(value).split(/\s+/).filter(Boolean)[0] || 'there';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function paymentBranding(job: any) {
  const processorId = clean(job?.processor_id);
  try {
    const settings = await getPublicSiteSettings(null, processorId ? { id: processorId, slug: '' } : null);
    return clean(settings.branding.name) || 'Game Butcher Board';
  } catch {
    return 'Game Butcher Board';
  }
}

function paymentConfirmationCopy(opts: {
  businessName: string;
  customerName: string;
  confirmation: string;
  tag: string;
  amountCents: number;
  processingAmountCents: number;
  onlineFeeCents: number;
  statusUrl: string;
}) {
  const subject = `${opts.businessName} payment received`;
  const lines = [
    `Hi ${firstName(opts.customerName)},`,
    `We received your online Square payment for regular processing.`,
    `Confirmation: ${opts.confirmation || 'Not assigned'}`,
    opts.tag ? `Deer tag: ${opts.tag}` : '',
    `Regular processing: ${formatCents(opts.processingAmountCents)}`,
    `Online card fee: ${formatCents(opts.onlineFeeCents)}`,
    `Square total paid: ${formatCents(opts.amountCents)}`,
    `Webbs product charges are separate and will be provided when your Webbs order is delivered.`,
    opts.statusUrl ? `Check status: ${opts.statusUrl}` : '',
    `Thank you,`,
    opts.businessName,
  ].filter(Boolean);
  const text = lines.join('\n');
  const html = lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
  const sms = [
    `${opts.businessName}: Square payment received.`,
    opts.confirmation ? `Confirmation ${opts.confirmation}.` : '',
    `Regular processing ${formatCents(opts.processingAmountCents)} + card fee ${formatCents(opts.onlineFeeCents)} = ${formatCents(opts.amountCents)} paid.`,
    `Webbs product charges are separate and will be provided when delivered.`,
    opts.statusUrl ? `Status: ${opts.statusUrl}` : '',
  ].filter(Boolean).join(' ');

  return { subject, text, html, sms };
}

async function updatePaymentConfirmationState(supabase: any, linkId: string, patch: Record<string, any>) {
  try {
    const { error } = await supabase
      .from('square_payment_links')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', linkId);
    if (error) throw error;
  } catch (error) {
    console.error('Square payment confirmation state update failed', error);
  }
}

async function logPaymentConfirmationSms(supabase: any, opts: {
  jobId: string;
  processorId: string;
  phone: string;
  body: string;
  result: Awaited<ReturnType<typeof sendSms>>;
}) {
  try {
    await supabase.from('sms_logs').insert({
      ...(opts.processorId ? { processor_id: opts.processorId } : {}),
      job_id: opts.jobId,
      phone: opts.phone,
      template: 'processing_payment_received',
      body: opts.body,
      channel: 'sms',
      provider: 'twilio',
      status: opts.result.ok ? opts.result.status || 'queued' : opts.result.code,
      provider_message_sid: opts.result.ok ? opts.result.sid : null,
      error_code: opts.result.ok ? null : opts.result.code,
      error_message: opts.result.ok ? null : opts.result.error,
    });
  } catch (error) {
    console.error('Square payment confirmation SMS log failed (non-fatal)', error);
  }
}

async function sendPaymentConfirmation(params: {
  supabase: any;
  link: any;
  job: any;
}) {
  const { supabase, link, job } = params;
  const linkId = clean(link?.id);
  if (!linkId) return;

  const { data: currentLink, error: currentLinkError } = await supabase
    .from('square_payment_links')
    .select('id,amount_cents,processing_amount_cents,online_fee_cents,payment_confirmation_channel,payment_confirmation_email_sent_at,payment_confirmation_sms_sent_at')
    .eq('id', linkId)
    .maybeSingle();

  if (currentLinkError) {
    console.warn('Square payment confirmation skipped; tracking columns may need migration.', currentLinkError);
    return;
  }
  if (!currentLink || currentLink.payment_confirmation_email_sent_at || currentLink.payment_confirmation_sms_sent_at) return;

  const phone = normalizeUsPhone(clean(job?.phone));
  const email = hasUsableEmail(job?.email);
  const wantsSms = !!job?.pref_sms && !!job?.sms_consent && !!phone;
  const wantsEmail = (!!job?.pref_email || !!job?.pref_call) && !!email;
  const channel = wantsSms ? 'sms' : wantsEmail ? 'email' : '';
  if (!channel) return;

  const { data: claimed, error: claimError } = await supabase
    .from('square_payment_links')
    .update({
      payment_confirmation_channel: channel,
      payment_confirmation_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linkId)
    .is('payment_confirmation_channel', null)
    .is('payment_confirmation_email_sent_at', null)
    .is('payment_confirmation_sms_sent_at', null)
    .select('id')
    .maybeSingle();
  if (claimError) {
    console.warn('Square payment confirmation claim failed; skipping notification.', claimError);
    return;
  }
  if (!claimed) return;

  const businessName = await paymentBranding(job);
  const baseUrl = await publicBaseUrlForPayment(supabase, job, currentLink);
  const copy = paymentConfirmationCopy({
    businessName,
    customerName: clean(job?.customer_name),
    confirmation: clean(job?.confirmation),
    tag: clean(job?.tag),
    amountCents: Number(currentLink.amount_cents ?? link?.amount_cents ?? 0) || 0,
    processingAmountCents: Number(currentLink.processing_amount_cents ?? link?.processing_amount_cents ?? 0) || 0,
    onlineFeeCents: Number(currentLink.online_fee_cents ?? link?.online_fee_cents ?? 0) || 0,
    statusUrl: statusPageUrl(baseUrl, clean(job?.confirmation)),
  });

  try {
    if (channel === 'sms') {
      const result = await sendSms({ to: phone, body: copy.sms });
      await logPaymentConfirmationSms(supabase, {
        jobId: clean(job?.id),
        processorId: clean(job?.processor_id || link?.processor_id),
        phone,
        body: copy.sms,
        result,
      });
      if (!result.ok) throw new Error(result.error);
      await updatePaymentConfirmationState(supabase, linkId, {
        payment_confirmation_sms_sent_at: new Date().toISOString(),
        payment_confirmation_sms_sid: result.sid,
        payment_confirmation_error: null,
      });
      return;
    }

    await sendEmail({
      to: email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
    });
    await updatePaymentConfirmationState(supabase, linkId, {
      payment_confirmation_email_sent_at: new Date().toISOString(),
      payment_confirmation_error: null,
    });
  } catch (error: any) {
    const message = String(error?.message || error || 'Payment confirmation failed.').slice(0, 500);
    console.error('Square payment confirmation send failed', error);
    await updatePaymentConfirmationState(supabase, linkId, {
      payment_confirmation_error: message,
    });
  }
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
      .select('id,processor_id,tag,confirmation,customer_name,email,phone,pref_email,pref_sms,pref_call,sms_consent,price_processing,amount_paid_processing,price_specialty,amount_paid_specialty,paid_specialty')
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

    await sendPaymentConfirmation({ supabase, link, job });

    return NextResponse.json({ ok: true, status: 'completed' });
  } catch (error: any) {
    console.error('Square webhook error', error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
