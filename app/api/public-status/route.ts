// app/api/public-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GAS_BASE = process.env.GAS_BASE!;   // e.g. https://script.google.com/macros/s/XYZ/exec
const GAS_TOKEN = process.env.GAS_TOKEN || '';

type AnyRec = Record<string, any>;

function get(obj: AnyRec, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  return ['1','true','yes','y','paid','✓','✔','x'].includes(s) ? true : false;
}

function toNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function lname(s?: string) {
  const t = String(s || '').trim();
  const parts = t.split(/\s+/);
  return parts.length ? parts[parts.length - 1].toLowerCase() : '';
}

async function gasSearch(q: string) {
  if (!GAS_BASE) throw new Error('Missing GAS_BASE env');
  const url = new URL(GAS_BASE);
  url.searchParams.set('endpoint', 'search');
  url.searchParams.set('q', q);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`Apps Script error: ${r.status}`);
  return (await r.json()) as { ok?: boolean; rows?: AnyRec[]; error?: string };
}

function chooseBest(rows: AnyRec[], wantConf: string, wantTag: string, wantLN: string): AnyRec | undefined {
  // 1) prefer exact Confirmation # digits match
  if (wantConf) {
    const confKeys = ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation'];
    const best = rows.find((row) => {
      const got = String(get(row, confKeys) || '').replace(/\D/g, '');
      return got && got === wantConf;
    });
    if (best) return best;
  }
  // 2) else Tag + last name (lenient lname)
  if (wantTag && wantLN) {
    const best = rows.find((row) => {
      const rowTag = get(row, ['Tag','Deer Tag','Tag #','Tag Number']);
      const cust  = get(row, ['Customer','Customer Name','Name']);
      return String(rowTag || '').trim() === wantTag && lname(cust) === wantLN;
    });
    if (best) return best;
  }
  // 3) else single row fallback
  if (rows.length === 1) return rows[0];
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '' } = (await req.json()) as {
      confirmation?: string; tag?: string; lastName?: string;
    };

    const wantConf = String(confirmation || '').replace(/\D/g, '');
    const wantTag  = String(tag || '').trim();
    const wantLN   = lname(lastName);

    const q = [confirmation, tag, lastName].filter(Boolean).join(' ').trim();
    if (!q) {
      return NextResponse.json({ ok: false, error: 'Provide Confirmation # or Tag + Last Name.' });
    }

    // First, normal search
    const data1 = await gasSearch(q);
    if (!data1?.ok || !Array.isArray(data1.rows)) {
      return NextResponse.json({ ok: false, error: data1?.error || 'No results.' });
    }

    let best = chooseBest(data1.rows, wantConf, wantTag, wantLN);

    // If not found and we have a confirmation number, do a SECOND search against untagged list (@needsTag)
    if (!best && wantConf) {
      const data2 = await gasSearch('@needsTag');
      if (data2?.ok && Array.isArray(data2.rows)) {
        best = chooseBest(data2.rows, wantConf, wantTag, wantLN);
      }
    }

    if (!best) {
      return NextResponse.json({ ok: false, notFound: true, error: 'No match.' });
    }

    // Identity
    const customer = get(best, ['Customer','Customer Name','Name']) || '';
    const tagVal   = get(best, ['Tag','Deer Tag','Tag #','Tag Number']) || '';
    const confVal  = get(best, ['Confirmation #','Confirmation','Confirmation Number','Public Confirmation']) || '';

    // Statuses
    const meatStatus = get(best, ['Status','Overall Status','Meat Status']) || '';
    const capeStatus = get(best, ['Caping Status','Cape Status']);
    const webbsStatus = get(best, ['Webbs Status','Webb Status']);
    const specialtyStatus = get(best, ['Specialty Status','Speciality Status']);

    // Optional pricing / paid
    const priceProcessing = toNum(get(best, ['Processing Price','Processing Total','Price']));
    const priceSpecialty  = toNum(get(best, ['Specialty Price','Specialty Total']));
    const paidProcessing  = toBool(get(best, ['Paid Processing','Processing Paid']));
    const paidSpecialty   = toBool(get(best, ['Paid Specialty','Specialty Paid']));
    const paidOverall     = toBool(get(best, ['Paid','Paid Overall']));

    const resp = {
      ok: true,
      customer,
      tag: tagVal,
      confirmation: confVal,
      status: meatStatus,
      tracks: {
        capeStatus,
        webbsStatus,
        specialtyStatus,
      },
      ...(priceProcessing !== undefined ? { priceProcessing } : {}),
      ...(priceSpecialty !== undefined ? { priceSpecialty } : {}),
      ...(paidProcessing !== undefined ? { paidProcessing } : {}),
      ...(paidSpecialty !== undefined ? { paidSpecialty } : {}),
      ...(paidOverall !== undefined ? { paid: paidOverall } : {}),
    };

    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' });
  }
}