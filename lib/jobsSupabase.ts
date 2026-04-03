// lib/jobsSupabase.ts
import { getSupabaseServer } from './supabaseClient';
import { Job, JobSearchRow } from '@/types/job';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { normalizeUsPhone, sendSms } from '@/lib/sms';
import { specialtyPrice, specialtyTotalLbs } from '@/lib/specialty';
import { normalizeWebbsAllocations, normalizeWebbsOrderItems, normalizeWebbsOrderStyle } from '@/lib/webbs';
import { calcProcessingPrice, SitePricing } from '@/lib/pricing';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { getDefaultProcessorContext, type ProcessorContext } from '@/lib/processorContext';

/* ---------------- helpers ---------------- */

const SITE_URL = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/$/, '');
function withProcessorFilter<T>(query: T, processorId: string | null | undefined): T {
  if (!processorId) return query;
  return (query as any).eq('processor_id', processorId);
}

function makePublicToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function escapeHtml(s: any) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function intakeFormLink(tag: string, publicToken: string) {
  if (!SITE_URL) return '';
  return `${SITE_URL}/intake/${encodeURIComponent(tag)}?t=${encodeURIComponent(publicToken)}`;
}

function statusPageLink() {
  if (!SITE_URL) return '';
  return `${SITE_URL}/status`;
}

async function getNotificationBranding() {
  const settings = await getPublicSiteSettings();
  return {
    businessName: String(settings.branding.name || 'Game Butcher Board'),
    phoneDisplay: String(settings.branding.phoneDisplay || ''),
  };
}

