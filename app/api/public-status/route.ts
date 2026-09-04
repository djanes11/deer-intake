// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { specialtyPrice } from '@/lib/specialty';
import { getProcessorContextForHostname } from '@/lib/processorContext';
import { sharedRateLimit } from '@/lib/ratelimit';
import { confirmationSearchCandidates, identifierSettingsFromPublicCopy, normalizeConfirmationInput } from '@/lib/identifiers';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { ensurePublicToken } from '@/lib/jobsSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

function getIp(req: NextRequest): string {
  return (
    (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

const PUBLIC_STATUS_SELECT = `
  id,
  tag,
  confirmation,
  customer_name,
  phone,
  status,
  caping_status,
  webbs_status,
  specialty_status,
  price_processing,
  price_specialty,
  price_total,
  amount_paid_processing,
  amount_paid_specialty,
  specialty_price_override,
  specialty_products,
  original_summer_sausage_lbs,
  summer_sausage_lbs,
  summer_sausage_cheese_lbs,
  jalapeno_summer_sausage_cheese_lbs,
  sliced_jerky_lbs,
  original_snack_sticks_lbs,
  original_snack_sticks_cheese_lbs,
  jalapeno_snack_sticks_cheese_lbs,
  paid,
  paid_processing,
  paid_specialty,
  public_token,
  dropoff_date,
  updated_at
`;

function lname(s?: string) {
  const t = String(s || '').trim();
  const parts = t.split(/\s+/);
  return parts.length ? parts[parts.length - 1].toLowerCase() : '';
}

function phoneDigits(s?: string) {
  return String(s || '').replace(/\D+/g, '');
}

function cleanPublicToken(s?: string) {
  return String(s || '').trim();
}

function toNum(v: unknown): number | undefined {
  const n =
    typeof v === 'number'
      ? v
      : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  return ['1', 'true', 'yes', 'y', 'paid', '✓', '✔', 'x', 'on'].includes(s);
}

async function shapeJob(row: any, supabase: ReturnType<typeof getSupabaseServer>) {
  const priceProcessing = toNum(row.price_processing);
  const specialtyOverride = toNum(row.specialty_price_override);
  const computedSpecialty = specialtyPrice(row);
  const rawSpecialty = toNum(row.price_specialty);
  const priceSpecialty =
    specialtyOverride ??
    (typeof computedSpecialty === 'number' && computedSpecialty > 0
      ? Math.max(rawSpecialty ?? 0, computedSpecialty)
      : rawSpecialty);
  const rawTotal = toNum(row.price_total);
  const computedTotal =
    typeof priceProcessing === 'number' || typeof priceSpecialty === 'number'
      ? (priceProcessing || 0) + (priceSpecialty || 0)
      : undefined;
  const priceTotal =
    typeof computedTotal === 'number' && (rawTotal === undefined || rawTotal < computedTotal)
      ? computedTotal
      : rawTotal;

  const paidOverall = toBool(row.paid);
  const paidProcessing = toBool(row.paid_processing);
  const paidSpecialty = toBool(row.paid_specialty);
  const amountPaidProcessing = toNum(row.amount_paid_processing);
  const amountPaidSpecialty = toNum(row.amount_paid_specialty);
  const publicToken = await ensurePublicToken(supabase, row);

  const base: any = {
    ok: true,
    customer: String(row.customer_name || ''),
    tag: String(row.tag || ''),
    confirmation: String(row.confirmation || ''),
    dropoffDate: String(row.dropoff_date || ''),
    status: String(row.status || ''),
    tracks: {
      capeStatus: String(row.caping_status || ''),
      webbsStatus: String(row.webbs_status || ''),
      specialtyStatus: String(row.specialty_status || ''),
    },
    ...(priceProcessing !== undefined ? { priceProcessing } : {}),
    ...(priceSpecialty !== undefined ? { priceSpecialty } : {}),
    ...(priceTotal !== undefined ? { priceTotal } : {}),
    ...(paidProcessing !== undefined ? { paidProcessing } : {}),
    ...(paidSpecialty !== undefined ? { paidSpecialty } : {}),
    ...(paidOverall !== undefined ? { paid: paidOverall } : {}),
    ...(amountPaidProcessing !== undefined ? { amountPaidProcessing } : {}),
    ...(amountPaidSpecialty !== undefined ? { amountPaidSpecialty } : {}),
    ...(publicToken ? { intakeLink: `/intake/view/${encodeURIComponent(publicToken)}` } : {}),
    ...(row.updated_at ? { updatedAt: String(row.updated_at) } : {}),
  };

  return base;
}

async function handle(
  confirmation: string,
  tag: string,
  lastName: string,
  phone: string,
  hostname?: string | null,
  token?: string
) {
  const settings = await getPublicSiteSettings(hostname);
  const identifierSettings = identifierSettingsFromPublicCopy(settings.publicCopy);
  const wantToken = cleanPublicToken(token);
  const wantConf = normalizeConfirmationInput(confirmation, identifierSettings).trim();
  const wantTag = String(tag || '').trim();
  const wantLN = lname(lastName);
  const wantPhone = phoneDigits(phone);
  const safeLN = wantLN.replace(/[%_]/g, '');
  const confCandidates = confirmationSearchCandidates(wantConf, identifierSettings);

  if (!wantToken && !wantConf && !(wantTag && wantLN) && !(wantPhone.length === 10 && wantLN)) {
    return { ok: false, error: 'Provide Confirmation #, Tag + Last Name, or Phone + Last Name.' };
  }

  const supabase = getSupabaseServer();
  const processor = await getProcessorContextForHostname(hostname);

  // 0) Private token link from customer notifications. This opens one specific deer
  // without asking customers to retype a long confirmation number.
  if (wantToken) {
    let query = supabase
      .from('jobs')
      .select(PUBLIC_STATUS_SELECT)
      .eq('public_token', wantToken);

    if (processor.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query.limit(1);
    if (error) return { ok: false, error: 'Server error' };

    const row = (data || [])[0];
    if (row) return shapeJob(row, supabase);
    return { ok: false, notFound: true, error: 'No match.' };
  }

  // 1) Confirmation match (strict) — best for overnight/untagged
  if (wantConf) {
    let query = supabase
      .from('jobs')
      .select(PUBLIC_STATUS_SELECT)
      .in('confirmation', confCandidates);

    if (processor.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query.order('dropoff_date', { ascending: false }).limit(1);

    if (error) return { ok: false, error: 'Server error' };

    const row = (data || [])[0];
    if (row) return shapeJob(row, supabase);
    // fall through to tag+last name attempt if provided
  }

  // 2) Tag + last name (tag strict, last name checked in code)
  if (wantTag && wantLN) {
    let query = supabase
      .from('jobs')
      .select(PUBLIC_STATUS_SELECT)
      .eq('tag', wantTag);

    if (processor.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query.order('dropoff_date', { ascending: false }).limit(1);

    if (error) return { ok: false, error: 'Server error' };

    const hit = (data || []).find((r: any) => lname(r.customer_name) === wantLN);
    if (hit) return shapeJob(hit, supabase);
  }

  // 3) Phone + last name. This is for customers who chose phone calls and may not have
  // the long confirmation number or final tag handy. If more than one deer matches,
  // return the possible matches so the customer can choose the right one instead of
  // guessing by newest drop-off.
  if (wantPhone.length === 10 && safeLN) {
    const findMatches = async (phoneScoped: boolean) => {
      let query = supabase
        .from('jobs')
        .select(PUBLIC_STATUS_SELECT)
        .ilike('customer_name', `%${safeLN}%`);

      if (phoneScoped) query = query.eq('phone', wantPhone);
      if (processor.id) query = query.eq('processor_id', processor.id);

      const { data, error } = await query.order('dropoff_date', { ascending: false }).limit(phoneScoped ? 25 : 50);
      if (error) throw error;

      return (data || []).filter((r: any) => phoneDigits(r.phone) === wantPhone && lname(r.customer_name) === wantLN);
    };

    let hits: any[] = [];
    try {
      hits = await findMatches(true);
      if (!hits.length) {
        // Older staff-entered rows may have formatted phone numbers, so keep the original
        // broader lookup as a fallback while making normal public-intake lookups indexed.
        hits = await findMatches(false);
      }
    } catch {
      return { ok: false, error: 'Server error' };
    }

    if (hits.length === 1) return shapeJob(hits[0], supabase);
    if (hits.length > 1) {
      return {
        ok: true,
        matches: await Promise.all(hits.map((row: any) => shapeJob(row, supabase))),
      };
    }
  }

  return { ok: false, notFound: true, error: 'No match.' };
}

export async function POST(req: NextRequest) {
  try {
    const rl = await sharedRateLimit(getIp(req), 'public-status', 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }
    const { confirmation = '', tag = '', lastName = '', phone = '', token = '' } = await req.json();
    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const resp = await handle(confirmation, tag, lastName, phone, hostname, token);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}

export async function GET(req: NextRequest) {
  try {
    const rl = await sharedRateLimit(getIp(req), 'public-status', 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }
    const { searchParams } = new URL(req.url);
    const confirmation = searchParams.get('confirmation') || '';
    const tag = searchParams.get('tag') || '';
    const lastName = searchParams.get('lastName') || '';
    const phone = searchParams.get('phone') || '';
    const token = searchParams.get('token') || '';
    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const resp = await handle(confirmation, tag, lastName, phone, hostname, token);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}
