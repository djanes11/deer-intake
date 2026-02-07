// lib/jobsSupabase.ts
import { getSupabaseServer } from './supabaseClient';
import { Job, JobSearchRow } from '@/types/job';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

/* ---------------- helpers ---------------- */

const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/$/, '');

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

function buildIntakeEmail(opts: { name: string; tag: string; link: string }) {
  const name = opts.name || 'there';
  return {
    subject: `We received your deer (${opts.tag})`,
    html: [
      `<p>Hi ${escapeHtml(name)}</p>`,
      `<p>We received your deer (${escapeHtml(opts.tag)})</p>`,
      opts.link ? `<p><a href="${opts.link}" target="_blank" rel="noopener">Click here to view your intake form</a></p>` : '',
      `<p>If you need to make any updates or have questions, please contact Travis at <a href="tel:15026433916">(502) 643-3916</a></p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `We received your deer (${opts.tag})\n` +
      (opts.link ? `Click here to view your intake form: ${opts.link}\n` : '') +
      `If you need to make any updates or have questions, please contact Travis at (502) 643-3916\n`,
  };
}

/** Only send customer-facing emails once we have a real tag (prevents overnight/no-tag duplicates). */
function hasRealTag(row: any) {
  const t = String(row?.tag ?? '').trim();
  return !!t;
}

function buildFinishedEmail(opts: { name: string; tag: string; paidProcessing: boolean; processingPrice: number }) {
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
      `<p><b>Pickup hours:</b> 6:00 pm–8:00 pm Monday–Friday, 9:00 am–5:00 pm Saturday, 9:00 am-12:00pm Sunday.</p>`,
      `<p>Please contact Travis at <a href="tel:15026433916">(502) 643-3916</a> to confirm your pickup time or ask any questions. Also, check our Facebook for any temporary closures.</p>`,
      `<p>Please bring a cooler or box to transport your meat.</p>`,
      `<p><i>Reminder:</i> This update is for your regular processing only. We’ll reach out separately about any Webbs orders or McAfee Specialty Products.</p>`,
    ].join(''),
    text:
      `Hi ${name}\n` +
      `Your regular processing is finished and ready for pickup.\n\n` +
      (paid ? 'Regular processing: PAID' : `Amount still owed (regular processing): $${price.toFixed(2)}`) +
      `\n\nPickup hours: 6:00 pm–8:00 pm Monday–Friday, 9:00 am–5:00 pm Saturday, 9:00 am-12:00pm Sunday.\n` +
      `Please contact Travis at (502) 643-3916 to confirm your pickup time or ask any questions. Also, check our Facebook for any temporary closures.\n` +
      `Please bring a cooler or box to transport your meat.\n` +
      `Reminder: This update is for your regular processing only. We’ll reach out separately about any Webbs orders or McAfee Specialty Products.\n`,
  };
}

function statusIsFinishedLike(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return /finish|ready/.test(s);
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

function calcProcessingPrice(procType: any, beefFat: any, webbsOrder: any) {
  const p = normProc(procType);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    (p === 'Standard Processing' || p === 'Skull-Cap' || p === 'European') ? 130 :
    p === 'Donate' ? 0 : 0;

  if (!base) return 0;
  return base + (beefFat ? 5 : 0) + (webbsOrder ? 20 : 0);
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
  return `[${ts} • ${prefix}] ${notes}`;
}

/* ---------------- mapping ---------------- */

// Map DB row → Job (what your frontend expects)
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
    summerSausageLbs: Number(row.summer_sausage_lbs ?? 0),
    summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0),
    slicedJerkyLbs: Number(row.sliced_jerky_lbs ?? 0),

    notes: row.notes,

    // Webbs
    webbsOrder: !!row.webbs_order,
    webbsOrderFormNumber: row.webbs_order_form_number,
    webbsPounds: Number(row.webbs_pounds ?? 0),

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
    autoCallConsent: !!row.auto_call_consent,

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
    ...(row.specialty_products != null ? ({ specialtyProducts: !!row.specialty_products } as any) : {}),
    ...(row.summer_sausage_lbs != null ? ({ summerSausageLbs: Number(row.summer_sausage_lbs ?? 0) } as any) : {}),
    ...(row.summer_sausage_cheese_lbs != null
      ? ({ summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0) } as any)
      : {}),
    ...(row.sliced_jerky_lbs != null ? ({ slicedJerkyLbs: Number(row.sliced_jerky_lbs ?? 0) } as any) : {}),
    ...(row.picked_up_processing != null ? ({ pickedUpProcessing: !!row.picked_up_processing } as any) : {}),
    ...(row.picked_up_cape != null ? ({ pickedUpCape: !!row.picked_up_cape } as any) : {}),
    ...(row.picked_up_webbs != null ? ({ pickedUpWebbs: !!row.picked_up_webbs } as any) : {}),
  } as JobSearchRow;
}

/* ---------------- core reads ---------------- */

export async function getJobByTag(tag: string) {
  const supabaseServer = getSupabaseServer();

  const { data, error } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
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
  summer_sausage_lbs,
  summer_sausage_cheese_lbs,
  sliced_jerky_lbs,
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
  dropoff_date
`;

async function searchReport(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();

  // Pull a broad set of candidates, then filter in JS (simpler and more reliable than complex NOT-ILIKE ORs).
  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
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

  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or('status.eq.Called,caping_status.eq.Called,webbs_status.eq.Called')
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
  const q = query.trim();

  if (!q) return { ok: true, rows: [] };

  // --- special keywords used by your UI ---
  if (q.toLowerCase() === '@report') return searchReport();
  if (q.toLowerCase() === '@recall') return searchRecall();

  // Normal search (tag/confirmation/phone/customer)
  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or(
      [
        `tag.ilike.%${q}%`,
        `confirmation.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
      ].join(',')
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


function calcSpecialtyPriceFromLbs(job: Partial<Job>): number {
  // Matches the staff intake page preview pricing:
  // Summer sausage: $4.25/lb, SS+Cheddar: $4.60/lb, Jerky: $4.60/lb
  const ss = Number(numOrZero((job as any).summerSausageLbs ?? (job as any).summer_sausage_lbs));
  const ssc = Number(numOrZero((job as any).summerSausageCheeseLbs ?? (job as any).summer_sausage_cheese_lbs));
  const jer = Number(numOrZero((job as any).slicedJerkyLbs ?? (job as any).sliced_jerky_lbs));
  return ss * 4.25 + ssc * 4.60 + jer * 4.60;
}

export async function saveJob(job: Partial<Job>) {
  const supabaseServer = getSupabaseServer();

  const computedProcessingPrice = calcProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder);
  const computedSpecialtyPrice = calcSpecialtyPriceFromLbs(job);

  const processingOverride = numOrNull((job as any).processing_price_override ?? (job as any).processingPriceOverride);
  const specialtyOverride  = numOrNull((job as any).specialty_price_override  ?? (job as any).specialtyPriceOverride);

  const usedProcessingPrice = processingOverride ?? (numOrNull(job.priceProcessing) ?? computedProcessingPrice);
  const usedSpecialtyPrice  = specialtyOverride  ?? (numOrNull(job.priceSpecialty) ?? computedSpecialtyPrice);
  const usedTotalPrice      = numOrNull(job.price) ?? (usedProcessingPrice + usedSpecialtyPrice);

  // Tag handling:
// - Staff intake MUST provide a real tag.
// - Public/overnight can submit with no tag and `requiresTag=true`.
//   In that case, we store a unique placeholder tag so DB constraints + onConflict(tag) still work,
//   and staff can later assign the real tag.
const rawTag = String((job as any).tag ?? '').trim();
const requiresTag = (job as any).requiresTag === true;

const hasRealTag = (t: string) => t.length > 0 && !/^pending[-_]/i.test(t);
const makePendingTag = () => {
  const last5 = String((job as any).confirmation ?? '').replace(/\D/g, '').slice(-5);
  const rand = crypto.randomBytes(4).toString('hex'); // 8 hex chars
  const stamp = Date.now().toString(36);
  return `PENDING-${last5 || 'NA'}-${stamp}-${rand}`;
};

const tagToStore = hasRealTag(rawTag) ? rawTag : null;

// Confirmation is always expected on the overnight/public flow; keep it strict (13 digits).
const hasConfirmation13 = String((job as any).confirmation ?? '').replace(/\D/g, '').length === 13;

// Conflict target: keep it simple and always use the existing unique constraint on `tag`.
// For overnight/public rows, we store tag = null and requires_tag = true, so they insert cleanly and staff can fill the tag later.
const needsTag = asBool(job.requiresTag) || !hasRealTag(rawTag);
if (needsTag && !hasConfirmation13) {
  throw new Error('Confirmation must be 13 digits when Tag is missing (overnight).');
}
const conflictKey: 'tag' = 'tag';

const upsertPayload: any = {
  tag: tagToStore,
    confirmation: job.confirmation ?? null,
    customer_name: job.customer ?? null,
    phone: job.phone ?? null,
    email: job.email ?? null,
    address: job.address ?? null,
    city: job.city ?? null,
    state: job.state ?? null,
    zip: job.zip ?? null,

    county_killed: job.county ?? null,
    deer_sex: job.sex ?? null,
    process_type: job.processType ?? null,
    dropoff_date: job.dropoff ?? null,

    status: job.status ?? null,
    caping_status: job.capingStatus ?? null,
    webbs_status: job.webbsStatus ?? null,
    specialty_status: job.specialtyStatus ?? null,

    steak_size: job.steak ?? null,
    steak_size_other: job.steakOther ?? null,
    burger_size: job.burgerSize ?? null,
    steaks_per_package: job.steaksPerPackage ?? null,
    beef_fat: job.beefFat ?? false,

    hind_roast_count: intOrNull(job.hindRoastCount),
    front_roast_count: intOrNull(job.frontRoastCount),

    hind_steak: job.hind?.['Hind - Steak'] ?? false,
    hind_roast: job.hind?.['Hind - Roast'] ?? false,
    hind_grind: job.hind?.['Hind - Grind'] ?? false,
    hind_none: job.hind?.['Hind - None'] ?? false,

    front_steak: job.front?.['Front - Steak'] ?? false,
    front_roast: job.front?.['Front - Roast'] ?? false,
    front_grind: job.front?.['Front - Grind'] ?? false,
    front_none: job.front?.['Front - None'] ?? false,

    backstrap_prep: job.backstrapPrep ?? null,
    backstrap_thickness: job.backstrapThickness ?? null,
    backstrap_thickness_other: job.backstrapThicknessOther ?? null,

    specialty_products: job.specialtyProducts ?? false,
    specialty_pounds: numOrZero(job.specialtyPounds),
    summer_sausage_lbs: numOrZero(job.summerSausageLbs),
    summer_sausage_cheese_lbs: numOrZero(job.summerSausageCheeseLbs),
    sliced_jerky_lbs: numOrZero(job.slicedJerkyLbs),

    notes: job.notes ?? null,

    webbs_order: job.webbsOrder ?? false,
    webbs_order_form_number: job.webbsOrderFormNumber ?? null,
    webbs_pounds: numOrZero(job.webbsPounds),

    processing_price_override: processingOverride,
    specialty_price_override: specialtyOverride,

    price_processing: usedProcessingPrice,
    price_specialty: usedSpecialtyPrice,
    price_total: usedTotalPrice,

    paid: job.paid ?? false,
    paid_processing: job.paidProcessing ?? false,
    paid_specialty: job.paidSpecialty ?? false,
    requires_tag: job.requiresTag ?? false,

    public_token: job.publicToken ? String(job.publicToken) : undefined,
    public_link_sent_at: job.publicLinkSentAt ?? null,
    dropoff_email_sent_at: job.dropoffEmailSentAt ?? null,
    paid_processing_at: job.paidProcessingAt ?? null,
    paid_specialty_at: job.paidSpecialtyAt ?? null,

    picked_up_processing: job.pickedUpProcessing ?? false,
    picked_up_processing_at: job.pickedUpProcessingAt ?? null,
    picked_up_cape: job.pickedUpCape ?? false,
    picked_up_cape_at: job.pickedUpCapeAt ?? null,
    picked_up_webbs: job.pickedUpWebbs ?? false,
    picked_up_webbs_at: job.pickedUpWebbsAt ?? null,

    call_attempts: job.callAttempts ?? 0,
    meat_attempts: job.meatAttempts ?? 0,
    cape_attempts: job.capeAttempts ?? 0,
    webbs_attempts: job.webbsAttempts ?? 0,
    last_call_at: job.lastCallAt ?? null,
    last_called_by: job.lastCalledBy ?? null,
    last_call_outcome: job.lastCallOutcome ?? null,
    call_notes: job.callNotes ?? null,

    pref_email: job.prefEmail ?? false,
    pref_sms: job.prefSMS ?? false,
    pref_call: job.prefCall ?? false,
    sms_consent: job.smsConsent ?? false,
    auto_call_consent: job.autoCallConsent ?? false,

    how_killed: job.howKilled ?? null,
    updated_at: nowIso(),
  };


// Don't overwrite existing DB fields with undefined (e.g., keep public_token stable)
Object.keys(upsertPayload).forEach((k) => {
  if (upsertPayload[k] === undefined) delete upsertPayload[k];
});


  const { data, error } = await supabaseServer
    .from('jobs')
    .upsert(upsertPayload, {
      onConflict: 'tag',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('saveJob error', error);
    throw error;
  }


// ---- Emails (best-effort) ----
// Drop-off email: send on intake save if pref_email=true and not stamped.
try {
  if (data) {
    // Never send intake email for an overnight/no-tag record.
    if (!hasRealTag(data) || (data as any).requires_tag) {
      // skip
    } else {
    const wantsEmail = !!(data as any).pref_email;
    const email = String((data as any).email || '').trim();
    const alreadyStamped = !!(data as any).dropoff_email_sent_at;

    if (wantsEmail && email && !alreadyStamped) {
      const token = String((data as any).public_token || '').trim() || makePublicToken();

      // Atomic stamp-first (prevents double send)
      const { data: locked } = await supabaseServer
        .from('jobs')
        .update({ dropoff_email_sent_at: nowIso(), public_token: token })
        .eq('id', (data as any).id)
        .is('dropoff_email_sent_at', null)
        .select('tag, email, customer_name, public_token')
        .maybeSingle();

      if (locked) {
        const link = intakeFormLink(String((locked as any).tag), String((locked as any).public_token));
        const tpl = buildIntakeEmail({
          name: String((locked as any).customer_name || ''),
          tag: String((locked as any).tag || ''),
          link,
        });

        await sendEmail({
          to: String((locked as any).email),
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
      }
    }
    }
  }
} catch (e) {
  console.error('Intake email failed (non-fatal)', e);
}

// Finished email: if status is Finished/Ready-ish and not stamped (covers manual status changes + scan workflow)
try {
  if (data && hasRealTag(data) && !(data as any).requires_tag && statusIsFinishedLike((data as any).status)) {
    const wantsEmail = !!(data as any).pref_email;
    const email = String((data as any).email || '').trim();
    const alreadyStamped = !!(data as any).finished_email_sent_at;

    if (wantsEmail && email && !alreadyStamped) {
      const { data: locked } = await supabaseServer
        .from('jobs')
        .update({ finished_email_sent_at: nowIso() })
        .eq('id', (data as any).id)
        .is('finished_email_sent_at', null)
        .select('tag, email, customer_name, paid_processing, price_processing, process_type, beef_fat, webbs_order')
        .maybeSingle();

      if (locked) {
        const computed = calcProcessingPrice((locked as any).process_type, !!(locked as any).beef_fat, !!(locked as any).webbs_order);
        const price = Number((locked as any).price_processing ?? 0) || computed;

        const tpl = buildFinishedEmail({
          name: String((locked as any).customer_name || ''),
          tag: String((locked as any).tag || ''),
          paidProcessing: !!(locked as any).paid_processing,
          processingPrice: price,
        });

        await sendEmail({
          to: String((locked as any).email),
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });

        // backfill price_processing if it was missing/0
        if (!Number((locked as any).price_processing ?? 0) && computed) {
          await supabaseServer.from('jobs').update({ price_processing: computed }).eq('tag', String((locked as any).tag));
        }
      }
    }
  }
} catch (e) {
  console.error('Finished email failed (non-fatal)', e);
}


  return { ok: true, job: data ? mapDbRowToJob(data) : null };
}

/* ---------------- progress ---------------- */

// MAIN STATUS PROGRESSION + CAPE FLOW
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

  // initial/ dropped off -> Skinning -> Skinned -> Processing -> Finished
  if (isInitialStatus) {
    nextStatus = 'Skinning';
  } else if (curStatus === 'skinning') {
    nextStatus = 'Skinned';
  } else if (curStatus === 'skinned') {
    nextStatus = 'Processing';
  } else if (curStatus === 'processing') {
    nextStatus = 'Finished';
  } else {
    nextStatus = null;
  }

  // CAPE FLOW (buck + caped): Dropped Off -> Caping -> Caped
  const deerSex = String(job.deer_sex || '').trim().toLowerCase();
  const procType = String(job.process_type || '').trim().toLowerCase();
  const isBuck = deerSex.includes('buck');
  const isCaped = procType.includes('cape');

  const curCapingRaw = String(job.caping_status || '').trim();
  const curCaping = curCapingRaw.toLowerCase();

  let nextCaping: string | null = null;

  if (isBuck && isCaped) {
    if (isInitialStatus) {
      nextCaping = 'Caping';
    } else if (curCaping === 'caping') {
      nextCaping = 'Caped';
    }
  }

  const updates: any = {};
  if (nextStatus) updates.status = nextStatus;
  if (nextCaping) updates.caping_status = nextCaping;

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

  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or('tag.is.null,tag.eq.,requires_tag.eq.true')
    .order('dropoff_date', { ascending: false })
    .limit(200);

  if (error) {
    console.error('listJobsNeedingTag error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

/* ---------------- setTag ---------------- */

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

  // If we just assigned a real tag to an overnight/no-tag record, try to send the intake email now.
  // This keeps the rule: intake email sends at most once, and only after a real tag exists.
  if (updated && !stampDropEmail) {
    try {
      const wantsEmail = !!(updated as any).pref_email;
      const email = String((updated as any).email || '').trim();
      const alreadyStamped = !!(updated as any).dropoff_email_sent_at;

      if (hasRealTag(updated) && !(updated as any).requires_tag && wantsEmail && email && !alreadyStamped) {
        const token = String((updated as any).public_token || '').trim() || makePublicToken();

        const { data: locked } = await supabaseServer
          .from('jobs')
          .update({ dropoff_email_sent_at: nowIso(), public_token: token })
          .eq('id', (updated as any).id)
          .is('dropoff_email_sent_at', null)
          .select('tag, email, customer_name, public_token')
          .maybeSingle();

        if (locked) {
          const link = intakeFormLink(String((locked as any).tag), String((locked as any).public_token));
          const tpl = buildIntakeEmail({
            name: String((locked as any).customer_name || ''),
            tag: String((locked as any).tag || ''),
            link,
          });

          await sendEmail({
            to: String((locked as any).email),
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          });
        }
      }
    } catch (e) {
      console.error('Intake email after setTag failed (non-fatal)', e);
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