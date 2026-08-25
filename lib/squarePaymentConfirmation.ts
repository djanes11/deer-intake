import 'server-only';

import { sendEmail } from '@/lib/email';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { normalizeUsPhone, sendSms } from '@/lib/sms';

export type SquarePaymentConfirmationResult =
  | { ok: true; channel: 'sms' | 'email'; destination: string; skipped?: false }
  | { ok: true; channel: null; destination: null; skipped: true; reason: string }
  | { ok: false; channel: 'sms' | 'email' | null; destination: string | null; error: string };

function clean(value: unknown) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
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
  const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
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

export async function sendSquarePaymentConfirmation(params: {
  supabase: any;
  link: any;
  job: any;
  force?: boolean;
}): Promise<SquarePaymentConfirmationResult> {
  const { supabase, link, job } = params;
  const linkId = clean(link?.id);
  if (!linkId) return { ok: true, channel: null, destination: null, skipped: true, reason: 'missing_link' };

  const { data: currentLink, error: currentLinkError } = await supabase
    .from('square_payment_links')
    .select('id,amount_cents,processing_amount_cents,online_fee_cents,payment_confirmation_channel,payment_confirmation_email_sent_at,payment_confirmation_sms_sent_at')
    .eq('id', linkId)
    .maybeSingle();

  if (currentLinkError) {
    const error = String(currentLinkError?.message || currentLinkError);
    console.warn('Square payment confirmation skipped; tracking columns may need migration.', currentLinkError);
    return { ok: false, channel: null, destination: null, error };
  }
  if (!currentLink) {
    return { ok: true, channel: null, destination: null, skipped: true, reason: 'link_missing' };
  }
  if (currentLink.payment_confirmation_email_sent_at) {
    return { ok: true, channel: null, destination: null, skipped: true, reason: 'email_already_sent' };
  }
  if (currentLink.payment_confirmation_sms_sent_at) {
    return { ok: true, channel: null, destination: null, skipped: true, reason: 'sms_already_sent' };
  }

  const phone = normalizeUsPhone(clean(job?.phone));
  const email = hasUsableEmail(job?.email);
  const wantsSms = !!job?.pref_sms && !!job?.sms_consent && !!phone;
  const wantsEmail = (!!job?.pref_email || !!job?.pref_call) && !!email;
  const channel = wantsSms ? 'sms' : wantsEmail ? 'email' : '';
  if (!channel) {
    return { ok: true, channel: null, destination: null, skipped: true, reason: 'no_eligible_destination' };
  }

  let claim = supabase
    .from('square_payment_links')
    .update({
      payment_confirmation_channel: channel,
      payment_confirmation_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linkId)
    .is('payment_confirmation_email_sent_at', null)
    .is('payment_confirmation_sms_sent_at', null);
  if (!params.force) {
    claim = claim.is('payment_confirmation_channel', null);
  }

  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError) {
    const error = String(claimError?.message || claimError);
    console.warn('Square payment confirmation claim failed; skipping notification.', claimError);
    return { ok: false, channel, destination: channel === 'sms' ? phone : email, error };
  }
  if (!claimed) {
    return { ok: true, channel: null, destination: null, skipped: true, reason: 'already_claimed' };
  }

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
      return { ok: true, channel, destination: phone };
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
    return { ok: true, channel, destination: email };
  } catch (error: any) {
    const message = String(error?.message || error || 'Payment confirmation failed.').slice(0, 500);
    console.error('Square payment confirmation send failed', error);
    await updatePaymentConfirmationState(supabase, linkId, {
      payment_confirmation_error: message,
    });
    return { ok: false, channel, destination: channel === 'sms' ? phone : email, error: message };
  }
}
