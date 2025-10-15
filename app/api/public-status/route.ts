// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GAS_BASE = process.env.GAS_BASE!;
const GAS_TOKEN = process.env.GAS_TOKEN || '';

type Row = Record<string, any>;
type SearchResp = { ok?: boolean; rows?: Row[]; error?: string };

function toDigits(s: unknown) { return String(s ?? '').replace(/\D+/g, ''); }
function lname(s?: string) {
  const t = String(s || '').trim(); const parts = t.split(/\s+/);
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
function coalesce(obj: Row, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
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
  if (wantConf) {
    const hit = rows.find((row) => toDigits(row.confirmation) === wantConf);
    if (hit) return hit;
  }
  if (wantTag && wantLN) {
    const hit = rows.find((row) => String(row.tag || '').trim() === wantTag && lname(row.customer) === wantLN);
    if (hit) return hit;
  }
  return rows.length === 1 ? rows[0] : undefined;
}

function shapeRow(row: Row) {
  // normalize specialty status aggressively
  let specialtyStatus = coalesce(row, [
    'specialtyStatus',
    'Specialty Status',
    'Speciality Status',
    'Specialty Products Status',
  ]);

  // if there's specialty product intent but no status text, surface something non-empty so UI renders
  const specialtyProducts = !!toBool(row.specialtyProducts);
  if (!specialtyStatus && specialtyProducts) specialtyStatus = 'Requested';

  const capeStatus  = coalesce(row, ['capingStatus','Cape Status','Caping Status']);
  const webbsStatus = coalesce(row, ['webbsStatus','Webbs Status','Webb Status']);

  const priceProcessing = toNum(row.priceProcessing);
  const priceSpecialty  = toNum(row.priceSpecialty);
  const priceTotal      = toNum(row.price);

  const paidOverall     = toBool(row.Paid ?? row.paid);
  const paidProcessing  = toBool(row.paidProcessing);
  const paidSpecialty   = toBool(row.paidSpecialty);

  return {
    ok: true,
    customer: String(row.customer || ''),
    tag: String(row.tag || ''),
    confirmation: String(row.confirmation || ''),
    status: String(row.status || ''),
    tracks: { capeStatus, webbsStatus, specialtyStatus },
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

  // 1) normal search
  const s1 = await gasGET('search', q);
  if (!s1?.ok || !Array.isArray(s1.rows)) return { ok: false, error: s1?.error || 'No results.' };
  let best = pickBest(s1.rows, wantConf, wantTag, wantLN);

  // 2) fallback for untagged via needsTag
  if (!best && wantConf) {
    const s2 = await gasPOST({ action: 'needsTag' });
    if (s2?.ok && Array.isArray(s2.rows)) best = pickBest(s2.rows, wantConf, wantTag, wantLN);
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