function buildIntakeEmail(opts: { name: string; tag: string; link: string; businessName: string; phoneDisplay: string }) {
  const name = opts.name || 'there';
  return {
    subject: `We received your deer (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>We received your deer (${escapeHtml(opts.tag)})</p>`,
      opts.link ? `<p><a href="${opts.link}" target="_blank" rel="noopener">Click here to view your intake form</a></p>` : '',
      `<p>If you need to make any updates or have questions, please contact ${escapeHtml(opts.businessName)}${opts.phoneDisplay ? ` at ${escapeHtml(opts.phoneDisplay)}` : ''}.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `We received your deer (${opts.tag})\n` +
      (opts.link ? `Click here to view your intake form: ${opts.link}\n` : '') +
      `If you need to make any updates or have questions, please contact ${opts.businessName}${opts.phoneDisplay ? ` at ${opts.phoneDisplay}` : ''}\n`,
  };
}

/** Only send customer-facing emails once we have a real tag (prevents overnight/no-tag duplicates). */
function hasRealTag(row: any) {
  const t = String(row?.tag ?? '').trim();
  return !!t;
}

function makePendingTag(confirmation13: string) {
  const last5 = String(confirmation13 ?? '').replace(/\D/g, '').slice(-5) || '00000';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PENDING-${last5}-${ts}-${rand}`;
}


function buildFinishedEmail(opts: { name: string; tag: string; paidProcessing: boolean; processingPrice: number; businessName: string; phoneDisplay: string }) {
  const name = opts.name || 'there';
  const paid = !!opts.paidProcessing;
  const price = Number(opts.processingPrice || 0);

  const payBlock = paid
    ? `<div style="padding:10px 12px;border:1px solid #16a34a;border-radius:10px;background:#f0fdf4;"><b>Regular processing:</b> PAID</div>`
    : `<div style="padding:10px 12px;border:1px solid #dc2626;border-radius:10px;background:#fef2f2;"><b>Amount still owed (regular processing):</b> $${price.toFixed(2)}</div>`;

  return {
    subject: `Finished & ready for pickup (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>Your regular processing is finished and ready for pickup.</p>`,
      payBlock,
      `<p><b>Pickup hours:</b> 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.</p>`,
      `<p>Please contact ${escapeHtml(opts.businessName)}${opts.phoneDisplay ? ` at ${escapeHtml(opts.phoneDisplay)}` : ''} to confirm your pickup time or ask any questions. Also, check our Facebook for any temporary closures.</p>`,
      `<p>Please bring a cooler or box to transport your meat.</p>`,
      `<p><i>Reminder:</i> This update is for your regular processing only. We'll reach out separately about any additional order items.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `Your regular processing is finished and ready for pickup.\n\n` +
      (paid ? 'Regular processing: PAID' : `Amount still owed (regular processing): $${price.toFixed(2)}`) +
      `\n\nPickup hours: 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.\n` +
      `Please contact ${opts.businessName}${opts.phoneDisplay ? ` at ${opts.phoneDisplay}` : ''} to confirm your pickup time or ask any questions. Also, check our Facebook for any temporary closures.\n` +
      `Please bring a cooler or box to transport your meat.\n` +
      `Reminder: This update is for your regular processing only. We'll reach out separately about any additional order items.\n`,
  };
}

function buildIntakeSms(opts: { tag: string; statusUrl: string; businessName: string }) {
  const tag = String(opts.tag || '').trim();
  const statusUrl = String(opts.statusUrl || '').trim();
  const parts = [
    `${opts.businessName}: Deer tagged ${tag}.`,
    statusUrl ? `Status: ${statusUrl}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function buildMeatFinishedSms(opts: { tag: string; paidProcessing: boolean; processingPrice: number; statusUrl: string; businessName: string }) {
  return [
    `${opts.businessName}: Meat ready for pickup. ${opts.tag}.`,
    opts.statusUrl ? `Status: ${opts.statusUrl}` : '',
  ].filter(Boolean).join(' ');
}

function buildCapeFinishedSms(opts: { tag: string; statusUrl: string; businessName: string }) {
  return [
    `${opts.businessName}: Cape ready for pickup. ${opts.tag}.`,
    opts.statusUrl ? `Status: ${opts.statusUrl}` : '',
  ].filter(Boolean).join(' ');
}

function buildSpecialtyFinishedSms(opts: { tag: string; paidSpecialty: boolean; specialtyPrice: number; statusUrl: string; businessName: string }) {
  return [
    `${opts.businessName}: Specialty ready for pickup. ${opts.tag}.`,
    opts.statusUrl ? `Status: ${opts.statusUrl}` : '',
  ].filter(Boolean).join(' ');
}

function buildWebbsDeliveredSms(opts: { tag: string; statusUrl: string; businessName: string }) {
  return [
    `${opts.businessName}: Webbs delivered. ${opts.tag}.`,
    opts.statusUrl ? `Status: ${opts.statusUrl}` : '',
  ].filter(Boolean).join(' ');
}

function buildCapeFinishedEmail(opts: { name: string; tag: string; businessName: string; phoneDisplay: string }) {
  const name = opts.name || 'there';
  return {
    subject: `Cape finished & ready for pickup (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>Your cape is finished and ready for pickup.</p>`,
      `<p><b>Pickup hours:</b> 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.</p>`,
      `<p>Please contact ${escapeHtml(opts.businessName)}${opts.phoneDisplay ? ` at ${escapeHtml(opts.phoneDisplay)}` : ''} to confirm your pickup time or ask any questions.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `Your cape is finished and ready for pickup.\n\n` +
      `Pickup hours: 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.\n` +
      `Please contact ${opts.businessName}${opts.phoneDisplay ? ` at ${opts.phoneDisplay}` : ''} to confirm your pickup time or ask any questions.\n`,
  };
}

function buildSpecialtyFinishedEmail(opts: {
  name: string;
  tag: string;
  paidSpecialty: boolean;
  specialtyPrice: number;
  businessName: string;
  phoneDisplay: string;
}) {
  const name = opts.name || 'there';
  const paid = !!opts.paidSpecialty;
  const price = Number(opts.specialtyPrice || 0);
  const payBlock = paid
    ? `<div style="padding:10px 12px;border:1px solid #16a34a;border-radius:10px;background:#f0fdf4;"><b>Specialty products:</b> PAID</div>`
    : `<div style="padding:10px 12px;border:1px solid #dc2626;border-radius:10px;background:#fef2f2;"><b>Amount still owed (specialty products):</b> $${price.toFixed(2)}</div>`;

  return {
    subject: `Specialty products finished (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>Your specialty products are finished and ready for pickup.</p>`,
      payBlock,
      `<p><b>Pickup hours:</b> 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.</p>`,
      `<p>Please contact ${escapeHtml(opts.businessName)}${opts.phoneDisplay ? ` at ${escapeHtml(opts.phoneDisplay)}` : ''} to confirm your pickup time or ask any questions.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `Your specialty products are finished and ready for pickup.\n\n` +
      (paid ? 'Specialty products: PAID' : `Amount still owed (specialty products): $${price.toFixed(2)}`) +
      `\n\nPickup hours: 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.\n` +
      `Please contact ${opts.businessName}${opts.phoneDisplay ? ` at ${opts.phoneDisplay}` : ''} to confirm your pickup time or ask any questions.\n`,
  };
}

function buildWebbsDeliveredEmail(opts: { name: string; tag: string; businessName: string; phoneDisplay: string }) {
  const name = opts.name || 'there';
  return {
    subject: `Webbs order delivered (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>Your Webbs order has been delivered and is ready for pickup.</p>`,
      `<p><b>Pickup hours:</b> 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.</p>`,
      `<p>Please contact ${escapeHtml(opts.businessName)}${opts.phoneDisplay ? ` at ${escapeHtml(opts.phoneDisplay)}` : ''} to confirm your pickup time or ask any questions.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `Your Webbs order has been delivered and is ready for pickup.\n\n` +
      `Pickup hours: 6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.\n` +
      `Please contact ${opts.businessName}${opts.phoneDisplay ? ` at ${opts.phoneDisplay}` : ''} to confirm your pickup time or ask any questions.\n`,
  };
}

function statusIsFinishedLike(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return /finish|ready/.test(s);
}

function processTypeNeedsCape(processType: any) {
  const p = normProc(processType);
  return p === 'Caped' || p === 'Cape & Donate';
}


function nowIso() {
  return new Date().toISOString();
}

// --- Numeric coercion (Supabase/Postgres numeric columns cannot accept "")
function numOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null; // "" -> null
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function numOrZero(v: any): number {
  const n = numOrNull(v);
  return n === null ? 0 : n;
}

function intOrNull(v: any): number | null {
  const n = numOrNull(v);
  if (n === null) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
}

// --- Pricing (server-side, so db + emails always have a value even if UI leaves it blank)
function normProc(s?: string) {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}

let cachedPricing: { value: SitePricing; expiresAt: number } | null = null;

async function getCurrentPricing(): Promise<SitePricing> {
  const now = Date.now();
  if (cachedPricing && cachedPricing.expiresAt > now) {
    return cachedPricing.value;
  }
  const settings = await getPublicSiteSettings();
  cachedPricing = {
    value: settings.pricing,
    expiresAt: now + 30_000,
  };
  return settings.pricing;
}

function lower(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function hasAny(s: any, needles: string[]) {
  const t = lower(s);
  if (!t) return false;
  return needles.some((n) => t.includes(n));
}

function isCalled(s: any) {
  return lower(s) === 'called';
}

// Match the frontend's ready logic closely enough
function meatReady(status: any) {
  const s = lower(status);
  if (!s) return false;
  if (s === 'called') return false;
  return /finish|ready|complete|completed|done/.test(s);
}

function capeReady(capingStatus: any) {
  const s = lower(capingStatus);
  if (!s) return false;
  if (s === 'called') return false;
  return /cape|caped|ready|complete|completed|done/.test(s);
}

function webbsReady(webbsStatus: any) {
  const s = lower(webbsStatus);
  if (!s) return false;
  if (s === 'called') return false;
  return /deliver|delivered|ready|complete|completed|done/.test(s);
}

function specialtyReady(specialtyStatus: any) {
  const s = lower(specialtyStatus);
  if (!s) return false;
  if (s === 'called') return false;
  return /finish|ready|complete|completed|done/.test(s);
}

type NotificationChannel = 'sms' | 'email' | 'call' | 'none';

function hasUsableEmail(row: any) {
  return /\S+@\S+\.\S+/.test(String(row?.email || '').trim());
}

function hasUsablePhone(row: any) {
  const digits = String(row?.phone || '').replace(/\D/g, '');
  return digits.length >= 10;
}

function preferredNotificationChannel(row: any): NotificationChannel {
  if (!row) return 'none';

  const wantsSms = !!row.pref_sms && !!row.sms_consent && hasUsablePhone(row);
  if (wantsSms) return 'sms';

  const wantsEmail = !!row.pref_email && hasUsableEmail(row);
  if (wantsEmail) return 'email';

  const wantsCall = !!row.pref_call && hasUsablePhone(row);
  if (wantsCall) return 'call';

  return 'none';
}

function shouldSendEmailNotification(row: any) {
  return preferredNotificationChannel(row) === 'email';
}

async function trySendDropoffEmail(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  const alreadyStamped = !!row.dropoff_email_sent_at;
  if (!shouldSendEmailNotification(row) || alreadyStamped) return;

  const token = String(row.public_token || '').trim() || makePublicToken();
  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ dropoff_email_sent_at: nowIso(), public_token: token })
    .eq('id', row.id)
    .is('dropoff_email_sent_at', null)
    .select('tag, email, customer_name, public_token')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const link = intakeFormLink(String(locked.tag || ''), String(locked.public_token || ''));
  const tpl = buildIntakeEmail({
    name: String(locked.customer_name || ''),
    tag: String(locked.tag || ''),
    link,
    businessName: branding.businessName,
    phoneDisplay: branding.phoneDisplay,
  });

  await sendEmail({
    to: String(locked.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

async function trySendDropoffSms(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (preferredNotificationChannel(row) !== 'sms') return;
  const alreadyStamped = !!row.dropoff_sms_sent_at;
  if (alreadyStamped) return;

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ dropoff_sms_sent_at: nowIso() })
    .eq('id', row.id)
    .is('dropoff_sms_sent_at', null)
    .select('id, tag, phone')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const body = buildIntakeSms({
    tag: String(locked.tag || ''),
    statusUrl: statusPageLink(),
    businessName: branding.businessName,
  });

  const result = await sendSms({
    to: String(locked.phone || ''),
    body,
  });

  try {
    await supabaseServer.from('sms_logs').insert({
      ...(row?.processor_id ? { processor_id: row.processor_id } : {}),
      job_id: locked.id,
      phone,
      template: 'dropoff_tagged',
      body,
      channel: 'sms',
      provider: 'twilio',
      status: result.ok ? result.status || 'queued' : result.code,
      provider_message_sid: result.ok ? result.sid : null,
      error_code: result.ok ? null : result.code,
      error_message: result.ok ? null : result.error,
    });
  } catch (logError) {
    console.error('Drop-off SMS log failed (non-fatal)', logError);
  }
}

async function logSmsResult(supabaseServer: any, opts: {
  jobId: string;
  processorId?: string | null;
  phone: string;
  template: string;
  body: string;
  result: Awaited<ReturnType<typeof sendSms>>;
}) {
  try {
    await supabaseServer.from('sms_logs').insert({
      ...(opts.processorId ? { processor_id: opts.processorId } : {}),
      job_id: opts.jobId,
      phone: opts.phone,
      template: opts.template,
      body: opts.body,
      channel: 'sms',
      provider: 'twilio',
      status: opts.result.ok ? opts.result.status || 'queued' : opts.result.code,
      provider_message_sid: opts.result.ok ? opts.result.sid : null,
      error_code: opts.result.ok ? null : opts.result.code,
      error_message: opts.result.ok ? null : opts.result.error,
    });
  } catch (logError) {
    console.error(`${opts.template} SMS log failed (non-fatal)`, logError);
  }
}

async function trySendMeatFinishedEmail(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag || !statusIsFinishedLike(row.status)) return;
  const alreadyStamped = !!row.finished_email_sent_at;
  if (!shouldSendEmailNotification(row) || alreadyStamped) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ finished_email_sent_at: nowIso() })
    .eq('id', row.id)
    .is('finished_email_sent_at', null)
    .select('tag, email, customer_name, paid_processing, price_processing, process_type, beef_fat, webbs_order')
    .maybeSingle();

  if (!locked) return;

  const computed = calcProcessingPrice(
    locked.process_type,
    !!locked.beef_fat,
    !!locked.webbs_order,
    await getCurrentPricing(),
  );
  const price = Number(locked.price_processing ?? 0) || computed;
  const branding = await getNotificationBranding();
  const tpl = buildFinishedEmail({
    name: String(locked.customer_name || ''),
    tag: String(locked.tag || ''),
    paidProcessing: !!locked.paid_processing,
    processingPrice: price,
    businessName: branding.businessName,
    phoneDisplay: branding.phoneDisplay,
  });

  await sendEmail({
    to: String(locked.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  if (!Number(locked.price_processing ?? 0) && computed) {
    await withProcessorFilter(
      supabaseServer.from('jobs').update({ price_processing: computed }).eq('tag', String(locked.tag)),
      row?.processor_id ? String(row.processor_id) : null
    );
  }
}

async function trySendMeatFinishedSms(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag || !statusIsFinishedLike(row.status)) return;
  if (preferredNotificationChannel(row) !== 'sms') return;
  const alreadyStamped = !!row.meat_finished_sms_sent_at;
  if (alreadyStamped) return;

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ meat_finished_sms_sent_at: nowIso() })
    .eq('id', row.id)
    .is('meat_finished_sms_sent_at', null)
    .select('id, tag, phone, paid_processing, price_processing, process_type, beef_fat, webbs_order')
    .maybeSingle();

  if (!locked) return;

  const computed = calcProcessingPrice(
    locked.process_type,
    !!locked.beef_fat,
    !!locked.webbs_order,
    await getCurrentPricing(),
  );
  const price = Number(locked.price_processing ?? 0) || computed;
  const branding = await getNotificationBranding();
  const body = buildMeatFinishedSms({
    tag: String(locked.tag || ''),
    paidProcessing: !!locked.paid_processing,
    processingPrice: price,
    statusUrl: statusPageLink(),
    businessName: branding.businessName,
  });

  const result = await sendSms({ to: String(locked.phone || ''), body });
  await logSmsResult(supabaseServer, {
    jobId: String(locked.id),
    processorId: row?.processor_id ? String(row.processor_id) : null,
    phone,
    template: 'meat_finished',
    body,
    result,
  });
}

async function trySendCapeFinishedEmail(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!processTypeNeedsCape(row.process_type) || !capeReady(row.caping_status)) return;
  const alreadyStamped = !!row.cape_finished_email_sent_at;
  if (!shouldSendEmailNotification(row) || alreadyStamped) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ cape_finished_email_sent_at: nowIso() })
    .eq('id', row.id)
    .is('cape_finished_email_sent_at', null)
    .select('tag, email, customer_name')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const tpl = buildCapeFinishedEmail({
    name: String(locked.customer_name || ''),
    tag: String(locked.tag || ''),
    businessName: branding.businessName,
    phoneDisplay: branding.phoneDisplay,
  });

  await sendEmail({
    to: String(locked.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

async function trySendCapeFinishedSms(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!processTypeNeedsCape(row.process_type) || !capeReady(row.caping_status)) return;
  if (preferredNotificationChannel(row) !== 'sms') return;
  const alreadyStamped = !!row.cape_finished_sms_sent_at;
  if (alreadyStamped) return;

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ cape_finished_sms_sent_at: nowIso() })
    .eq('id', row.id)
    .is('cape_finished_sms_sent_at', null)
    .select('id, tag, phone')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const body = buildCapeFinishedSms({
    tag: String(locked.tag || ''),
    statusUrl: statusPageLink(),
    businessName: branding.businessName,
  });

  const result = await sendSms({ to: String(locked.phone || ''), body });
  await logSmsResult(supabaseServer, {
    jobId: String(locked.id),
    processorId: row?.processor_id ? String(row.processor_id) : null,
    phone,
    template: 'cape_finished',
    body,
    result,
  });
}

