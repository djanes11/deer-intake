// app/api/public-status/route.ts
import { NextResponse } from 'next/server';

// Force server-side and no caching for fresh status lookups
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchRow = {
  tag?: string;
  confirmation?: string;
  customer?: string;
  phone?: string;

  status?: string;           // Meat / overall
  capingStatus?: string;     // Cape
  webbsStatus?: string;      // Webbs
  specialtyStatus?: string;  // Specialty

  // pricing (may arrive as numbers or $-formatted strings)
  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  priceTotal?: number | string;

  // paid flags
  Paid?: boolean | string;
  paid?: boolean | string;
  paidProcessing?: boolean | string;
  paidSpecialty?: boolean | string;
  specialtyProducts?: boolean | string;
};

type LookupBody = {
  confirmation?: string;
  tag?: string;
  lastName?: string;
};

function env(name: string, fallback?: string) {
  return process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`] ?? fallback;
}

const API_URL = env('DEER_API_URL', '');
const API_TOKEN = env('DEER_API_TOKEN', '');

function digits(s?: string) {
  return String(s ?? '').replace(/\D+/g, '');
}
function norm(s?: string) {
  return String(s ?? '').trim().toLowerCase();
}
function toNum(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function truthy(v: unknown) {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1','true','yes','y','paid','✓','✔','x','on'].includes(s);
}

function buildPublicResult(job: SearchRow) {
  const customer = job?.customer ?? '';
  const tag = job?.tag ?? '';
  const confirmation = job?.confirmation ?? '';

  const status = job?.status ?? '';
  const capeStatus = job?.capingStatus ?? '';
  const webbsStatus = job?.webbsStatus ?? '';
  const specialtyStatus = job?.specialtyStatus ?? '';

  const priceProcessing = toNum(job?.priceProcessing);
  const priceSpecialty  = toNum(job?.priceSpecialty);
  const priceTotal      = toNum(job?.priceTotal);

  const paidProcessing = truthy(job?.paidProcessing);
  const paidSpecialty  = truthy(job?.paidSpecialty);
  // if Specialty not ordered, processing-paid alone implies paid-in-full
  const paid =
    truthy(job?.paid) ||
    truthy(job?.Paid) ||
    (paidProcessing && (!truthy(job?.specialtyProducts) || paidSpecialty));

  return {
    ok: true,
    customer,
    tag,
    confirmation,
    status,
    tracks: {
      capeStatus,
      webbsStatus,
      specialtyStatus,
    },
    priceProcessing,
    priceSpecialty,
    priceTotal,
    paidProcessing,
    paidSpecialty,
    paid,
  };
}

async function searchAPI(q: string) {
  if (!API_URL) {
    return { ok: false, error: 'Missing DEER_API_URL environment variable.' };
  }
  const url = new URL(API_URL);
  url.searchParams.set('action', 'search');
  url.searchParams.set('q', q);
  if (API_TOKEN) url.searchParams.set('token', API_TOKEN);

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // Avoid edge/proxy caches along the path
    cache: 'no-store',
  });

  if (!r.ok) {
    return { ok: false, error: `Upstream ${r.status} ${r.statusText}` };
  }
  const j = await r.json().catch(() => null);
  return j || { ok: false, error: 'Invalid JSON from upstream' };
}

function pickBestMatch(rows: SearchRow[], wanted: { conf?: string; tag?: string; last?: string }) {
  const confD = digits(wanted.conf);
  const tagS = norm(wanted.tag);
  const last = norm(wanted.last);

  // 1) exact Confirmation match (digits-only)
  if (confD) {
    const exact = rows.find(r => digits(r.confirmation) === confD);
    if (exact) return exact;
  }

  // 2) tag + last name contains (last name only needs to appear within full name)
  if (tagS && last) {
    const hit = rows.find(r => norm(r.tag) === tagS && norm(r.customer).includes(last));
    if (hit) return hit;
  }

  // 3) plain tag match
  if (tagS) {
    const byTag = rows.find(r => norm(r.tag) === tagS);
    if (byTag) return byTag;
  }

  // 4) fallback: first row
  return rows[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as LookupBody;
    const confirmation = String(body.confirmation ?? '').trim();
    const tag = String(body.tag ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();

    if (!confirmation && !tag && !lastName) {
      return NextResponse.json({ ok: false, error: 'Provide a Confirmation #, or Tag + Last Name.' }, { status: 400 });
    }

    // Build a simple search string; the Apps Script search scans across fields.
    // If we have a confirmation, searching by that is the most precise.
    const q = confirmation || [tag, lastName].filter(Boolean).join(' ');
    const upstream = await searchAPI(q);

    if (!upstream?.ok) {
      return NextResponse.json({ ok: false, error: upstream?.error || 'Lookup failed.' }, { status: 502 });
    }

    const rows = Array.isArray(upstream.rows) ? (upstream.rows as SearchRow[]) : [];
    if (!rows.length) {
      return NextResponse.json({ ok: false, notFound: true, error: 'No match.' }, { status: 404 });
    }

    const best = pickBestMatch(rows, { conf: confirmation, tag, last: lastName });
    if (!best) {
      return NextResponse.json({ ok: false, notFound: true, error: 'No match.' }, { status: 404 });
    }

    return NextResponse.json(buildPublicResult(best));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
