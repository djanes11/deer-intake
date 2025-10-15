// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GAS_BASE = process.env.GAS_BASE!;   // e.g., https://script.google.com/macros/s/XXXXX/exec
const GAS_TOKEN = process.env.GAS_TOKEN || '';

type AnyRec = Record<string, any>;

function get(obj: AnyRec, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return undefined;
}
function lname(s?: string) {
  const t = String(s || '').trim();
  if (!t) return '';
  const parts = t.split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
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

async function gasGET(action: string, q?: string) {
  if (!GAS_BASE) throw new Error('Missing GAS_BASE env');
  const url = new URL(GAS_BASE);
  url.searchParams.set('action', action);
  if (q) url.searchParams.set('q', q);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error(`Apps Script ${action} failed: ${r.status}`);
  return (await r.json()) as { ok?: boolean; rows?: AnyRec[]; error?: string };
}
async function gasPOST(body: AnyRec) {
  const r = await fetch(GAS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(GAS_TOKEN ? { ...body, token: GAS_TOKEN } : body),
  });
  if (!r.ok) throw new Error(`Apps Script POST failed: ${r.status}`);
  return (await r.json()) as { ok?: boolean; rows?: AnyRec[]; error?: string };
}

function pickBest(rows: AnyRec[], wantConf: string, wantTag: string, wantLN: string) {
  // 1) Exact confirmation # digits match
  if (wantConf) {
    const confKeys = ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation'];
    const hit = rows.find(row => String(get(row, confKeys) || '').replace(/\D/g,'') === wantConf);
    if (hit) return hit;
  }
  // 2) Tag + last name
  if (wantTag && wantLN) {
    const hit = rows.find(row => {
      const rowTag = get(row, ['Tag','Deer Tag','Tag #','Tag Number']);
      const cust = get(row, ['Customer Name','Customer','Name']);
      return String(rowTag || '').trim() === wantTag && lname(cust) === wantLN;
    });
    if (hit) return hit;
  }
  // 3) Single row fallback
  if (rows.length === 1) return rows[0];
  return undefined;
}

function shape(best: AnyRec) {
  const customer = get(best, ['Customer Name','Customer','Name']) || '';
  const tagVal   = get(best, ['Tag','Deer Tag','Tag #','Tag Number']) || '';
  const confVal  = get(best, ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation']) || '';
  const meat     = get(best, ['Status','Meat Status','Meat']) || '';

  const capeStatus       = get(best, ['Caping Status','Cape Status']);
  const webbsStatus      = get(best, ['Webbs Status','Webb Status']);
  const specialtyStatus  = get(best, ['Specialty Status','Speciality Status','Specialty Products Status']);

  const priceProcessing  = toNum(get(best, ['Processing Price','Processing Total']));
  const priceSpecialty   = toNum(get(best, ['Specialty Price','Specialty Total']));
  const priceTotal       = toNum(get(best, ['Price','Total']));

  const paidProcessing   = toBool(get(best, ['Paid Processing','Processing Paid']));
  const paidSpecialty    = toBool(get(best, ['Paid Specialty','Specialty Paid']));
  const paidOverall      = toBool(get(best, ['Paid','Paid Overall']));

  return {
    ok: true,
    customer,
    tag: tagVal,
    confirmation: confVal,
    status: meat,
    tracks: { capeStatus, webbsStatus, specialtyStatus },
    ...(priceProcessing !== undefined ? { priceProcessing } : {}),
    ...(priceSpecialty  !== undefined ? { priceSpecialty }  : {}),
    ...(priceTotal      !== undefined ? { priceTotal }      : {}),
    ...(paidProcessing  !== undefined ? { paidProcessing }  : {}),
    ...(paidSpecialty   !== undefined ? { paidSpecialty }   : {}),
    ...(paidOverall     !== undefined ? { paid: paidOverall } : {}),
  };
}

async function handleQuery(confirmation: string, tag: string, lastName: string) {
  const wantConf = String(confirmation || '').replace(/\D/g, '');
  const wantTag  = String(tag || '').trim();
  const wantLN   = lname(lastName);

  const q = [confirmation, tag, lastName].filter(Boolean).join(' ').trim();
  if (!q) return { ok: false, error: 'Provide Confirmation # or Tag + Last Name.' };

  // 1) try normal search (GET action=search&q=...)
  const s1 = await gasGET('search', q);
  if (!s1?.ok || !Array.isArray(s1.rows)) {
    return { ok: false, error: s1?.error || 'No results.' };
  }
  let best = pickBest(s1.rows, wantConf, wantTag, wantLN);

  // 2) fallback: include untagged pool via POST action=needsTag
  if (!best && wantConf) {
    const s2 = await gasPOST({ action: 'needsTag' });
    if (s2?.ok && Array.isArray(s2.rows)) {
      best = pickBest(s2.rows, wantConf, wantTag, wantLN);
    }
  }

  if (!best) return { ok: false, notFound: true, error: 'No match.' };
  return shape(best);
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '' } = await req.json();
    const resp = await handleQuery(confirmation, tag, lastName);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}

// Optional GET for easy debugging: /api/public-status?confirmation=...&tag=...&lastName=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const confirmation = searchParams.get('confirmation') || '';
    const tag = searchParams.get('tag') || '';
    const lastName = searchParams.get('lastName') || '';
    const resp = await handleQuery(confirmation, tag, lastName);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}