async function trySendSpecialtyFinishedEmail(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!row.specialty_products || !specialtyReady(row.specialty_status)) return;
  const alreadyStamped = !!row.specialty_finished_email_sent_at;
  if (!shouldSendEmailNotification(row) || alreadyStamped) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ specialty_finished_email_sent_at: nowIso() })
    .eq('id', row.id)
    .is('specialty_finished_email_sent_at', null)
    .select(`
      tag,
      email,
      customer_name,
      paid_specialty,
      price_specialty,
      original_summer_sausage_lbs,
      summer_sausage_lbs,
      summer_sausage_cheese_lbs,
      jalapeno_summer_sausage_cheese_lbs,
      sliced_jerky_lbs,
      original_snack_sticks_lbs,
      original_snack_sticks_cheese_lbs,
      jalapeno_snack_sticks_cheese_lbs,
      specialty_price_override
    `)
    .maybeSingle();

  if (!locked) return;

  const computed = calcSpecialtyPriceFromLbs(locked, await getCurrentPricing());
  const override = numOrNull(locked.specialty_price_override);
  const price = override ?? (Number(locked.price_specialty ?? 0) || computed);
  const branding = await getNotificationBranding();
  const tpl = buildSpecialtyFinishedEmail({
    name: String(locked.customer_name || ''),
    tag: String(locked.tag || ''),
    paidSpecialty: !!locked.paid_specialty,
    specialtyPrice: price,
    businessName: branding.businessName,
    phoneDisplay: branding.phoneDisplay,
  });

  await sendEmail({
    to: String(locked.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });

  if (!Number(locked.price_specialty ?? 0) && price) {
    await withProcessorFilter(
      supabaseServer.from('jobs').update({ price_specialty: price }).eq('tag', String(locked.tag)),
      row?.processor_id ? String(row.processor_id) : null
    );
  }
}

async function trySendSpecialtyFinishedSms(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!row.specialty_products || !specialtyReady(row.specialty_status)) return;
  if (preferredNotificationChannel(row) !== 'sms') return;
  const alreadyStamped = !!row.specialty_finished_sms_sent_at;
  if (alreadyStamped) return;

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ specialty_finished_sms_sent_at: nowIso() })
    .eq('id', row.id)
    .is('specialty_finished_sms_sent_at', null)
    .select(`
      id,
      tag,
      phone,
      paid_specialty,
      price_specialty,
      original_summer_sausage_lbs,
      summer_sausage_lbs,
      summer_sausage_cheese_lbs,
      jalapeno_summer_sausage_cheese_lbs,
      sliced_jerky_lbs,
      original_snack_sticks_lbs,
      original_snack_sticks_cheese_lbs,
      jalapeno_snack_sticks_cheese_lbs,
      specialty_price_override
    `)
    .maybeSingle();

  if (!locked) return;

  const computed = calcSpecialtyPriceFromLbs(locked, await getCurrentPricing());
  const override = numOrNull(locked.specialty_price_override);
  const price = override ?? (Number(locked.price_specialty ?? 0) || computed);
  const branding = await getNotificationBranding();
  const body = buildSpecialtyFinishedSms({
    tag: String(locked.tag || ''),
    paidSpecialty: !!locked.paid_specialty,
    specialtyPrice: price,
    statusUrl: statusPageLink(),
    businessName: branding.businessName,
  });

  const result = await sendSms({ to: String(locked.phone || ''), body });
  await logSmsResult(supabaseServer, {
    jobId: String(locked.id),
    processorId: row?.processor_id ? String(row.processor_id) : null,
    phone,
    template: 'specialty_finished',
    body,
    result,
  });
}

