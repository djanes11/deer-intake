// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { specialtyPrice } from '@/lib/specialty';
import { getProcessorContextForHostname } from '@/lib/processorContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

const PUBLIC_STATUS_SELECT = `
  id,
  tag,
  confirmation,
  customer_name,
  status,
  caping_status,
  webbs_status,
  specialty_status,
  price_processing,
  price_specialty,
  price_total,
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
  dropoff_date
`;

function toDigits(s: unknown) {
  return String(s ?? '').replace(/\D+/g, '');
}

function lname(s?: string) {
  const t = String(s || '').trim();
  const parts = t.split(/\s+/);
  return parts.length ? parts[parts.length - 1].toLowerCase() : '';
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

function shapeJob(row: any, debug: boolean) {
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

  const base: any = {
    ok: true,
    customer: String(row.customer_name || ''),
    tag: String(row.tag || ''),
    confirmation: String(row.confirmation || ''),
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
  };

  return debug ? { ...base, _raw: row } : base;
}

async function handle(confirmation: string, tag: string, lastName: string, debug = false, hostname?: string | null) {
  const wantConf = toDigits(confirmation);
  const wantTag = String(tag || '').trim();
  const wantLN = lname(lastName);
  const confCandidates = wantConf
    ? Array.from(
        new Set([
          wantConf,
          wantConf.length > 6 ? `${wantConf.slice(0, 6)}-${wantConf.slice(6)}` : '',
        ].filter(Boolean))
      )
    : [];

  if (!wantConf && !(wantTag && wantLN)) {
    return { ok: false, error: 'Provide Confirmation # or Tag + Last Name.' };
  }

  const supabase = getSupabaseServer();
  const processor = await getProcessorContextForHostname(hostname);

  // 1) Confirmation match (strict) — best for overnight/untagged
  if (wantConf) {
    let query = supabase
      .from('jobs')
      .select(PUBLIC_STATUS_SELECT)
      .in('confirmation', confCandidates);

    if (processor.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query.order('dropoff_date', { ascending: false }).limit(5);

    if (error) return { ok: false, error: 'Server error' };

    const row = (data || [])[0];
    if (row) return shapeJob(row, debug);
    // fall through to tag+last name attempt if provided
  }

  // 2) Tag + last name (tag strict, last name checked in code)
  if (wantTag && wantLN) {
    let query = supabase
      .from('jobs')
      .select(PUBLIC_STATUS_SELECT)
      .eq('tag', wantTag);

    if (processor.id) query = query.eq('processor_id', processor.id);

    const { data, error } = await query.order('dropoff_date', { ascending: false }).limit(5);

    if (error) return { ok: false, error: 'Server error' };

    const hit = (data || []).find((r: any) => lname(r.customer_name) === wantLN);
    if (hit) return shapeJob(hit, debug);
  }

  return { ok: false, notFound: true, error: 'No match.' };
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '', debug = false } = await req.json();
    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const resp = await handle(confirmation, tag, lastName, !!debug, hostname);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const confirmation = searchParams.get('confirmation') || '';
    const tag = searchParams.get('tag') || '';
    const lastName = searchParams.get('lastName') || '';
    const debug = searchParams.get('debug') === '1';
    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const resp = await handle(confirmation, tag, lastName, debug, hostname);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}
