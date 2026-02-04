// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, any>;

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
  const priceSpecialty = toNum(row.price_specialty);
  const priceTotal = toNum(row.price_total);

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

async function handle(confirmation: string, tag: string, lastName: string, debug = false) {
  const wantConf = toDigits(confirmation);
  const wantTag = String(tag || '').trim();
  const wantLN = lname(lastName);

  if (!wantConf && !(wantTag && wantLN)) {
    return { ok: false, error: 'Provide Confirmation # or Tag + Last Name.' };
  }

  const supabase = getSupabaseServer();

  // 1) Confirmation match (strict) — best for overnight/untagged
  if (wantConf) {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
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
        paid,
        paid_processing,
        paid_specialty
      `
      )
      .eq('confirmation', wantConf)
      .order('dropoff_date', { ascending: false })
      .limit(5);

    if (error) return { ok: false, error: 'Server error' };

    const row = (data || [])[0];
    if (row) return shapeJob(row, debug);
    // fall through to tag+last name attempt if provided
  }

  // 2) Tag + last name (tag strict, last name checked in code)
  if (wantTag && wantLN) {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
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
        paid,
        paid_processing,
        paid_specialty,
        dropoff_date
      `
      )
      .eq('tag', wantTag)
      .order('dropoff_date', { ascending: false })
      .limit(5);

    if (error) return { ok: false, error: 'Server error' };

    const hit = (data || []).find((r: any) => lname(r.customer_name) === wantLN);
    if (hit) return shapeJob(hit, debug);
  }

  return { ok: false, notFound: true, error: 'No match.' };
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '', debug = false } = await req.json();
    const resp = await handle(confirmation, tag, lastName, !!debug);
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
    const resp = await handle(confirmation, tag, lastName, debug);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}