async function trySendWebbsDeliveredEmail(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!row.webbs_order || !webbsReady(row.webbs_status)) return;
  const alreadyStamped = !!row.webbs_delivered_email_sent_at;
  if (!shouldSendEmailNotification(row) || alreadyStamped) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ webbs_delivered_email_sent_at: nowIso() })
    .eq('id', row.id)
    .is('webbs_delivered_email_sent_at', null)
    .select('tag, email, customer_name')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const tpl = buildWebbsDeliveredEmail({
    name: String(locked.customer_name || ''),
    tag: String(locked.tag || ''),
    businessName: branding.businessName,
    phoneDisplay: branding.phoneDisplay,
  });

  await sendEmail({
    to: String(locked.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

async function trySendWebbsDeliveredSms(supabaseServer: any, row: any) {
  if (!row || !hasRealTag(row) || row.requires_tag) return;
  if (!row.webbs_order || !webbsReady(row.webbs_status)) return;
  if (preferredNotificationChannel(row) !== 'sms') return;
  const alreadyStamped = !!row.webbs_delivered_sms_sent_at;
  if (alreadyStamped) return;

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) return;

  const { data: locked } = await supabaseServer
    .from('jobs')
    .update({ webbs_delivered_sms_sent_at: nowIso() })
    .eq('id', row.id)
    .is('webbs_delivered_sms_sent_at', null)
    .select('id, tag, phone')
    .maybeSingle();

  if (!locked) return;

  const branding = await getNotificationBranding();
  const body = buildWebbsDeliveredSms({
    tag: String(locked.tag || ''),
    statusUrl: statusPageLink(),
    businessName: branding.businessName,
  });

  const result = await sendSms({ to: String(locked.phone || ''), body });
  await logSmsResult(supabaseServer, {
    jobId: String(locked.id),
    processorId: row?.processor_id ? String(row.processor_id) : null,
    phone,
    template: 'webbs_delivered',
    body,
    result,
  });
}

async function trySendNotificationEmails(supabaseServer: any, row: any) {
  if (preferredNotificationChannel(row) !== 'email') return;

  const steps = [
    ['drop-off', trySendDropoffEmail],
    ['meat finished', trySendMeatFinishedEmail],
    ['cape finished', trySendCapeFinishedEmail],
    ['specialty finished', trySendSpecialtyFinishedEmail],
    ['Webbs delivered', trySendWebbsDeliveredEmail],
  ] as const;

  for (const [label, fn] of steps) {
    try {
      await fn(supabaseServer, row);
    } catch (error) {
      console.error(`${label} email failed (non-fatal)`, error);
    }
  }
}

async function trySendNotificationSms(supabaseServer: any, row: any) {
  if (preferredNotificationChannel(row) !== 'sms') return;

  const steps = [
    ['drop-off', trySendDropoffSms],
    ['meat finished', trySendMeatFinishedSms],
    ['cape finished', trySendCapeFinishedSms],
    ['specialty finished', trySendSpecialtyFinishedSms],
    ['Webbs delivered', trySendWebbsDeliveredSms],
  ] as const;

  for (const [label, fn] of steps) {
    try {
      await fn(supabaseServer, row);
    } catch (error) {
      console.error(`${label} sms failed (non-fatal)`, error);
    }
  }
}

export async function resendCustomerNotification(params: {
  tag: string;
  event: 'dropoff_tagged' | 'meat_finished' | 'cape_finished' | 'specialty_finished' | 'webbs_delivered';
}) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const tag = String(params.tag || '').trim();
  const event = String(params.event || '').trim() as
    | 'dropoff_tagged'
    | 'meat_finished'
    | 'cape_finished'
    | 'specialty_finished'
    | 'webbs_delivered';

  if (!tag) return { ok: false, error: 'Missing tag' };

  const { data: row, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag),
    processor.id
  )
    .maybeSingle();

  if (error) throw error;
  if (!row) return { ok: false, error: 'Job not found' };

  const channel = preferredNotificationChannel(row);
  if (channel === 'call') {
    return { ok: false, error: 'This customer prefers phone calls. No automatic notification was sent.' };
  }
  if (channel === 'none') {
    return { ok: false, error: 'No automatic notification method is set for this customer.' };
  }

  const emailStampField: Record<string, string> = {
    dropoff_tagged: 'dropoff_email_sent_at',
    meat_finished: 'finished_email_sent_at',
    cape_finished: 'cape_finished_email_sent_at',
    specialty_finished: 'specialty_finished_email_sent_at',
    webbs_delivered: 'webbs_delivered_email_sent_at',
  };
  const smsStampField: Record<string, string> = {
    dropoff_tagged: 'dropoff_sms_sent_at',
    meat_finished: 'meat_finished_sms_sent_at',
    cape_finished: 'cape_finished_sms_sent_at',
    specialty_finished: 'specialty_finished_sms_sent_at',
    webbs_delivered: 'webbs_delivered_sms_sent_at',
  };

  const now = nowIso();

  if (event === 'dropoff_tagged' && (!hasRealTag(row) || row.requires_tag)) {
    return { ok: false, error: 'A real deer tag must be assigned before resending the drop-off notification.' };
  }
  if (event === 'meat_finished' && !statusIsFinishedLike(row.status)) {
    return { ok: false, error: 'Processing is not marked finished or ready yet.' };
  }
  if (event === 'cape_finished' && (!processTypeNeedsCape(row.process_type) || !capeReady(row.caping_status))) {
    return { ok: false, error: 'Cape is not marked finished or ready yet.' };
  }
  if (event === 'specialty_finished' && (!row.specialty_products || !specialtyReady(row.specialty_status))) {
    return { ok: false, error: 'Specialty products are not marked finished or ready yet.' };
  }
  if (event === 'webbs_delivered' && (!row.webbs_order || !webbsReady(row.webbs_status))) {
    return { ok: false, error: 'Webbs is not marked delivered or ready yet.' };
  }

  if (channel === 'email') {
    const email = String(row.email || '').trim();
    if (!hasUsableEmail(row)) {
      return { ok: false, error: 'This customer does not have a valid email address.' };
    }

    if (event === 'dropoff_tagged') {
      const token = String(row.public_token || '').trim() || makePublicToken();
      const link = intakeFormLink(String(row.tag || ''), token);
      const branding = await getNotificationBranding();
      const tpl = buildIntakeEmail({
        name: String(row.customer_name || ''),
        tag: String(row.tag || ''),
        link,
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      await supabaseServer.from('jobs').update({
        public_token: token,
        [emailStampField[event]]: now,
      }).eq('id', row.id);
      return { ok: true, event, channel, destination: email };
    }

    if (event === 'meat_finished') {
      const computed = calcProcessingPrice(row.process_type, !!row.beef_fat, !!row.webbs_order, await getCurrentPricing());
      const price = Number(row.price_processing ?? 0) || computed;
      const branding = await getNotificationBranding();
      const tpl = buildFinishedEmail({
        name: String(row.customer_name || ''),
        tag: String(row.tag || ''),
        paidProcessing: !!row.paid_processing,
        processingPrice: price,
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    if (event === 'cape_finished') {
      const branding = await getNotificationBranding();
      const tpl = buildCapeFinishedEmail({
        name: String(row.customer_name || ''),
        tag: String(row.tag || ''),
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    if (event === 'specialty_finished') {
      const computed = calcSpecialtyPriceFromLbs(row, await getCurrentPricing());
      const override = numOrNull(row.specialty_price_override);
      const price = override ?? (Number(row.price_specialty ?? 0) || computed);
      const branding = await getNotificationBranding();
      const tpl = buildSpecialtyFinishedEmail({
        name: String(row.customer_name || ''),
        tag: String(row.tag || ''),
        paidSpecialty: !!row.paid_specialty,
        specialtyPrice: price,
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    if (event === 'webbs_delivered') {
      const branding = await getNotificationBranding();
      const tpl = buildWebbsDeliveredEmail({
        name: String(row.customer_name || ''),
        tag: String(row.tag || ''),
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    await supabaseServer.from('jobs').update({ [emailStampField[event]]: now }).eq('id', row.id);
    return { ok: true, event, channel, destination: email };
  }

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) {
    return { ok: false, error: 'This customer does not have a valid phone number for text updates.' };
  }

  let body = '';
  if (event === 'dropoff_tagged') {
    const branding = await getNotificationBranding();
    body = buildIntakeSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName });
  }
  if (event === 'meat_finished') {
    const computed = calcProcessingPrice(row.process_type, !!row.beef_fat, !!row.webbs_order, await getCurrentPricing());
    const price = Number(row.price_processing ?? 0) || computed;
    const branding = await getNotificationBranding();
    body = buildMeatFinishedSms({
      tag: String(row.tag || ''),
      paidProcessing: !!row.paid_processing,
      processingPrice: price,
      statusUrl: statusPageLink(),
      businessName: branding.businessName,
    });
  }
  if (event === 'cape_finished') {
    const branding = await getNotificationBranding();
    body = buildCapeFinishedSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName });
  }
  if (event === 'specialty_finished') {
    const computed = calcSpecialtyPriceFromLbs(row, await getCurrentPricing());
    const override = numOrNull(row.specialty_price_override);
    const price = override ?? (Number(row.price_specialty ?? 0) || computed);
    const branding = await getNotificationBranding();
    body = buildSpecialtyFinishedSms({
      tag: String(row.tag || ''),
      paidSpecialty: !!row.paid_specialty,
      specialtyPrice: price,
      statusUrl: statusPageLink(),
      businessName: branding.businessName,
    });
  }
  if (event === 'webbs_delivered') {
    const branding = await getNotificationBranding();
    body = buildWebbsDeliveredSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName });
  }

  const result = await sendSms({ to: phone, body });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await logSmsResult(supabaseServer, {
    jobId: String(row.id),
    processorId: row.processor_id ? String(row.processor_id) : null,
    phone,
    template: event,
    body,
    result,
  });
  await supabaseServer.from('jobs').update({ [smsStampField[event]]: now }).eq('id', row.id);

  return { ok: true, event, channel, destination: phone };
}

export async function resetCustomerNotification(params: {
  tag: string;
  event: 'dropoff_tagged' | 'meat_finished' | 'cape_finished' | 'specialty_finished' | 'webbs_delivered';
}) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const tag = String(params.tag || '').trim();
  const event = String(params.event || '').trim() as
    | 'dropoff_tagged'
    | 'meat_finished'
    | 'cape_finished'
    | 'specialty_finished'
    | 'webbs_delivered';

  if (!tag) return { ok: false, error: 'Missing tag' };

  const { data: row, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select('id, tag')
    .eq('tag', tag),
    processor.id
  )
    .maybeSingle();

  if (error) throw error;
  if (!row) return { ok: false, error: 'Job not found' };

  const emailStampField: Record<string, string> = {
    dropoff_tagged: 'dropoff_email_sent_at',
    meat_finished: 'finished_email_sent_at',
    cape_finished: 'cape_finished_email_sent_at',
    specialty_finished: 'specialty_finished_email_sent_at',
    webbs_delivered: 'webbs_delivered_email_sent_at',
  };
  const smsStampField: Record<string, string> = {
    dropoff_tagged: 'dropoff_sms_sent_at',
    meat_finished: 'meat_finished_sms_sent_at',
    cape_finished: 'cape_finished_sms_sent_at',
    specialty_finished: 'specialty_finished_sms_sent_at',
    webbs_delivered: 'webbs_delivered_sms_sent_at',
  };

  const { error: updateError } = await supabaseServer
    .from('jobs')
    .update({
      [emailStampField[event]]: null,
      [smsStampField[event]]: null,
      updated_at: nowIso(),
    })
    .eq('id', row.id);

  if (updateError) {
    console.error('resetCustomerNotification error', updateError);
    throw updateError;
  }

  return { ok: true, tag: String(row.tag || tag), event };
}

function appendStampedLine(existing: string | null | undefined, line: string) {
  const old = String(existing || '').trim();
  return old ? `${old}\n${line}` : line;
}

function stampLine(prefix: string, notes: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
  return `[${ts} | ${prefix}] ${notes}`;
}

/* ---------------- mapping ---------------- */

// Map DB row to Job (what your frontend expects)
function mapDbRowToJob(row: any): Job {
  const j: any = {
    id: row.id,
    row: undefined, // only used for Sheets, not Supabase

    // Identity
    tag: row.tag,
    confirmation: row.confirmation,
    customer: row.customer_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,

    county: row.county_killed,
    dropoff: row.dropoff_date,
    sex: row.deer_sex,
    processType: row.process_type,

    // Statuses
    status: row.status,
    capingStatus: row.caping_status,
    webbsStatus: row.webbs_status,
    specialtyStatus: row.specialty_status,

    // Cuts / packaging
    steak: row.steak_size,
    steakOther: row.steak_size_other,
    burgerSize: row.burger_size,
    steaksPerPackage: row.steaks_per_package,
    beefFat: !!row.beef_fat,

    hindRoastCount: row.hind_roast_count != null ? String(row.hind_roast_count) : null,
    frontRoastCount: row.front_roast_count != null ? String(row.front_roast_count) : null,

    hind: {
      'Hind - Steak': !!row.hind_steak,
      'Hind - Roast': !!row.hind_roast,
      'Hind - Grind': !!row.hind_grind,
      'Hind - None': !!row.hind_none,
    },
    front: {
      'Front - Steak': !!row.front_steak,
      'Front - Roast': !!row.front_roast,
      'Front - Grind': !!row.front_grind,
      'Front - None': !!row.front_none,
    },

    backstrapPrep: row.backstrap_prep,
    backstrapThickness: row.backstrap_thickness,
    backstrapThicknessOther: row.backstrap_thickness_other,

    // Specialty
    specialtyProducts: !!row.specialty_products,
    specialtyPounds: Number(row.specialty_pounds ?? 0),
    originalSummerSausageLbs: Number(row.original_summer_sausage_lbs ?? row.summer_sausage_lbs ?? 0),
    summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0),
    jalapenoSummerSausageCheeseLbs: Number(row.jalapeno_summer_sausage_cheese_lbs ?? row.sliced_jerky_lbs ?? 0),
    originalSnackSticksLbs: Number(row.original_snack_sticks_lbs ?? 0),
    originalSnackSticksCheeseLbs: Number(row.original_snack_sticks_cheese_lbs ?? 0),
    jalapenoSnackSticksCheeseLbs: Number(row.jalapeno_snack_sticks_cheese_lbs ?? 0),

    notes: row.notes,

    // Webbs
    webbsOrder: !!row.webbs_order,
    webbsOrderFormNumber: row.webbs_order_form_number,
    webbsPounds: Number(row.webbs_pounds ?? 0),
    webbsPaperFormCompleted: !!row.webbs_paper_form_completed,
    webbsOrderMode: row.webbs_order_mode ?? null,
    webbsOrderStyle: row.webbs_order_style ? normalizeWebbsOrderStyle(row.webbs_order_style) : null,
    webbsItems: normalizeWebbsOrderItems(row.webbs_items),
    webbsAllocations: normalizeWebbsAllocations(row.webbs_allocations),

    // Pricing
    priceProcessing: Number(row.price_processing ?? 0),
    priceSpecialty: Number(row.price_specialty ?? 0),
    price: Number(row.price_total ?? 0),

    // Paid flags
    paid: !!row.paid,
    paidProcessing: !!row.paid_processing,
    paidSpecialty: !!row.paid_specialty,
    requiresTag: !!row.requires_tag,

    // Public link / notifications
    publicToken: row.public_token,
    publicLinkSentAt: row.public_link_sent_at,
    dropoffEmailSentAt: row.dropoff_email_sent_at,
    dropoffSmsSentAt: row.dropoff_sms_sent_at,
    intakeSheetPrintedAt: row.intake_sheet_printed_at,
    intakeSheetPrintCount: Number(row.intake_sheet_print_count ?? 0),
    updatedAt: row.updated_at ?? null,
    pendingDeletedAt: row.pending_deleted_at ?? null,
    pendingDeleteReason: row.pending_delete_reason ?? null,
    meatFinishedEmailSentAt: row.finished_email_sent_at,
    meatFinishedSmsSentAt: row.meat_finished_sms_sent_at,
    capeFinishedEmailSentAt: row.cape_finished_email_sent_at,
    capeFinishedSmsSentAt: row.cape_finished_sms_sent_at,
    specialtyFinishedEmailSentAt: row.specialty_finished_email_sent_at,
    specialtyFinishedSmsSentAt: row.specialty_finished_sms_sent_at,
    webbsDeliveredEmailSentAt: row.webbs_delivered_email_sent_at,
    webbsDeliveredSmsSentAt: row.webbs_delivered_sms_sent_at,
    paidProcessingAt: row.paid_processing_at,
    paidSpecialtyAt: row.paid_specialty_at,

    // Pickup
    pickedUpProcessing: !!row.picked_up_processing,
    pickedUpProcessingAt: row.picked_up_processing_at,
    pickedUpCape: !!row.picked_up_cape,
    pickedUpCapeAt: row.picked_up_cape_at,
    pickedUpWebbs: !!row.picked_up_webbs,
    pickedUpWebbsAt: row.picked_up_webbs_at,

    // Call tracking
    callAttempts: Number(row.call_attempts ?? 0),
    meatAttempts: Number(row.meat_attempts ?? 0),
    capeAttempts: Number(row.cape_attempts ?? 0),
    webbsAttempts: Number(row.webbs_attempts ?? 0),
    lastCallAt: row.last_call_at,
    lastCalledBy: row.last_called_by,
    lastCallOutcome: row.last_call_outcome,
    callNotes: row.call_notes,

    // Comms prefs
    prefEmail: !!row.pref_email,
    prefSMS: !!row.pref_sms,
    prefCall: !!row.pref_call,
    smsConsent: !!row.sms_consent,
    autoCallConsent: false,

    // Misc
    howKilled: row.how_killed,
  };
  // Price overrides (stored separately from computed prices)
  j.processing_price_override = row.processing_price_override ?? null;
  j.specialty_price_override = row.specialty_price_override ?? null;
  return j as Job;
}


function mapDbRowToSearchRow(row: any): JobSearchRow {
  return {
    id: row.id != null ? String(row.id) : undefined,
    tag: row.tag,
    confirmation: row.confirmation,
    customer: row.customer_name,
    phone: row.phone,
    status: row.status,
    capingStatus: row.caping_status,
    webbsStatus: row.webbs_status,
    specialtyStatus: row.specialty_status,
    priceProcessing: Number(row.price_processing ?? 0),
    priceSpecialty: Number(row.price_specialty ?? 0),
    price: Number(row.price_total ?? 0),
    requiresTag: !!row.requires_tag,
    paidProcessing: !!row.paid_processing,
    paidSpecialty: !!row.paid_specialty,
    paid: !!row.paid,
    callAttempts: Number(row.call_attempts ?? 0),
    meatAttempts: Number(row.meat_attempts ?? 0),
    capeAttempts: Number(row.cape_attempts ?? 0),
    webbsAttempts: Number(row.webbs_attempts ?? 0),
    dropoff: row.dropoff_date,

    // If your JobSearchRow type includes these, great; if not, TS will still allow extra props at runtime
    // (and your UI is already tolerant with (r as any))
    ...(row.last_call_at ? ({ lastCallAt: row.last_call_at } as any) : {}),
    ...(row.call_notes != null ? ({ callNotes: row.call_notes } as any) : {}),
    ...(row.process_type != null ? ({ processType: row.process_type } as any) : {}),
    ...(row.beef_fat != null ? ({ beefFat: !!row.beef_fat } as any) : {}),
    ...(row.webbs_order != null ? ({ webbsOrder: !!row.webbs_order } as any) : {}),
    ...(row.webbs_order_style != null ? ({ webbsOrderStyle: normalizeWebbsOrderStyle(row.webbs_order_style) } as any) : {}),
    ...(row.webbs_allocations != null ? ({ webbsAllocations: normalizeWebbsAllocations(row.webbs_allocations) } as any) : {}),
    ...(row.specialty_products != null ? ({ specialtyProducts: !!row.specialty_products } as any) : {}),
    ...(row.original_summer_sausage_lbs != null || row.summer_sausage_lbs != null
      ? ({ originalSummerSausageLbs: Number(row.original_summer_sausage_lbs ?? row.summer_sausage_lbs ?? 0) } as any)
      : {}),
    ...(row.summer_sausage_cheese_lbs != null
      ? ({ summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0) } as any)
      : {}),
    ...(row.jalapeno_summer_sausage_cheese_lbs != null || row.sliced_jerky_lbs != null
      ? ({ jalapenoSummerSausageCheeseLbs: Number(row.jalapeno_summer_sausage_cheese_lbs ?? row.sliced_jerky_lbs ?? 0) } as any)
      : {}),
    ...(row.original_snack_sticks_lbs != null
      ? ({ originalSnackSticksLbs: Number(row.original_snack_sticks_lbs ?? 0) } as any)
      : {}),
    ...(row.original_snack_sticks_cheese_lbs != null
      ? ({ originalSnackSticksCheeseLbs: Number(row.original_snack_sticks_cheese_lbs ?? 0) } as any)
      : {}),
    ...(row.jalapeno_snack_sticks_cheese_lbs != null
      ? ({ jalapenoSnackSticksCheeseLbs: Number(row.jalapeno_snack_sticks_cheese_lbs ?? 0) } as any)
      : {}),
    ...(row.picked_up_processing != null ? ({ pickedUpProcessing: !!row.picked_up_processing } as any) : {}),
    ...(row.picked_up_processing_at != null ? ({ pickedUpProcessingAt: row.picked_up_processing_at } as any) : {}),
    ...(row.picked_up_cape != null ? ({ pickedUpCape: !!row.picked_up_cape } as any) : {}),
    ...(row.picked_up_cape_at != null ? ({ pickedUpCapeAt: row.picked_up_cape_at } as any) : {}),
    ...(row.picked_up_webbs != null ? ({ pickedUpWebbs: !!row.picked_up_webbs } as any) : {}),
    ...(row.picked_up_webbs_at != null ? ({ pickedUpWebbsAt: row.picked_up_webbs_at } as any) : {}),
    ...(row.intake_sheet_printed_at != null ? ({ intakeSheetPrintedAt: row.intake_sheet_printed_at } as any) : {}),
    ...(row.intake_sheet_print_count != null ? ({ intakeSheetPrintCount: Number(row.intake_sheet_print_count ?? 0) } as any) : {}),
    ...(row.updated_at != null ? ({ updatedAt: row.updated_at } as any) : {}),
    ...(row.pending_deleted_at != null ? ({ pendingDeletedAt: row.pending_deleted_at } as any) : {}),
  } as JobSearchRow;
}

/* ---------------- core reads ---------------- */

export async function getJobByTag(tag: string) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .is('pending_deleted_at', null),
    processor.id
  )
    .maybeSingle();

  if (error) {
    console.error('getJobByTag error', error);
    throw error;
  }

  if (!data) {
    return { ok: true, exists: false as const, job: null as Job | null };
  }

  return { ok: true, exists: true as const, job: mapDbRowToJob(data) };
}

/* ---------------- search (now supports @report + @recall) ---------------- */

const SEARCH_SELECT = `
  id,
  tag,
  confirmation,
  customer_name,
  phone,
  status,
  caping_status,
  webbs_status,
  specialty_status,
  process_type,
  beef_fat,
  webbs_order,
  specialty_products,
  original_summer_sausage_lbs,
  summer_sausage_lbs,
  summer_sausage_cheese_lbs,
  jalapeno_summer_sausage_cheese_lbs,
  sliced_jerky_lbs,
  original_snack_sticks_lbs,
  original_snack_sticks_cheese_lbs,
  jalapeno_snack_sticks_cheese_lbs,
  price_processing,
  price_specialty,
  price_total,
  requires_tag,
  paid_processing,
  paid_specialty,
  paid,
  call_attempts,
  meat_attempts,
  cape_attempts,
  webbs_attempts,
  last_call_at,
  call_notes,
  picked_up_processing,
  picked_up_cape,
  picked_up_webbs,
  dropoff_date,
  intake_sheet_printed_at,
  intake_sheet_print_count,
  updated_at,
  pending_deleted_at,
  pending_delete_reason
`;

async function searchReport(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  // Pull a broad set of candidates, then filter in JS (simpler and more reliable than complex NOT-ILIKE ORs).
  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .is('pending_deleted_at', null)
    .or(
      [
        'status.ilike.%finish%',
        'status.ilike.%ready%',
        'status.ilike.%complete%',
        'status.ilike.%completed%',
        'status.ilike.%done%',
        'caping_status.ilike.%cape%',
        'caping_status.ilike.%caped%',
        'caping_status.ilike.%ready%',
        'caping_status.ilike.%complete%',
        'caping_status.ilike.%completed%',
        'caping_status.ilike.%done%',
        'webbs_status.ilike.%deliver%',
        'webbs_status.ilike.%delivered%',
        'webbs_status.ilike.%ready%',
        'webbs_status.ilike.%complete%',
        'webbs_status.ilike.%completed%',
        'webbs_status.ilike.%done%',
      ].join(',')
    ),
    processor.id
  )
    .order('dropoff_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('searchReport error', error);
    throw error;
  }

  const filtered = (data || []).filter((r: any) => {
    const meat = meatReady(r.status);
    const cape = capeReady(r.caping_status);
    const webbs = webbsReady(r.webbs_status);
    return meat || cape || webbs;
  });

  return { ok: true, rows: filtered.map(mapDbRowToSearchRow) };
}

async function searchRecall(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .is('pending_deleted_at', null)
    .or('status.eq.Called,caping_status.eq.Called,webbs_status.eq.Called'),
    processor.id
  )
    .order('last_call_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('searchRecall error', error);
    throw error;
  }

  // Pickup queue: called but not picked up for that track
  const filtered = (data || []).filter((r: any) => {
    const meatInQueue = isCalled(r.status) && !r.picked_up_processing;
    const capeInQueue = isCalled(r.caping_status) && !r.picked_up_cape;
    const webbsInQueue = isCalled(r.webbs_status) && !r.picked_up_webbs;
    return meatInQueue || capeInQueue || webbsInQueue;
  });

  return { ok: true, rows: filtered.map(mapDbRowToSearchRow) };
}

