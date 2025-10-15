// app/api/public-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnyRec = Record<string, any>;

const GAS_BASE = process.env.GAS_BASE!;   // e.g., https://script.google.com/macros/s/XXXX/exec
const GAS_TOKEN = process.env.GAS_TOKEN || '';

const get = (o: AnyRec, keys: string[]) => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
};
const lname = (s?: string) => {
  const t = String(s || '').trim().split(/\s+/);
  return t.length ? t[t.length - 1].toLowerCase() : '';
};
const toNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const toBool = (v: unknown) => {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined as any;
  return ['1','true','yes','y','paid','✓','✔','x','on'].includes(s);
};

async function gasSearch(q: string) {
  if (!GAS_BASE) throw new Error('Missing GAS_BASE');
  const url = new URL(GAS_BASE);
  url.searchParams.set('action', 'search');              // <= IMPORTANT: your GAS uses action=search
  url.searchParams.set('q', q);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`Apps Script error: ${r.status}`);
  return (await r.json()) as { ok?: boolean; rows?: AnyRec[]; error?: string };
}

function pickBest(rows: AnyRec[], wantConf: string, wantTag: string, wantLN: string) {
  if (wantConf) {
    const keys = ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation'];
    const hit = rows.find(row => String(get(row, keys) || '').replace(/\D/g,'') === wantConf);
    if (hit) return hit;
  }
  if (wantTag && wantLN) {
    const hit = rows.find(row => {
      const rowTag = get(row, ['Tag','Deer Tag','Tag #','Tag Number']);
      const cust = get(row, ['Customer','Customer Name','Name']);
      return String(rowTag || '').trim() === wantTag && lname(cust) === wantLN;
    });
    if (hit) return hit;
  }
  return rows.length === 1 ? rows[0] : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const confirmation = String(body?.confirmation ?? '').trim();
    const tag = String(body?.tag ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();

    const wantConf = confirmation.replace(/\D/g, '');
    const wantTag  = tag;
    const wantLN   = lname(lastName);

    const q = [confirmation, tag, lastName].filter(Boolean).join(' ').trim();
    if (!q) return NextResponse.json({ ok: false, error: 'Provide Confirmation # or Tag + Last Name.' });

    // 1) Normal search
    const s1 = await gasSearch(q);
    if (!s1?.ok || !Array.isArray(s1.rows)) return NextResponse.json({ ok: false, error: s1?.error || 'No results.' });
    let best = pickBest(s1.rows, wantConf, wantTag, wantLN);

    // 2) If missing and confirmation provided, also search untagged pool via @needsTag
    if (!best && wantConf) {
      const s2 = await gasSearch('@needsTag');
      if (s2?.ok && Array.isArray(s2.rows)) best = pickBest(s2.rows, wantConf, wantTag, wantLN);
    }

    if (!best) return NextResponse.json({ ok: false, notFound: true, error: 'No match.' });

    const customer = get(best, ['Customer','Customer Name','Name']) || '';
    const tagVal   = get(best, ['Tag','Deer Tag','Tag #','Tag Number']) || '';
    const confVal  = get(best, ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation']) || '';
    const meat     = get(best, ['Status','Overall Status','Meat Status']) || '';

    const capeStatus       = get(best, ['Caping Status','Cape Status']);
    const webbsStatus      = get(best, ['Webbs Status','Webb Status']);
    const specialtyStatus  = get(best, ['Specialty Status','Speciality Status']);

    const priceProcessing  = toNum(get(best, ['Processing Price','Processing Total']));
    const priceSpecialty   = toNum(get(best, ['Specialty Price','Specialty Total']));
    const priceTotal       = toNum(get(best, ['Price','Total','Grand Total'])) ?? (
      (typeof priceProcessing === 'number' || typeof priceSpecialty === 'number')
        ? (priceProcessing || 0) + (priceSpecialty || 0)
        : undefined
    );

    const paidProcessing   = toBool(get(best, ['Paid Processing','Processing Paid']));
    const paidSpecialty    = toBool(get(best, ['Paid Specialty','Specialty Paid']));
    const paidOverall      = toBool(get(best, ['Paid','Paid Overall']));

    return NextResponse.json({
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
      ...(paidOverall     !== undefined ? { paid: paidOverall }: {}),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}

// Support GET passthrough ?confirmation=... or ?tag=...&lastName=...
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const confirmation = u.searchParams.get('confirmation') || '';
  const tag = u.searchParams.get('tag') || '';
  const lastName = u.searchParams.get('lastName') || '';
  return POST(new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({ confirmation, tag, lastName }),
    headers: { 'Content-Type': 'application/json' },
  } as any));
}
