// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GAS_BASE = process.env.GAS_BASE!;   // https://script.google.com/macros/s/XXXX/exec
const GAS_TOKEN = process.env.GAS_TOKEN || '';

type Row = {
  // Keys as returned by GAS searchJobs_ (api.txt)
  row?: number;
  tag?: string;
  requiresTag?: boolean;
  confirmation?: string;
  customer?: string;
  phone?: string;
  dropoff?: string;
  status?: string;
  capingStatus?: string;       // NOTE: API uses "capingStatus" (with 'ing')
  webbsStatus?: string;
  specialtyStatus?: string;

  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  price?: number | string;

  Paid?: boolean | string;
  paidProcessing?: boolean | string;
  paidSpecialty?: boolean | string;
};

type SearchResp = { ok?: boolean; rows?: Row[]; error?: string };

function toDigits(s: unknown) {
  return String(s ?? '').replace(/\D+/g, '');
}
function lname(s?: string) {
  const t = String(s || '').trim();
  const parts = t.split(/\s+/);
  return parts.length ? parts[parts.length - 1].toLowerCase() : '';
}
function toNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function toBool(v: unknown): boolean | undefined {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  return ['1','true','yes','y','paid','✓','✔','x','on'].includes(s);
}

async function gasGET(action: string, q?: string): Promise<SearchResp> {
  const url = new URL(GAS_BASE);
  url.searchParams.set('action', action);
  if (q) url.searchParams.set('q', q);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error(`Apps Script ${action} failed: ${r.status}`);
  return (await r.json()) as SearchResp;
}
async function gasPOST(body: Record<string, unknown>): Promise<SearchResp> {
  const r = await fetch(GAS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(GAS_TOKEN ? { ...body, token: GAS_TOKEN } : body),
  });
  if (!r.ok) throw new Error(`Apps Script POST failed: ${r.status}`);
  return (await r.json()) as SearchResp;
}

function pickBest(rows: Row[], wantConf: string, wantTag: string, wantLN: string): Row | undefined {
  // 1) Exact confirmation match on digits
  if (wantConf) {
    const hit = rows.find((row) => toDigits(row.confirmation) === wantConf);
    if (hit) return hit;
  }
  // 2) Tag + last name
  if (wantTag && wantLN) {
    const hit = rows.find((row) => String(row.tag || '').trim() === wantTag && lname(row.customer) === wantLN);
    if (hit) return hit;
  }
  // 3) Single row fallback
  if (rows.length === 1) return rows[0];
  return undefined;
}

function shapeRow(row: Row) {
  const priceProcessing = toNum(row.priceProcessing);
  const priceSpecialty  = toNum(row.priceSpecialty);
  const priceTotal      = toNum(row.price);

  const paidOverall     = toBool(row.Paid);
  const paidProcessing  = toBool(row.paidProcessing);
  const paidSpecialty   = toBool(row.paidSpecialty);

  return {
    ok: true,
    customer: row.customer || '',
    tag: row.tag || '',
    confirmation: row.confirmation || '',
    status: row.status || '',
    tracks: {
      capeStatus: row.capingStatus || '',    // normalize name for UI
      webbsStatus: row.webbsStatus || '',
      specialtyStatus: row.specialtyStatus || '',
    },
    ...(priceProcessing !== undefined ? { priceProcessing } : {}),
    ...(priceSpecialty  !== undefined ? { priceSpecialty }  : {}),
    ...(priceTotal      !== undefined ? { priceTotal }      : {}),
    ...(paidProcessing  !== undefined ? { paidProcessing }  : {}),
    ...(paidSpecialty   !== undefined ? { paidSpecialty }   : {}),
    ...(paidOverall     !== undefined ? { paid: paidOverall } : {}),
  };
}

async function handle(confirmation: string, tag: string, lastName: string) {
  const wantConf = toDigits(confirmation);
  const wantTag  = String(tag || '').trim();
  const wantLN   = lname(lastName);
  const q = [confirmation, tag, lastName].filter(Boolean).join(' ').trim();
  if (!q) return { ok: false, error: 'Provide Confirmation # or Tag + Last Name.' };

  // 1) Try normal search
  const s1 = await gasGET('search', q);
  if (!s1?.ok || !Array.isArray(s1.rows)) return { ok: false, error: s1?.error || 'No results.' };
  let best = pickBest(s1.rows, wantConf, wantTag, wantLN);

  // 2) Fallback to untagged pool when searching by confirmation #
  if (!best && wantConf) {
    const s2 = await gasPOST({ action: 'needsTag' });
    if (s2?.ok && Array.isArray(s2.rows)) {
      best = pickBest(s2.rows, wantConf, wantTag, wantLN);
    }
  }

  if (!best) return { ok: false, notFound: true, error: 'No match.' };
  return shapeRow(best);
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '' } = await req.json();
    const resp = await handle(confirmation, tag, lastName);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}

// optional GET for debug: /api/public-status?confirmation=...&tag=...&lastName=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const confirmation = searchParams.get('confirmation') || '';
    const tag = searchParams.get('tag') || '';
    const lastName = searchParams.get('lastName') || '';
    const resp = await handle(confirmation, tag, lastName);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}