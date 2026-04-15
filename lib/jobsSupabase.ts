// lib/jobsSupabase.ts
import { getSupabaseServer } from './supabaseClient';
import { Job, JobSearchRow } from '@/types/job';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { normalizeUsPhone, sendSms } from '@/lib/sms';
import { specialtyPrice, specialtyTotalLbs } from '@/lib/specialty';
import { getProcessorSpecialtyCatalog, normalizeJobSpecialtyItems, SpecialtyLegacyFieldKey } from '@/lib/specialtyCatalog';
import {
  calcCatalogProcessingPrice,
  deriveSelectedAddOnItems,
  normalizeNotificationTemplates,
  normalizeProcessCatalog,
  normalizeJobAddOnItems,
  processTypeNeedsCapeWorkflow,
  renderNotificationTemplate,
  resolveProcessType,
} from '@/lib/processorCatalog';
import { normalizeWebbsAllocations, normalizeWebbsOrderItems, normalizeWebbsOrderStyle } from '@/lib/webbs';
import { calcProcessingPrice, SitePricing } from '@/lib/pricing';
import { getPublicSiteSettings, normalizeProcessorFeatures } from '@/lib/siteSettings';
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
    notificationTemplates: normalizeNotificationTemplates(settings.notificationTemplates, String(settings.branding.name || 'Game Butcher Board')),
  };
}

function notificationVars(opts: {
  name?: string;
  tag?: string;
  link?: string;
  paidProcessing?: boolean;
  processingPrice?: number;
  paidSpecialty?: boolean;
  specialtyPrice?: number;
  businessName: string;
  phoneDisplay?: string;
}) {
  const phoneDisplay = String(opts.phoneDisplay || '').trim();
  return {
    name: String(opts.name || 'there'),
    tag: String(opts.tag || ''),
    businessName: String(opts.businessName || 'Game Butcher Board'),
    phoneDisplay,
    phoneSuffix: phoneDisplay ? ` at ${phoneDisplay}` : '',
    intakeLink: String(opts.link || ''),
    intakeLinkLine: opts.link ? `Click here to view your intake form: ${opts.link}` : '',
    statusUrl: statusPageLink(),
    statusLine: statusPageLink() ? `Status: ${statusPageLink()}` : '',
    pickupHours: '6:00 pm-8:00 pm Monday-Friday, 9:00 am-5:00 pm Saturday, 9:00 am-12:00 pm Sunday.',
    processingDueLine: opts.paidProcessing
      ? 'Regular processing: PAID'
      : `Amount still owed (regular processing): $${Number(opts.processingPrice || 0).toFixed(2)}`,
    specialtyDueLine: opts.paidSpecialty
      ? 'Specialty products: PAID'
      : `Amount still owed (specialty products): $${Number(opts.specialtyPrice || 0).toFixed(2)}`,
  };
}

function buildNotificationEmail(
  eventKey: keyof ReturnType<typeof normalizeNotificationTemplates>,
  opts: {
    name?: string;
    tag?: string;
    link?: string;
    paidProcessing?: boolean;
    processingPrice?: number;
    paidSpecialty?: boolean;
    specialtyPrice?: number;
    businessName: string;
    phoneDisplay?: string;
    notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates>;
  },
) {
  const vars = notificationVars(opts);
  const templates = opts.notificationTemplates || normalizeNotificationTemplates({}, vars.businessName);
  const template = templates[eventKey];
  return {
    subject: renderNotificationTemplate(template.emailSubject, vars),
    html: renderNotificationTemplate(template.emailBody, vars)
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br/>')}</p>`)
      .join(''),
    text: renderNotificationTemplate(template.emailBody, vars),
  };
}

function buildManualEmailHtml(opts: {
  body: string;
  businessName: string;
  phoneDisplay?: string;
}) {
  const safeParagraphs = String(opts.body || '')
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const footerBits = [String(opts.businessName || '').trim(), String(opts.phoneDisplay || '').trim()].filter(Boolean);
  const footer = footerBits.length ? `<p style="margin-top:20px;color:#475569;">${escapeHtml(footerBits.join(' • '))}</p>` : '';
  return `${safeParagraphs || '<p></p>'}${footer}`;
}

function buildNotificationSms(
  eventKey: keyof ReturnType<typeof normalizeNotificationTemplates>,
  opts: {
    name?: string;
    tag?: string;
    link?: string;
    paidProcessing?: boolean;
    processingPrice?: number;
    paidSpecialty?: boolean;
    specialtyPrice?: number;
    businessName: string;
    phoneDisplay?: string;
    notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates>;
  },
) {
  const vars = notificationVars(opts);
  const templates = opts.notificationTemplates || normalizeNotificationTemplates({}, vars.businessName);
  return renderNotificationTemplate(templates[eventKey].smsBody, vars).replace(/\s+/g, ' ').trim();
}