export async function searchJobs(query: string): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const q = query.trim();

  if (!q) return { ok: true, rows: [] };

  // --- special keywords used by your UI ---
  if (q.toLowerCase() === '@report') return searchReport();
  if (q.toLowerCase() === '@recall') return searchRecall();

  // Normal search (tag/confirmation/phone/customer)
  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .is('pending_deleted_at', null)
    .or(
      [
        `tag.ilike.%${q}%`,
        `confirmation.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
      ].join(',')
    ),
    processor.id
  )
    .order('dropoff_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('searchJobs error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

/* ---------------- save ---------------- */


function calcSpecialtyPriceFromLbs(job: Partial<Job>, pricing?: Partial<SitePricing> | null): number {
  return specialtyPrice(job as Record<string, any>, pricing);
}

export async function saveJob(job: Partial<Job>, options?: { processorContext?: ProcessorContext | null }) {
  const supabaseServer = getSupabaseServer();
  const processor = options?.processorContext || (await getDefaultProcessorContext());
  const pricing = await getCurrentPricing();
  // ---- Tag rules ----
  // Staff intake must provide a real tag.
  // Overnight/public submission has no tag yet: store a unique placeholder tag and mark requires_tag=true.
  const rawTag = String((job as any).tag ?? '').trim();
  const confirmationDigits = String((job as any).confirmation ?? '').replace(/\D/g, '');
  const hasConfirmation13 = confirmationDigits.length === 13;

  const hasRealTagInput =
    rawTag !== '' &&
    rawTag.toLowerCase() !== 'null' &&
    rawTag.toLowerCase() !== 'undefined' &&
    !rawTag.toLowerCase().startsWith('pending-');

  const allowMissingTag = !!(job as any).requiresTag || (!hasRealTagInput && hasConfirmation13);

let tagToStore: string;
  let requiresTag = !!(job as any).requiresTag;

  if (hasRealTagInput) {
    tagToStore = rawTag;
    requiresTag = false;
  } else {
    if (!allowMissingTag) throw new Error('Tag is required.');
    if (!hasConfirmation13) throw new Error('Confirmation must be 13 digits when Tag is missing (overnight).');
    tagToStore = makePendingTag(confirmationDigits);
    requiresTag = true;
  }

  let effectiveJob: Partial<Job> = job;
  let existingJob: Job | null = null;

  if (hasRealTagInput) {
    const { data: existingRow, error: existingError } = await withProcessorFilter(
      supabaseServer
      .from('jobs')
      .select('*')
      .eq('tag', rawTag),
      processor.id
    )
      .maybeSingle();

    if (existingError) {
      console.error('saveJob existing lookup error', existingError);
      throw existingError;
    }

    if (existingRow) {
      existingJob = mapDbRowToJob(existingRow);
      effectiveJob = {
        ...existingJob,
        ...job,
        hind: {
          ...(existingJob.hind || {}),
          ...((job as any).hind || {}),
        },
        front: {
          ...(existingJob.front || {}),
          ...((job as any).front || {}),
        },
      };
    }
  }

  const saveStamp = nowIso();
  const normalizePickedUpTrack = (
    statusValue: any,
    pickedUpValue: any,
    pickedUpAtValue: any,
    existingPickedUp: any,
    existingPickedUpAt: any,
  ) => {
    const statusPickedUp = String(statusValue || '').trim().toLowerCase() === 'picked up';
    const flagPickedUp = pickedUpValue === true;
    if (!statusPickedUp && !flagPickedUp) {
      return {
        pickedUp: pickedUpValue,
        pickedUpAt: pickedUpAtValue,
      };
    }
    return {
      pickedUp: true,
      pickedUpAt: pickedUpAtValue ?? existingPickedUpAt ?? (existingPickedUp ? existingPickedUpAt : null) ?? saveStamp,
    };
  };

  const procPickup = normalizePickedUpTrack(
    effectiveJob.status,
    effectiveJob.pickedUpProcessing,
    effectiveJob.pickedUpProcessingAt,
    existingJob?.pickedUpProcessing,
    existingJob?.pickedUpProcessingAt,
  );
  const capePickup = normalizePickedUpTrack(
    effectiveJob.capingStatus,
    effectiveJob.pickedUpCape,
    effectiveJob.pickedUpCapeAt,
    existingJob?.pickedUpCape,
    existingJob?.pickedUpCapeAt,
  );
  const webbsPickup = normalizePickedUpTrack(
    effectiveJob.webbsStatus,
    effectiveJob.pickedUpWebbs,
    effectiveJob.pickedUpWebbsAt,
    existingJob?.pickedUpWebbs,
    existingJob?.pickedUpWebbsAt,
  );

  effectiveJob = {
    ...effectiveJob,
    pickedUpProcessing: procPickup.pickedUp as any,
    pickedUpProcessingAt: procPickup.pickedUpAt as any,
    pickedUpCape: capePickup.pickedUp as any,
    pickedUpCapeAt: capePickup.pickedUpAt as any,
    pickedUpWebbs: webbsPickup.pickedUp as any,
    pickedUpWebbsAt: webbsPickup.pickedUpAt as any,
  };



  const computedProcessingPrice = calcProcessingPrice(
    effectiveJob.processType,
    !!effectiveJob.beefFat,
    !!effectiveJob.webbsOrder,
    pricing,
  );
  const computedSpecialtyPrice = calcSpecialtyPriceFromLbs(effectiveJob, pricing);

  const processingOverride = numOrNull(
    (effectiveJob as any).processing_price_override ?? (effectiveJob as any).processingPriceOverride
  );
  const specialtyOverride  = numOrNull(
    (effectiveJob as any).specialty_price_override  ?? (effectiveJob as any).specialtyPriceOverride
  );

  const usedProcessingPrice = processingOverride ?? (numOrNull(effectiveJob.priceProcessing) ?? computedProcessingPrice);
  const usedSpecialtyPrice  = specialtyOverride  ?? (numOrNull(effectiveJob.priceSpecialty) ?? computedSpecialtyPrice);
  const usedTotalPrice      = numOrNull(effectiveJob.price) ?? (usedProcessingPrice + usedSpecialtyPrice);

  const upsertPayload: any = {
    ...(processor.id ? { processor_id: processor.id } : {}),
    tag: tagToStore,
    confirmation: effectiveJob.confirmation ?? null,
    customer_name: effectiveJob.customer ?? null,
    phone: effectiveJob.phone ?? null,
    email: effectiveJob.email ?? null,
    address: effectiveJob.address ?? null,
    city: effectiveJob.city ?? null,
    state: effectiveJob.state ?? null,
    zip: effectiveJob.zip ?? null,

    county_killed: effectiveJob.county ?? null,
    deer_sex: effectiveJob.sex ?? null,
    process_type: effectiveJob.processType ?? null,
    dropoff_date: effectiveJob.dropoff ?? null,

    status: effectiveJob.status ?? null,
    caping_status: effectiveJob.capingStatus ?? null,
    webbs_status: effectiveJob.webbsStatus ?? null,
    specialty_status: effectiveJob.specialtyStatus ?? null,

    steak_size: effectiveJob.steak ?? null,
    steak_size_other: effectiveJob.steakOther ?? null,
    burger_size: effectiveJob.burgerSize ?? null,
    steaks_per_package: effectiveJob.steaksPerPackage ?? null,
    beef_fat: effectiveJob.beefFat ?? false,

    hind_roast_count: intOrNull(effectiveJob.hindRoastCount),
    front_roast_count: intOrNull(effectiveJob.frontRoastCount),

    hind_steak: effectiveJob.hind?.['Hind - Steak'] ?? false,
    hind_roast: effectiveJob.hind?.['Hind - Roast'] ?? false,
    hind_grind: effectiveJob.hind?.['Hind - Grind'] ?? false,
    hind_none: effectiveJob.hind?.['Hind - None'] ?? false,

    front_steak: effectiveJob.front?.['Front - Steak'] ?? false,
    front_roast: effectiveJob.front?.['Front - Roast'] ?? false,
    front_grind: effectiveJob.front?.['Front - Grind'] ?? false,
    front_none: effectiveJob.front?.['Front - None'] ?? false,

    backstrap_prep: effectiveJob.backstrapPrep ?? null,
    backstrap_thickness: effectiveJob.backstrapThickness ?? null,
    backstrap_thickness_other: effectiveJob.backstrapThicknessOther ?? null,

    specialty_products: effectiveJob.specialtyProducts ?? false,
    specialty_pounds: specialtyTotalLbs(effectiveJob as Record<string, any>),
    original_summer_sausage_lbs: numOrZero((effectiveJob as any).originalSummerSausageLbs),
    summer_sausage_lbs: numOrZero((effectiveJob as any).originalSummerSausageLbs),
    summer_sausage_cheese_lbs: numOrZero(effectiveJob.summerSausageCheeseLbs),
    jalapeno_summer_sausage_cheese_lbs: numOrZero((effectiveJob as any).jalapenoSummerSausageCheeseLbs),
    sliced_jerky_lbs: numOrZero((effectiveJob as any).jalapenoSummerSausageCheeseLbs),
    original_snack_sticks_lbs: numOrZero((effectiveJob as any).originalSnackSticksLbs),
    original_snack_sticks_cheese_lbs: numOrZero((effectiveJob as any).originalSnackSticksCheeseLbs),
    jalapeno_snack_sticks_cheese_lbs: numOrZero((effectiveJob as any).jalapenoSnackSticksCheeseLbs),

    notes: effectiveJob.notes ?? null,

    webbs_order: effectiveJob.webbsOrder ?? false,
    webbs_order_form_number: effectiveJob.webbsOrderFormNumber ?? (effectiveJob as any).webbsFormNumber ?? null,
    webbs_pounds: numOrZero(effectiveJob.webbsPounds),
    webbs_paper_form_completed: !!(effectiveJob as any).webbsPaperFormCompleted,
    webbs_order_mode: (effectiveJob as any).webbsOrderMode ?? null,
    webbs_order_style: effectiveJob.webbsOrder ? normalizeWebbsOrderStyle((effectiveJob as any).webbsOrderStyle) : null,
    webbs_items: normalizeWebbsOrderItems((effectiveJob as any).webbsItems),
    webbs_allocations: normalizeWebbsAllocations((effectiveJob as any).webbsAllocations),

    processing_price_override: processingOverride,
    specialty_price_override: specialtyOverride,

    price_processing: usedProcessingPrice,
    price_specialty: usedSpecialtyPrice,
    price_total: usedTotalPrice,

    paid: effectiveJob.paid ?? false,
    paid_processing: effectiveJob.paidProcessing ?? false,
    paid_specialty: effectiveJob.paidSpecialty ?? false,
    requires_tag: requiresTag,

    public_token: effectiveJob.publicToken ? String(effectiveJob.publicToken) : undefined,
    public_link_sent_at: effectiveJob.publicLinkSentAt ?? null,
    dropoff_email_sent_at: effectiveJob.dropoffEmailSentAt ?? null,
    dropoff_sms_sent_at: (effectiveJob as any).dropoffSmsSentAt ?? null,
    finished_email_sent_at: (effectiveJob as any).meatFinishedEmailSentAt ?? null,
    meat_finished_sms_sent_at: (effectiveJob as any).meatFinishedSmsSentAt ?? null,
    cape_finished_email_sent_at: (effectiveJob as any).capeFinishedEmailSentAt ?? null,
    cape_finished_sms_sent_at: (effectiveJob as any).capeFinishedSmsSentAt ?? null,
    specialty_finished_email_sent_at: (effectiveJob as any).specialtyFinishedEmailSentAt ?? null,
    specialty_finished_sms_sent_at: (effectiveJob as any).specialtyFinishedSmsSentAt ?? null,
    webbs_delivered_email_sent_at: (effectiveJob as any).webbsDeliveredEmailSentAt ?? null,
    webbs_delivered_sms_sent_at: (effectiveJob as any).webbsDeliveredSmsSentAt ?? null,
    paid_processing_at: effectiveJob.paidProcessingAt ?? null,
    paid_specialty_at: effectiveJob.paidSpecialtyAt ?? null,

    picked_up_processing: effectiveJob.pickedUpProcessing ?? false,
    picked_up_processing_at: effectiveJob.pickedUpProcessingAt ?? null,
    picked_up_cape: effectiveJob.pickedUpCape ?? false,
    picked_up_cape_at: effectiveJob.pickedUpCapeAt ?? null,
    picked_up_webbs: effectiveJob.pickedUpWebbs ?? false,
    picked_up_webbs_at: effectiveJob.pickedUpWebbsAt ?? null,

    call_attempts: effectiveJob.callAttempts ?? 0,
    meat_attempts: effectiveJob.meatAttempts ?? 0,
    cape_attempts: effectiveJob.capeAttempts ?? 0,
    webbs_attempts: effectiveJob.webbsAttempts ?? 0,
    last_call_at: effectiveJob.lastCallAt ?? null,
    last_called_by: effectiveJob.lastCalledBy ?? null,
    last_call_outcome: effectiveJob.lastCallOutcome ?? null,
    call_notes: effectiveJob.callNotes ?? null,

    pref_email: effectiveJob.prefEmail ?? false,
    pref_sms: effectiveJob.prefSMS ?? false,
    pref_call: effectiveJob.prefCall ?? false,
    sms_consent: effectiveJob.smsConsent ?? false,
    auto_call_consent: false,

    how_killed: effectiveJob.howKilled ?? null,
    updated_at: saveStamp,
  };


// Don't overwrite existing DB fields with undefined (e.g., keep public_token stable)
Object.keys(upsertPayload).forEach((k) => {
  if (upsertPayload[k] === undefined) delete upsertPayload[k];
});


  const { data, error } = await supabaseServer
    .from('jobs')
    .upsert(upsertPayload, {
      onConflict: processor.id ? 'processor_id,tag' : 'tag',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('saveJob error', error);
    throw error;
  }


// ---- Emails (best-effort) ----
  try {
    await trySendNotificationEmails(supabaseServer, data);
  } catch (e) {
    console.error('Notification email failed (non-fatal)', e);
  }
  try {
    await trySendNotificationSms(supabaseServer, data);
  } catch (e) {
    console.error('Notification sms failed (non-fatal)', e);
  }


  return { ok: true, job: data ? mapDbRowToJob(data) : null };
}

/* ---------------- progress ---------------- */

// MAIN STATUS PROGRESSION FOR BUTCHER SCAN
export async function progressJob(tag: string) {
  const supabaseServer = getSupabaseServer();

  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) {
    console.error('progressJob get error', jobError);
    throw jobError;
  }

  if (!job) {
    return { ok: true, nextStatus: null, job: null };
  }

  const curStatusRaw = String(job.status || '').trim();
  const curStatus = curStatusRaw.toLowerCase();

  const isInitialStatus =
    !curStatus ||
    curStatus === 'dropped off' ||
    curStatus === 'drop off' ||
    curStatus === 'droppedoff';

  let nextStatus: string | null = null;

  // Butcher scan flow: Dropped Off -> Processing -> Finished
  if (isInitialStatus) {
    nextStatus = 'Processing';
  } else if (curStatus === 'processing') {
    nextStatus = 'Finished';
  } else {
    nextStatus = null;
  }

  const updates: any = {};
  if (nextStatus) updates.status = nextStatus;

  if (Object.keys(updates).length === 0) {
    return { ok: true, nextStatus: null, job: null };
  }

  updates.updated_at = nowIso();

  const { data: updated, error: updErr } = await supabaseServer
    .from('jobs')
    .update(updates)
    .eq('id', job.id)
    .select('*')
    .maybeSingle();

  if (updErr) {
    console.error('progressJob update error', updErr);
    throw updErr;
  }

  if (updated) {
    try {
      await trySendNotificationEmails(supabaseServer, updated);
    } catch (e) {
      console.error('Notification email after scan progress failed (non-fatal)', e);
    }
    try {
      await trySendNotificationSms(supabaseServer, updated);
    } catch (e) {
      console.error('Notification sms after scan progress failed (non-fatal)', e);
    }
  }

  return {
    ok: true,
    nextStatus,
    job: updated ? mapDbRowToJob(updated) : null,
  };
}

/* ---------------- calling / logs ---------------- */

// LOG CALL + ATTEMPTS (used by "+1 Attempt" and optional notes)
export async function logCall(params: {
  tag: string;
  scope?: 'meat' | 'cape' | 'webbs';
  reason?: string;
  notes?: string;
  outcome?: string;
  who?: string; // optional; safe if you later add a column or ignore it
}) {
  const supabaseServer = getSupabaseServer();
  const { tag, scope, reason, notes, outcome } = params;

  try {
    const { data, error } = await supabaseServer.rpc('mcafee_log_call', {
      p_tag: tag,
      p_scope: scope ?? null,
      p_reason: reason ?? null,
      p_notes: notes ?? null,
      p_outcome: outcome ?? null,
    });

    if (!error && data && data.ok !== false) {
      return { ok: true };
    }
    if (error && error.code !== '42883') {
      throw error;
    }
  } catch (rpcError: any) {
    if (rpcError?.code !== '42883') {
      throw rpcError;
    }
  }

  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) return { ok: false, error: 'Job not found for tag ' + tag };

  // Write call log (best-effort)
  const { error: logError } = await supabaseServer.from('call_logs').insert({
    job_id: job.id,
    tag,
    customer_name: job.customer_name,
    phone: job.phone,
    scope: scope ?? null,
    reason: reason ?? null,
    outcome: outcome ?? null,
    notes: notes ?? null,
  });
  if (logError) throw logError;

  // Update counters + last call metadata
  const patch: any = {
    call_attempts: (job.call_attempts ?? 0) + 1,
    last_call_at: nowIso(),
    last_call_outcome: outcome ?? job.last_call_outcome ?? null,
    updated_at: nowIso(),
  };

  if (scope === 'meat') patch.meat_attempts = (job.meat_attempts ?? 0) + 1;
  if (scope === 'cape') patch.cape_attempts = (job.cape_attempts ?? 0) + 1;
  if (scope === 'webbs') patch.webbs_attempts = (job.webbs_attempts ?? 0) + 1;

  // Append notes rather than overwrite
  const noteText = String(notes || '').trim();
  if (noteText) {
    const line = stampLine(reason || `Call Attempt (${scope || 'auto'})`, noteText);
    patch.call_notes = appendStampedLine(job.call_notes, line);
  }

  const { error: updateError } = await supabaseServer
    .from('jobs')
    .update(patch)
    .eq('id', job.id);

  if (updateError) throw updateError;

  return { ok: true };
}

// MARK CALLED (used by "Mark Called" button)
export async function markCalled(params: {
  tag: string;
  scope?: 'meat' | 'cape' | 'webbs' | 'all' | 'auto';
  notes?: string;
}) {
  const supabaseServer = getSupabaseServer();
  const { tag, scope: rawScope, notes } = params;

  try {
    const { data, error } = await supabaseServer.rpc('mcafee_mark_called', {
      p_tag: tag,
      p_scope: rawScope ?? 'auto',
      p_notes: notes ?? null,
    });

    if (!error && data && data.ok !== false) {
      return {
        ok: true,
        tag: String(data.tag || tag),
        scope: String(data.scope || rawScope || 'auto'),
      };
    }
    if (error && error.code !== '42883') {
      throw error;
    }
  } catch (rpcError: any) {
    if (rpcError?.code !== '42883') {
      throw rpcError;
    }
  }

  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) {
    console.error('markCalled get error', jobError);
    throw jobError;
  }
  if (!job) return { ok: false, error: 'Job not found for tag ' + tag };

  const sNow = job.status;
  const cNow = job.caping_status;
  const wNow = job.webbs_status;

  const meatIsReady = meatReady(sNow);
  const capeIsReady = capeReady(cNow);
  const webbsIsReady = webbsReady(wNow);

  let scope = (rawScope || 'auto') as 'meat' | 'cape' | 'webbs' | 'all' | 'auto';
  const updates: any = {};
  const callStamp = nowIso();

  if (scope === 'all') {
    if (meatIsReady) updates.status = 'Called';
    if (capeIsReady) updates.caping_status = 'Called';
    if (webbsIsReady) updates.webbs_status = 'Called';
  } else if (scope === 'meat') {
    updates.status = 'Called';
  } else if (scope === 'cape') {
    updates.caping_status = 'Called';
  } else if (scope === 'webbs') {
    updates.webbs_status = 'Called';
  } else {
    // auto: choose a sensible default (prefer the ones that actually are ready)
    if (webbsIsReady) {
      updates.webbs_status = 'Called';
      scope = 'webbs';
    } else if (capeIsReady) {
      updates.caping_status = 'Called';
      scope = 'cape';
    } else {
      updates.status = 'Called';
      scope = 'meat';
    }
  }

  // Also bump attempts + last_call_at so UI updates immediately
  updates.last_call_at = callStamp;
  updates.call_attempts = (job.call_attempts ?? 0) + 1;
  if (scope === 'meat') updates.meat_attempts = (job.meat_attempts ?? 0) + 1;
  if (scope === 'cape') updates.cape_attempts = (job.cape_attempts ?? 0) + 1;
  if (scope === 'webbs') updates.webbs_attempts = (job.webbs_attempts ?? 0) + 1;

  // Append call notes if provided
  const noteText = String(notes || '').trim();
  if (noteText) {
    const line = stampLine(`Marked Called (${scope})`, noteText);
    updates.call_notes = appendStampedLine(job.call_notes, line);
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = nowIso();

    const { error: updErr } = await supabaseServer
      .from('jobs')
      .update(updates)
      .eq('id', job.id);

    if (updErr) {
      console.error('markCalled update error', updErr);
      throw updErr;
    }
  }

  // Write call log (best-effort)
  try {
    await supabaseServer.from('call_logs').insert({
      job_id: job.id,
      tag,
      customer_name: job.customer_name,
      phone: job.phone,
      scope,
      reason: `Marked Called (${scope})`,
      outcome: null,
      notes: noteText || null,
    });
  } catch (e) {
    console.error('markCalled log error', e);
  }

  return { ok: true, tag, scope };
}

/* ---------------- needsTag ---------------- */

export async function listJobsNeedingTag(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or('tag.is.null,tag.eq.,requires_tag.eq.true')
    .is('pending_deleted_at', null),
    processor.id
  )
    .order('dropoff_date', { ascending: false })
    .limit(200);

  if (error) {
    console.error('listJobsNeedingTag error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

/* ---------------- setTag ---------------- */

export async function deletePendingJob(params: { jobId: string }) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const jobId = String(params.jobId || '').trim();
  if (!jobId) {
    return { ok: false, error: 'Missing jobId' };
  }

  const deletedAt = nowIso();
  const { data: deleted, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .update({
      pending_deleted_at: deletedAt,
      pending_delete_reason: 'No-show removed from public intake queue',
      updated_at: deletedAt,
    })
    .eq('id', jobId)
    .eq('requires_tag', true)
    .is('pending_deleted_at', null),
    processor.id
  )
    .select('id, tag, confirmation, customer_name, pending_deleted_at, pending_delete_reason')
    .maybeSingle();

  if (error) {
    console.error('deletePendingJob error', error);
    throw error;
  }

  if (!deleted) {
    return { ok: false, error: 'Pending overnight job not found' };
  }

  return {
    ok: true,
    deleted: {
      id: String(deleted.id || ''),
      tag: String(deleted.tag || ''),
      confirmation: String(deleted.confirmation || ''),
      customer: String(deleted.customer_name || ''),
      pendingDeletedAt: String(deleted.pending_deleted_at || deletedAt),
    },
  };
}

export async function markIntakeSheetPrinted(params: { tag: string }) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const tag = String(params.tag || '').trim();
  if (!tag) {
    return { ok: false, error: 'Missing tag' };
  }

  const { data: updated, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .update({
      intake_sheet_printed_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('tag', tag),
    processor.id
  )
    .select('tag, intake_sheet_printed_at, intake_sheet_print_count')
    .maybeSingle();

  if (error) {
    console.error('markIntakeSheetPrinted error', error);
    throw error;
  }

  if (!updated) {
    return { ok: false, error: 'Job not found' };
  }

  const nextCount = Number(updated.intake_sheet_print_count ?? 0) + 1;
  const { data: counted, error: countError } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .update({
      intake_sheet_print_count: nextCount,
      updated_at: nowIso(),
    })
    .eq('tag', tag),
    processor.id
  )
    .select('tag, intake_sheet_printed_at, intake_sheet_print_count')
    .maybeSingle();

  if (countError) {
    console.error('markIntakeSheetPrinted count error', countError);
    throw countError;
  }

  return {
    ok: true,
    tag: String((counted || updated).tag || tag),
    intakeSheetPrintedAt: (counted || updated).intake_sheet_printed_at,
    intakeSheetPrintCount: Number((counted || updated).intake_sheet_print_count ?? nextCount),
  };
}

export async function markIntakeSheetUnprinted(params: { tag: string }) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const tag = String(params.tag || '').trim();
  if (!tag) {
    return { ok: false, error: 'Missing tag' };
  }

  const { data: updated, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .update({
      intake_sheet_printed_at: null,
      updated_at: nowIso(),
    })
    .eq('tag', tag),
    processor.id
  )
    .select('tag, intake_sheet_printed_at, intake_sheet_print_count')
    .maybeSingle();

  if (error) {
    console.error('markIntakeSheetUnprinted error', error);
    throw error;
  }

  if (!updated) {
    return { ok: false, error: 'Job not found' };
  }

  return {
    ok: true,
    tag: String(updated.tag || tag),
    intakeSheetPrintedAt: updated.intake_sheet_printed_at,
    intakeSheetPrintCount: Number(updated.intake_sheet_print_count ?? 0),
  };
}

export async function listRemovedPendingJobs(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .eq('requires_tag', true)
    .not('pending_deleted_at', 'is', null),
    processor.id
  )
    .order('pending_deleted_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('listRemovedPendingJobs error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

export async function restorePendingJob(params: { jobId: string }) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const jobId = String(params.jobId || '').trim();
  if (!jobId) {
    return { ok: false, error: 'Missing jobId' };
  }

  const { data: restored, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .update({
      pending_deleted_at: null,
      pending_delete_reason: null,
      updated_at: nowIso(),
    })
    .eq('id', jobId)
    .eq('requires_tag', true)
    .not('pending_deleted_at', 'is', null),
    processor.id
  )
    .select('id, tag, confirmation, customer_name')
    .maybeSingle();

  if (error) {
    console.error('restorePendingJob error', error);
    throw error;
  }

  if (!restored) {
    return { ok: false, error: 'Removed public intake not found' };
  }

  return {
    ok: true,
    restored: {
      id: String(restored.id || ''),
      tag: String(restored.tag || ''),
      confirmation: String(restored.confirmation || ''),
      customer: String(restored.customer_name || ''),
    },
  };
}

export async function listJobsNeedingPrint(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT + ',intake_sheet_printed_at,intake_sheet_print_count')
    .eq('requires_tag', false)
    .not('tag', 'is', null)
    .neq('tag', '')
    .is('intake_sheet_printed_at', null),
    processor.id
  )
    .order('dropoff_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('listJobsNeedingPrint error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

export async function lookupCustomerByName(name: string) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const q = String(name || '').trim();
  if (!q) return { ok: true, match: null, matches: [] };

  const { data, error } = await withProcessorFilter(
    supabaseServer
    .from('jobs')
    .select('customer_name,phone,email,address,city,state,zip,dropoff_date,created_at,tag')
    .ilike('customer_name', q),
    processor.id
  )
    .order('dropoff_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('lookupCustomerByName error', error);
    throw error;
  }

  const norm = q.toLowerCase();
  const matches = (data || []).map((row: any) => ({
    customer: String(row.customer_name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    state: String(row.state || ''),
    zip: String(row.zip || ''),
    dropoff: row.dropoff_date || null,
    tag: String(row.tag || ''),
    exact: String(row.customer_name || '').trim().toLowerCase() === norm,
  }));
  const match = matches.find((row) => row.exact) || matches[0] || null;
  if (!match) return { ok: true, match: null, matches: [] };

  return {
    ok: true,
    match,
    matches,
  };
}

function currentSeasonStartIso() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

export async function getDashboardSummary() {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();

  const [
    pendingTagsRes,
    printQueueRes,
    seasonEntriesRes,
    todayDropoffsRes,
    calledQueueRes,
    specialtyOpenRes,
  ] = await Promise.all([
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('requires_tag', true),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('requires_tag', false)
        .not('tag', 'is', null)
        .neq('tag', '')
        .is('intake_sheet_printed_at', null),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .not('confirmation', 'is', null)
        .gte('dropoff_date', currentSeasonStartIso()),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('dropoff_date', new Date().toISOString().slice(0, 10)),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id,status,caping_status,webbs_status,picked_up_processing,picked_up_cape,picked_up_webbs')
        .or('status.eq.Called,caping_status.eq.Called,webbs_status.eq.Called')
        .limit(1000),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('specialty_products', true)
        .neq('specialty_status', 'Picked Up'),
      processor.id
    ),
  ]);

  const countOrThrow = (label: string, res: any) => {
    if (res.error) {
      console.error(`${label} dashboard count error`, res.error);
      throw res.error;
    }
    return Number(res.count || 0);
  };

  const calledRows = calledQueueRes.data || [];
  if (calledQueueRes.error) {
    console.error('called queue dashboard error', calledQueueRes.error);
    throw calledQueueRes.error;
  }

  const calledQueue = calledRows.filter((r: any) => {
    const meatInQueue = isCalled(r.status) && !r.picked_up_processing;
    const capeInQueue = isCalled(r.caping_status) && !r.picked_up_cape;
    const webbsInQueue = isCalled(r.webbs_status) && !r.picked_up_webbs;
    return meatInQueue || capeInQueue || webbsInQueue;
  }).length;

  return {
    pendingTags: countOrThrow('pendingTags', pendingTagsRes),
    printQueue: countOrThrow('printQueue', printQueueRes),
    seasonEntries: countOrThrow('seasonEntries', seasonEntriesRes),
    todayDropoffs: countOrThrow('todayDropoffs', todayDropoffsRes),
    specialtyOpen: countOrThrow('specialtyOpen', specialtyOpenRes),
    calledQueue,
  };
}

export async function setJobTag(params: {
  jobId: string;
  newTag: string;
  stampDropEmail?: boolean;
  returnRow?: boolean;
}) {
  const supabaseServer = getSupabaseServer();
  const { jobId, newTag, stampDropEmail, returnRow } = params;

  const tag = String(newTag || '').trim();
  if (!jobId || !tag) {
    return { ok: false, error: 'Missing jobId or newTag' };
  }

  // Ensure tag not already used by another job
  const { data: existing, error: existErr } = await supabaseServer
    .from('jobs')
    .select('id, tag')
    .eq('tag', tag)
    .neq('id', jobId)
    .maybeSingle();

  if (existErr) {
    console.error('setJobTag check error', existErr);
    throw existErr;
  }
  if (existing) {
    return { ok: false, error: 'Tag already in use' };
  }

  // Load current job
  const { data: job, error: jobErr } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr) {
    console.error('setJobTag get error', jobErr);
    throw jobErr;
  }
  if (!job) {
    return { ok: false, error: 'Job not found' };
  }

  const updates: any = {
    tag,
    requires_tag: false,
    updated_at: nowIso(),
  };

  let stamped = false;
  if (stampDropEmail) {
    updates.dropoff_email_sent_at = nowIso();
    updates.dropoff_sms_sent_at = nowIso();
    stamped = true;
  }

  const { data: updated, error: updErr } = await supabaseServer
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .maybeSingle();

  if (updErr) {
    console.error('setJobTag update error', updErr);
    throw updErr;
  }

  if (!returnRow) {
    return { ok: true, jobId, tag };
  }

  const mapped = updated ? mapDbRowToJob(updated) : null;

  if (updated) {
    try {
      await trySendNotificationEmails(supabaseServer, updated);
    } catch (e) {
      console.error('Notification email after setTag failed (non-fatal)', e);
    }
    try {
      await trySendNotificationSms(supabaseServer, updated);
    } catch (e) {
      console.error('Notification sms after setTag failed (non-fatal)', e);
    }
  }

  return {
    ok: true,
    jobId,
    tag,
    job: mapped,
    dropEmailStamped: stamped,
  };
}