function buildIntakeEmail(opts: { name: string; tag: string; link: string; businessName: string; phoneDisplay: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationEmail('intake', opts);
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


function buildFinishedEmail(opts: { name: string; tag: string; paidProcessing: boolean; processingPrice: number; businessName: string; phoneDisplay: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationEmail('meat_finished', opts);
}

function buildIntakeSms(opts: { tag: string; statusUrl: string; businessName: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationSms('intake', opts);
}

function buildMeatFinishedSms(opts: { tag: string; paidProcessing: boolean; processingPrice: number; statusUrl: string; businessName: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationSms('meat_finished', opts);
}

function buildCapeFinishedSms(opts: { tag: string; statusUrl: string; businessName: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationSms('cape_finished', opts);
}

function buildSpecialtyFinishedSms(opts: { tag: string; paidSpecialty: boolean; specialtyPrice: number; statusUrl: string; businessName: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationSms('specialty_finished', opts);
}

function buildWebbsDeliveredSms(opts: { tag: string; statusUrl: string; businessName: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationSms('webbs_delivered', opts);
}

function buildCapeFinishedEmail(opts: { name: string; tag: string; businessName: string; phoneDisplay: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationEmail('cape_finished', opts);
}

function buildSpecialtyFinishedEmail(opts: {
  name: string;
  tag: string;
  paidSpecialty: boolean;
  specialtyPrice: number;
  businessName: string;
  phoneDisplay: string;
  notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates>;
}) {
  return buildNotificationEmail('specialty_finished', opts);
}

function buildWebbsDeliveredEmail(opts: { name: string; tag: string; businessName: string; phoneDisplay: string; notificationTemplates?: ReturnType<typeof normalizeNotificationTemplates> }) {
  return buildNotificationEmail('webbs_delivered', opts);
}

function statusIsFinishedLike(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return /finish|ready/.test(s);
}

function processTypeNeedsCape(processType: any) {
  return processTypeNeedsCapeWorkflow(processType);
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

function clampMoney(value: number, max: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Math.max(0, Number.isFinite(max) ? max : 0);
  return Math.min(Math.max(0, safeValue), safeMax);
}

function paymentMethodOrNull(value: any): 'cash' | 'card' | 'check' | 'other' | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'cash' || raw === 'card' || raw === 'check' || raw === 'other') return raw;
  return null;
}

function specialtyLegacyValues(items: Array<{ legacyFieldKey?: string | null; quantity: number }>) {
  const out: Record<SpecialtyLegacyFieldKey, number> = {
    originalSummerSausageLbs: 0,
    summerSausageCheeseLbs: 0,
    jalapenoSummerSausageCheeseLbs: 0,
    originalSnackSticksLbs: 0,
    originalSnackSticksCheeseLbs: 0,
    jalapenoSnackSticksCheeseLbs: 0,
  };
  for (const item of items) {
    const key = item.legacyFieldKey as SpecialtyLegacyFieldKey | undefined;
    if (key && key in out) out[key] += numOrZero(item.quantity);
  }
  return out;
}

async function loadJobSpecialtyItemsMap(supabaseServer: any, jobIds: string[]) {
  if (!jobIds.length) return new Map<string, any[]>();
  const { data, error } = await supabaseServer
    .from('job_specialty_items')
    .select('id,job_id,processor_specialty_item_id,item_slug,item_name,short_name,unit,price_type,quantity,unit_price,total_price,sort_order')
    .in('job_id', jobIds)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('loadJobSpecialtyItemsMap error', error);
    throw error;
  }
  const out = new Map<string, any[]>();
  for (const row of data || []) {
    const key = String((row as any).job_id || '');
    const list = out.get(key) || [];
    list.push({
      id: (row as any).id,
      catalogId: (row as any).processor_specialty_item_id,
      slug: (row as any).item_slug,
      name: (row as any).item_name,
      shortName: (row as any).short_name,
      unit: (row as any).unit,
      priceType: (row as any).price_type,
      quantity: Number((row as any).quantity ?? 0),
      pricePerUnit: Number((row as any).unit_price ?? 0),
      total: Number((row as any).total_price ?? 0),
      sortOrder: Number((row as any).sort_order ?? 0),
    });
    out.set(key, list);
  }
  return out;
}

async function syncJobSpecialtyItems(
  supabaseServer: any,
  params: {
    jobId: string;
    processorId?: string | null;
    specialtyItems: Array<{
      id?: string | null;
      catalogId?: string | null;
      slug: string;
      name: string;
      shortName: string;
      unit: string;
      priceType: string;
      quantity: number;
      pricePerUnit: number;
      total: number;
      sortOrder: number;
    }>;
  },
) {
  const { jobId, processorId, specialtyItems } = params;
  const { data: existing, error: existingError } = await supabaseServer
    .from('job_specialty_items')
    .select('id,item_slug')
    .eq('job_id', jobId);
  if (existingError) throw existingError;

  const existingMap = new Map<string, string>();
  for (const row of existing || []) {
    existingMap.set(String((row as any).item_slug || '').toLowerCase(), String((row as any).id));
  }

  const keepIds = new Set<string>();
  for (const item of specialtyItems) {
    const payload = {
      job_id: jobId,
      ...(processorId ? { processor_id: processorId } : {}),
      processor_specialty_item_id: item.catalogId ?? null,
      item_slug: item.slug,
      item_name: item.name,
      short_name: item.shortName,
      unit: item.unit,
      price_type: item.priceType,
      quantity: item.quantity,
      unit_price: item.pricePerUnit,
      total_price: item.total,
      sort_order: item.sortOrder,
      updated_at: nowIso(),
    };
    const existingId = item.id || existingMap.get(item.slug.toLowerCase());
    if (existingId) {
      keepIds.add(String(existingId));
      const { error: updateError } = await supabaseServer
        .from('job_specialty_items')
        .update(payload)
        .eq('id', existingId)
        .eq('job_id', jobId);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabaseServer
        .from('job_specialty_items')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;
      keepIds.add(String((inserted as any)?.id || ''));
    }
  }

  for (const row of existing || []) {
    const id = String((row as any).id || '');
    if (!keepIds.has(id)) {
      const { error: deleteError } = await supabaseServer
        .from('job_specialty_items')
        .delete()
        .eq('id', id)
        .eq('job_id', jobId);
      if (deleteError) throw deleteError;
    }
  }
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
  return /cape|caped|finish|finished|ready|complete|completed|done/.test(s);
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
  if (!processTypeNeedsCapeWorkflow(row.process_type, undefined, row.process_type_requires_cape) || !capeReady(row.caping_status)) return;
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
    notificationTemplates: branding.notificationTemplates,
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
  if (!processTypeNeedsCapeWorkflow(row.process_type, undefined, row.process_type_requires_cape) || !capeReady(row.caping_status)) return;
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
    notificationTemplates: branding.notificationTemplates,
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
  if (event === 'cape_finished' && (!processTypeNeedsCapeWorkflow(row.process_type, undefined, row.process_type_requires_cape) || !capeReady(row.caping_status))) {
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
        notificationTemplates: branding.notificationTemplates,
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
        notificationTemplates: branding.notificationTemplates,
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
        notificationTemplates: branding.notificationTemplates,
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
        notificationTemplates: branding.notificationTemplates,
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
        notificationTemplates: branding.notificationTemplates,
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
    body = buildIntakeSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName, notificationTemplates: branding.notificationTemplates });
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
      notificationTemplates: branding.notificationTemplates,
    });
  }
  if (event === 'cape_finished') {
    const branding = await getNotificationBranding();
    body = buildCapeFinishedSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName, notificationTemplates: branding.notificationTemplates });
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
      notificationTemplates: branding.notificationTemplates,
    });
  }
  if (event === 'webbs_delivered') {
    const branding = await getNotificationBranding();
    body = buildWebbsDeliveredSms({ tag: String(row.tag || ''), statusUrl: statusPageLink(), businessName: branding.businessName, notificationTemplates: branding.notificationTemplates });
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

export async function sendManualCustomerMessage(params: {
  tag: string;
  channel: 'email' | 'sms';
  subject?: string;
  body: string;
}) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  const tag = String(params.tag || '').trim();
  const channel = params.channel;
  const body = String(params.body || '').trim();
  const subject = String(params.subject || '').trim();

  if (!tag) return { ok: false as const, error: 'Missing tag' };
  if (channel !== 'email' && channel !== 'sms') return { ok: false as const, error: 'Invalid channel' };
  if (!body) return { ok: false as const, error: 'Message body is required' };

  const { data: row, error } = await withProcessorFilter(
    supabaseServer.from('jobs').select('*').eq('tag', tag),
    processor.id
  ).maybeSingle();

  if (error) throw error;
  if (!row) return { ok: false as const, error: 'Job not found' };

  const branding = await getNotificationBranding();

  if (channel === 'email') {
    const email = String(row.email || '').trim();
    if (!hasUsableEmail(row)) {
      return { ok: false as const, error: 'This customer does not have a valid email address.' };
    }
    await sendEmail({
      to: email,
      subject: subject || `Message from ${branding.businessName}`,
      html: buildManualEmailHtml({
        body,
        businessName: branding.businessName,
        phoneDisplay: branding.phoneDisplay,
      }),
      text: body,
    });
    return {
      ok: true as const,
      channel,
      destination: email,
      subject: subject || `Message from ${branding.businessName}`,
    };
  }

  if (!row.sms_consent) {
    return { ok: false as const, error: 'This customer has not opted in to text messaging.' };
  }

  const phone = normalizeUsPhone(String(row.phone || ''));
  if (!phone) {
    return { ok: false as const, error: 'This customer does not have a valid phone number for text updates.' };
  }

  const result = await sendSms({ to: phone, body });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  await logSmsResult(supabaseServer, {
    jobId: String(row.id),
    processorId: row.processor_id ? String(row.processor_id) : null,
    phone,
    template: 'manual_message',
    body,
    result,
  });

  return {
    ok: true as const,
    channel,
    destination: phone,
    subject: null,
  };
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
function mapDbRowToJob(row: any, specialtyItems: any[] = []): Job {
  const j: any = {
    id: row.id,
    row: undefined, // only used for Sheets, not Supabase

    // Identity
    tag: row.tag,
    confirmation: row.confirmation,
    customer: row.customer_name,
    phone: row.phone,
    email: row.email,
    huntingLicenseNumber: row.hunting_license_number ?? null,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,

    county: row.county_killed,
    dropoff: row.dropoff_date,
    sex: row.deer_sex,
    processType: row.process_type,
    processTypeSlug: row.process_type_slug ?? null,
    processTypeRequiresCape: row.process_type_requires_cape ?? null,
    processingWeightLbs: row.processing_weight_lbs != null ? Number(row.processing_weight_lbs) : null,

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
    addOnItems: normalizeJobAddOnItems(row.add_on_items),

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
    specialtyProducts: !!row.specialty_products || specialtyItems.length > 0,
    specialtyPounds: specialtyItems.length
      ? specialtyItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
      : Number(row.specialty_pounds ?? 0),
    specialtyItems,
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
    amountPaidProcessing: Number(row.amount_paid_processing ?? 0),
    amountPaidSpecialty: Number(row.amount_paid_specialty ?? 0),
    paymentMethodProcessing: paymentMethodOrNull(row.payment_method_processing),
    paymentMethodSpecialty: paymentMethodOrNull(row.payment_method_specialty),

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
    processingStartedAt: row.processing_started_at ?? null,
    processingFinishedAt: row.processing_finished_at ?? null,

    // Pickup
    pickedUpProcessing: !!row.picked_up_processing,
    pickedUpProcessingAt: row.picked_up_processing_at,
    pickedUpCape: !!row.picked_up_cape,
    pickedUpCapeAt: row.picked_up_cape_at,
    pickedUpWebbs: !!row.picked_up_webbs,
    pickedUpWebbsAt: row.picked_up_webbs_at,
    pickedUpBy: row.picked_up_by ?? null,
    pickupNotes: row.pickup_notes ?? null,

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
    huntingLicenseNumber: row.hunting_license_number ?? null,
    status: row.status,
    capingStatus: row.caping_status,
    webbsStatus: row.webbs_status,
    specialtyStatus: row.specialty_status,
    priceProcessing: Number(row.price_processing ?? 0),
    priceSpecialty: Number(row.price_specialty ?? 0),
    price: Number(row.price_total ?? 0),
    amountPaidProcessing: Number(row.amount_paid_processing ?? 0),
    amountPaidSpecialty: Number(row.amount_paid_specialty ?? 0),
    paymentMethodProcessing: paymentMethodOrNull(row.payment_method_processing),
    paymentMethodSpecialty: paymentMethodOrNull(row.payment_method_specialty),
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
    ...(row.picked_up_by != null ? ({ pickedUpBy: row.picked_up_by } as any) : {}),
    ...(row.pickup_notes != null ? ({ pickupNotes: row.pickup_notes } as any) : {}),
    ...(row.intake_sheet_printed_at != null ? ({ intakeSheetPrintedAt: row.intake_sheet_printed_at } as any) : {}),
    ...(row.intake_sheet_print_count != null ? ({ intakeSheetPrintCount: Number(row.intake_sheet_print_count ?? 0) } as any) : {}),
    ...(row.updated_at != null ? ({ updatedAt: row.updated_at } as any) : {}),
    ...(row.pending_deleted_at != null ? ({ pendingDeletedAt: row.pending_deleted_at } as any) : {}),
  } as JobSearchRow;
}

/* ---------------- core reads ---------------- */

export async function getJobByTag(tag: string, opts: { processorContext?: ProcessorContext | null } = {}) {
  const supabaseServer = getSupabaseServer();
  const processor = opts.processorContext ?? await getDefaultProcessorContext();

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

  const specialtyItemsMap = await loadJobSpecialtyItemsMap(supabaseServer, [String(data.id)]);
  return {
    ok: true,
    exists: true as const,
    job: mapDbRowToJob(data, specialtyItemsMap.get(String(data.id)) || []),
  };
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
  amount_paid_processing,
  amount_paid_specialty,
  payment_method_processing,
  payment_method_specialty,
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
  picked_up_processing_at,
  picked_up_cape,
  picked_up_cape_at,
  picked_up_webbs,
  picked_up_webbs_at,
  picked_up_by,
  pickup_notes,
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
  const confirmationDigits = q.replace(/\D/g, '');

  if (!q) return { ok: true, rows: [] };

  // --- special keywords used by your UI ---
  if (q.toLowerCase() === '@report') return searchReport();
  if (q.toLowerCase() === '@recall') return searchRecall();

  // Fast path for the most common staff searches: exact tag or confirmation lookups.
  // This keeps scanner/manual tag entry and exact confirmation searches on indexed equality queries
  // before we fall back to broader fuzzy matching.
  if (q.length <= 32) {
    const { data: exactTagRows, error: exactTagError } = await withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select(SEARCH_SELECT)
        .is('pending_deleted_at', null)
        .eq('tag', q),
      processor.id
    )
      .limit(10);

    if (exactTagError) {
      console.error('searchJobs exact tag error', exactTagError);
      throw exactTagError;
    }
    if ((exactTagRows || []).length) {
      return { ok: true, rows: (exactTagRows || []).map(mapDbRowToSearchRow) };
    }

    if (confirmationDigits.length >= 6) {
      const { data: exactConfirmationRows, error: exactConfirmationError } = await withProcessorFilter(
        supabaseServer
          .from('jobs')
          .select(SEARCH_SELECT)
          .is('pending_deleted_at', null)
          .eq('confirmation', confirmationDigits),
        processor.id
      )
        .limit(10);

      if (exactConfirmationError) {
        console.error('searchJobs exact confirmation error', exactConfirmationError);
        throw exactConfirmationError;
      }
      if ((exactConfirmationRows || []).length) {
        return { ok: true, rows: (exactConfirmationRows || []).map(mapDbRowToSearchRow) };
      }
    }
  }

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
  const settings = await getPublicSiteSettings();
  const pricing = settings.pricing;
  const processCatalog = normalizeProcessCatalog(settings.processCatalog, pricing);
  const addOnCatalog = settings.addOnCatalog;
  const specialtyCatalog = await getProcessorSpecialtyCatalog(processor.id, pricing);
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



  const selectedProcessType = resolveProcessType(effectiveJob.processType, processCatalog);
  const addOnItems = deriveSelectedAddOnItems(
    {
      addOnItems: (effectiveJob as any).addOnItems,
      beefFat: effectiveJob.beefFat,
      webbsOrder: effectiveJob.webbsOrder,
    },
    addOnCatalog,
  );
  const computedProcessingPrice = calcCatalogProcessingPrice(
    {
      processType: effectiveJob.processType,
      processingWeightLbs: (effectiveJob as any).processingWeightLbs,
      addOnItems,
      beefFat: effectiveJob.beefFat,
      webbsOrder: effectiveJob.webbsOrder,
    },
    processCatalog,
    addOnCatalog,
  );
  const normalizedSpecialtyItems = normalizeJobSpecialtyItems((effectiveJob as any).specialtyItems);
  const specialtyItems =
    normalizedSpecialtyItems.length > 0
      ? normalizedSpecialtyItems
      : (effectiveJob.specialtyProducts
          ? specialtyCatalog
              .map((item) => {
                const quantity = item.legacyFieldKey
                  ? numOrZero((effectiveJob as any)[item.legacyFieldKey])
                  : 0;
                return {
                  catalogId: item.id ?? null,
                  slug: item.slug,
                  name: item.name,
                  shortName: item.shortName,
                  unit: item.unit,
                  priceType: item.priceType,
                  quantity,
                  pricePerUnit: item.price,
                  total: quantity * item.price,
                  sortOrder: item.sortOrder,
                  legacyFieldKey: item.legacyFieldKey ?? null,
                };
              })
              .filter((item) => item.quantity > 0)
          : []);
  const computedSpecialtyPrice = calcSpecialtyPriceFromLbs(effectiveJob, pricing);
  const specialtyTotals = specialtyLegacyValues(specialtyItems);

  const processingOverride = numOrNull(
    (effectiveJob as any).processing_price_override ?? (effectiveJob as any).processingPriceOverride
  );
  const specialtyOverride  = numOrNull(
    (effectiveJob as any).specialty_price_override  ?? (effectiveJob as any).specialtyPriceOverride
  );

  const usedProcessingPrice = processingOverride ?? (numOrNull(effectiveJob.priceProcessing) ?? computedProcessingPrice);
  const usedSpecialtyPrice  = specialtyOverride  ?? (numOrNull(effectiveJob.priceSpecialty) ?? computedSpecialtyPrice);
  const usedTotalPrice      = numOrNull(effectiveJob.price) ?? (usedProcessingPrice + usedSpecialtyPrice);

  const hasAmountPaidProcessing = Object.prototype.hasOwnProperty.call(effectiveJob, 'amountPaidProcessing');
  const hasAmountPaidSpecialty = Object.prototype.hasOwnProperty.call(effectiveJob, 'amountPaidSpecialty');
  const hasPaidProcessingFlag = Object.prototype.hasOwnProperty.call(effectiveJob, 'paidProcessing');
  const hasPaidSpecialtyFlag = Object.prototype.hasOwnProperty.call(effectiveJob, 'paidSpecialty');

  const rawAmountPaidProcessing = hasAmountPaidProcessing
    ? numOrZero((effectiveJob as any).amountPaidProcessing)
    : hasPaidProcessingFlag
      ? ((effectiveJob as any).paidProcessing ? usedProcessingPrice : 0)
      : numOrZero((existingJob as any)?.amountPaidProcessing);
  const rawAmountPaidSpecialty = hasAmountPaidSpecialty
    ? numOrZero((effectiveJob as any).amountPaidSpecialty)
    : hasPaidSpecialtyFlag
      ? ((effectiveJob as any).paidSpecialty ? usedSpecialtyPrice : 0)
      : numOrZero((existingJob as any)?.amountPaidSpecialty);

  const amountPaidProcessing = clampMoney(rawAmountPaidProcessing, usedProcessingPrice);
  const amountPaidSpecialty = clampMoney(rawAmountPaidSpecialty, usedSpecialtyPrice);
  const paymentMethodProcessing = amountPaidProcessing > 0
    ? paymentMethodOrNull((effectiveJob as any).paymentMethodProcessing) ?? paymentMethodOrNull((existingJob as any)?.paymentMethodProcessing)
    : null;
  const paymentMethodSpecialty = amountPaidSpecialty > 0
    ? paymentMethodOrNull((effectiveJob as any).paymentMethodSpecialty) ?? paymentMethodOrNull((existingJob as any)?.paymentMethodSpecialty)
    : null;
  const paidProcessing = usedProcessingPrice <= 0 ? true : amountPaidProcessing >= usedProcessingPrice;
  const paidSpecialty = usedSpecialtyPrice <= 0 ? true : amountPaidSpecialty >= usedSpecialtyPrice;
  const paidOverall = paidProcessing && paidSpecialty;
  const paidProcessingAt = paidProcessing
    ? effectiveJob.paidProcessingAt ?? existingJob?.paidProcessingAt ?? saveStamp
    : null;
  const paidSpecialtyAt = paidSpecialty
    ? effectiveJob.paidSpecialtyAt ?? existingJob?.paidSpecialtyAt ?? saveStamp
    : null;

  const upsertPayload: any = {
    ...(processor.id ? { processor_id: processor.id } : {}),
    tag: tagToStore,
    confirmation: effectiveJob.confirmation ?? null,
    customer_name: effectiveJob.customer ?? null,
    phone: effectiveJob.phone ?? null,
    email: effectiveJob.email ?? null,
    hunting_license_number: (effectiveJob as any).huntingLicenseNumber ?? null,
    address: effectiveJob.address ?? null,
    city: effectiveJob.city ?? null,
    state: effectiveJob.state ?? null,
    zip: effectiveJob.zip ?? null,

    county_killed: effectiveJob.county ?? null,
    deer_sex: effectiveJob.sex ?? null,
    process_type: effectiveJob.processType ?? null,
    process_type_slug: selectedProcessType?.slug ?? (effectiveJob as any).processTypeSlug ?? null,
    process_type_requires_cape: selectedProcessType?.triggersCapeWorkflow ?? !!(effectiveJob as any).processTypeRequiresCape,
    processing_weight_lbs: numOrNull((effectiveJob as any).processingWeightLbs),
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
    add_on_items: normalizeJobAddOnItems(addOnItems),

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

    specialty_products: specialtyItems.length > 0 || effectiveJob.specialtyProducts === true,
    specialty_pounds: specialtyItems.reduce((sum, item) => sum + numOrZero(item.quantity), 0),
    original_summer_sausage_lbs: specialtyTotals.originalSummerSausageLbs,
    summer_sausage_lbs: specialtyTotals.originalSummerSausageLbs,
    summer_sausage_cheese_lbs: specialtyTotals.summerSausageCheeseLbs,
    jalapeno_summer_sausage_cheese_lbs: specialtyTotals.jalapenoSummerSausageCheeseLbs,
    sliced_jerky_lbs: specialtyTotals.jalapenoSummerSausageCheeseLbs,
    original_snack_sticks_lbs: specialtyTotals.originalSnackSticksLbs,
    original_snack_sticks_cheese_lbs: specialtyTotals.originalSnackSticksCheeseLbs,
    jalapeno_snack_sticks_cheese_lbs: specialtyTotals.jalapenoSnackSticksCheeseLbs,

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
    amount_paid_processing: amountPaidProcessing,
    amount_paid_specialty: amountPaidSpecialty,
    payment_method_processing: paymentMethodProcessing,
    payment_method_specialty: paymentMethodSpecialty,

    paid: paidOverall,
    paid_processing: paidProcessing,
    paid_specialty: paidSpecialty,
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
    paid_processing_at: paidProcessingAt,
    paid_specialty_at: paidSpecialtyAt,

    picked_up_processing: effectiveJob.pickedUpProcessing ?? false,
    picked_up_processing_at: effectiveJob.pickedUpProcessingAt ?? null,
    picked_up_cape: effectiveJob.pickedUpCape ?? false,
    picked_up_cape_at: effectiveJob.pickedUpCapeAt ?? null,
    picked_up_webbs: effectiveJob.pickedUpWebbs ?? false,
    picked_up_webbs_at: effectiveJob.pickedUpWebbsAt ?? null,
    picked_up_by: (effectiveJob as any).pickedUpBy ?? null,
    pickup_notes: (effectiveJob as any).pickupNotes ?? null,

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

  if (data?.id) {
    await syncJobSpecialtyItems(supabaseServer, {
      jobId: String(data.id),
      processorId: processor.id,
      specialtyItems,
    });
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

  const specialtyItemsMap = data?.id
    ? await loadJobSpecialtyItemsMap(supabaseServer, [String(data.id)])
    : new Map<string, any[]>();
  return {
    ok: true,
    job: data ? mapDbRowToJob(data, specialtyItemsMap.get(String(data.id)) || specialtyItems) : null,
  };
}

/* ---------------- progress ---------------- */

// MAIN STATUS PROGRESSION FOR BUTCHER SCAN
export async function progressJob(tag: string) {
  const supabaseServer = getSupabaseServer();
  const processor = await getDefaultProcessorContext();
  let scanEnabled = true;
  let capeScanEnabled = true;

  if (processor.id) {
    const { data: processorRow } = await supabaseServer
      .from('processors')
      .select('features')
      .eq('id', processor.id)
      .maybeSingle();
    const features = normalizeProcessorFeatures((processorRow as any)?.features || {});
    scanEnabled = features.scanEnabled !== false;
    capeScanEnabled = scanEnabled && features.capeScanEnabled !== false;
  }

  if (!scanEnabled) {
    return { ok: false, error: 'Scan workflow is turned off for this processor.' };
  }

  const { data: job, error: jobError } = await withProcessorFilter(
    supabaseServer
      .from('jobs')
      .select('*')
      .eq('tag', tag),
    processor.id
  ).maybeSingle();

  if (jobError) {
    console.error('progressJob get error', jobError);
    throw jobError;
  }

  if (!job) {
    return { ok: true, nextStatus: null, job: null };
  }

  const curStatusRaw = String(job.status || '').trim();
  const curStatus = curStatusRaw.toLowerCase();
  const curCapeStatusRaw = String(job.caping_status || '').trim();

  const isProcessingStage =
    curStatus === 'processing' ||
    curStatus === 'in progress' ||
    curStatus === 'inprogress';
  const isTerminalMeatStatus =
    curStatus === 'called' ||
    curStatus === 'picked up' ||
    curStatus === 'pickedup' ||
    meatReady(curStatusRaw);
  const canStartMeatProcessing = !isProcessingStage && !isTerminalMeatStatus;

  let nextStatus: string | null = null;
  let progressedField: 'status' | 'caping_status' | null = null;
  const needsCape = capeScanEnabled && processTypeNeedsCapeWorkflow(job.process_type, undefined, job.process_type_requires_cape);
  const capeAlreadyFinished = capeReady(curCapeStatusRaw);

  // Cape flow:
  // 1) Cape -> Caped
  // 2) Dropped Off -> Processing
  // 3) Processing -> Finished
  if (needsCape && !capeAlreadyFinished) {
    nextStatus = 'Caped';
    progressedField = 'caping_status';
  } else if (canStartMeatProcessing) {
    nextStatus = 'Processing';
    progressedField = 'status';
  } else if (isProcessingStage) {
    nextStatus = 'Finished';
    progressedField = 'status';
  } else {
    nextStatus = null;
    progressedField = null;
  }

  const updates: any = {};
  if (nextStatus && progressedField === 'status') updates.status = nextStatus;
  if (nextStatus && progressedField === 'caping_status') updates.caping_status = nextStatus;
  if (nextStatus === 'Processing' && progressedField === 'status' && !job.processing_started_at) {
    updates.processing_started_at = nowIso();
  }
  if (nextStatus === 'Finished' && progressedField === 'status' && !job.processing_finished_at) {
    updates.processing_finished_at = nowIso();
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, nextStatus: null, job: null };
  }

  updates.updated_at = nowIso();

  const { data: updated, error: updErr } = await withProcessorFilter(
    supabaseServer
      .from('jobs')
      .update(updates)
      .eq('id', job.id),
    processor.id
  )
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

  const updatedSpecialtyItems = updated
    ? (await loadJobSpecialtyItemsMap(supabaseServer, [String(updated.id)])).get(String(updated.id)) || []
    : [];

  return {
    ok: true,
    nextStatus,
    progressedField,
    job: updated ? mapDbRowToJob(updated, updatedSpecialtyItems) : null,
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
    const payload = {
      p_tag: tag,
      p_scope: scope ?? null,
      p_reason: reason ?? null,
      p_notes: notes ?? null,
      p_outcome: outcome ?? null,
    };
    let data: any = null;
    let error: any = null;

    ({ data, error } = await supabaseServer.rpc('log_processor_call', payload));
    if (error?.code === '42883') {
      ({ data, error } = await supabaseServer.rpc('mcafee_log_call', payload));
    }

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
    const payload = {
      p_tag: tag,
      p_scope: rawScope ?? 'auto',
      p_notes: notes ?? null,
    };
    let data: any = null;
    let error: any = null;

    ({ data, error } = await supabaseServer.rpc('mark_processor_called', payload));
    if (error?.code === '42883') {
      ({ data, error } = await supabaseServer.rpc('mcafee_mark_called', payload));
    }

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

function diffHours(a: any, b: any) {
  const start = new Date(String(a || ''));
  const end = new Date(String(b || ''));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hours >= 0 ? hours : null;
}

function diffDays(a: any, b: any) {
  const hours = diffHours(a, b);
  return hours == null ? null : hours / 24;
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
    ownerRowsRes,
    recentIntakesRes,
    unpaidProcessingRes,
    unpaidSpecialtyRes,
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
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id,status,caping_status,webbs_status,specialty_status,picked_up_processing,picked_up_processing_at,picked_up_cape,picked_up_webbs,specialty_products,processing_started_at,processing_finished_at,price_processing,price_specialty,paid_processing,paid_specialty,amount_paid_processing,amount_paid_specialty')
        .limit(2000),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('paid_processing', false)
        .neq('status', 'Picked Up'),
      processor.id
    ),
    withProcessorFilter(
      supabaseServer
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('specialty_products', true)
        .eq('paid_specialty', false)
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
  const ownerRows = ownerRowsRes.data || [];
  if (calledQueueRes.error) {
    console.error('called queue dashboard error', calledQueueRes.error);
    throw calledQueueRes.error;
  }
  if (ownerRowsRes.error) {
    console.error('owner dashboard row error', ownerRowsRes.error);
    throw ownerRowsRes.error;
  }

  const calledQueue = calledRows.filter((r: any) => {
    const meatInQueue = isCalled(r.status) && !r.picked_up_processing;
    const capeInQueue = isCalled(r.caping_status) && !r.picked_up_cape;
    const webbsInQueue = isCalled(r.webbs_status) && !r.picked_up_webbs;
    return meatInQueue || capeInQueue || webbsInQueue;
  }).length;

  const readyForPickup = ownerRows.filter((r: any) => {
    const meatInQueue = meatReady(r.status) && !r.picked_up_processing;
    const capeInQueue = capeReady(r.caping_status) && !r.picked_up_cape;
    const webbsInQueue = webbsReady(r.webbs_status) && !r.picked_up_webbs;
    const specialtyInQueue = !!r.specialty_products && specialtyReady(r.specialty_status);
    return meatInQueue || capeInQueue || webbsInQueue || specialtyInQueue;
  }).length;

  const openProcessingAmount = ownerRows.reduce((sum: number, r: any) => {
    const price = Number(r.price_processing ?? 0) || 0;
    const paid = Number(r.amount_paid_processing ?? 0) || 0;
    return sum + Math.max(0, price - paid);
  }, 0);

  const openSpecialtyAmount = ownerRows.reduce((sum: number, r: any) => {
    if (!r.specialty_products) return sum;
    const price = Number(r.price_specialty ?? 0) || 0;
    const paid = Number(r.amount_paid_specialty ?? 0) || 0;
    return sum + Math.max(0, price - paid);
  }, 0);

  const readyUnpaidRows = ownerRows.filter((r: any) => {
    const meatReadyUnpaid = meatReady(r.status) && !r.picked_up_processing && !r.paid_processing;
    const specialtyReadyUnpaid = !!r.specialty_products && specialtyReady(r.specialty_status) && !r.paid_specialty;
    return meatReadyUnpaid || specialtyReadyUnpaid;
  });

  const readyUnpaidAmount = readyUnpaidRows.reduce((sum: number, r: any) => {
    const meatOwed = Math.max(0, (Number(r.price_processing ?? 0) || 0) - (Number(r.amount_paid_processing ?? 0) || 0));
    const specialtyOwed = !!r.specialty_products
      ? Math.max(0, (Number(r.price_specialty ?? 0) || 0) - (Number(r.amount_paid_specialty ?? 0) || 0))
      : 0;
    return sum + meatOwed + specialtyOwed;
  }, 0);

  const processingDurations = ownerRows
    .map((r: any) => diffHours(r.processing_started_at, r.processing_finished_at))
    .filter((v: number | null): v is number => typeof v === 'number');

  const readyAges = ownerRows
    .filter((r: any) => meatReady(r.status) && !r.picked_up_processing && r.processing_finished_at)
    .map((r: any) => diffDays(r.processing_finished_at, nowIso()))
    .filter((v: number | null): v is number => typeof v === 'number');

  const avgProcessingHours =
    processingDurations.length > 0
      ? processingDurations.reduce((sum, value) => sum + value, 0) / processingDurations.length
      : null;
  const avgReadyAgeDays =
    readyAges.length > 0
      ? readyAges.reduce((sum, value) => sum + value, 0) / readyAges.length
      : null;
  const oldestReadyDays = readyAges.length > 0 ? Math.max(...readyAges) : null;
  const readyHeld3d = readyAges.filter((value) => value >= 3).length;
  const readyHeld7d = readyAges.filter((value) => value >= 7).length;
  const readyHeld14d = readyAges.filter((value) => value >= 14).length;

  return {
    pendingTags: countOrThrow('pendingTags', pendingTagsRes),
    printQueue: countOrThrow('printQueue', printQueueRes),
    seasonEntries: countOrThrow('seasonEntries', seasonEntriesRes),
    todayDropoffs: countOrThrow('todayDropoffs', todayDropoffsRes),
    specialtyOpen: countOrThrow('specialtyOpen', specialtyOpenRes),
    calledQueue,
    readyForPickup,
    recentIntakes7d: countOrThrow('recentIntakes7d', recentIntakesRes),
    unpaidProcessing: countOrThrow('unpaidProcessing', unpaidProcessingRes),
    unpaidSpecialty: countOrThrow('unpaidSpecialty', unpaidSpecialtyRes),
    openProcessingAmount,
    openSpecialtyAmount,
    readyUnpaidCount: readyUnpaidRows.length,
    readyUnpaidAmount,
    avgProcessingHours,
    avgReadyAgeDays,
    oldestReadyDays,
    readyHeld3d,
    readyHeld7d,
    readyHeld14d,
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
