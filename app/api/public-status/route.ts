// app/api/public-status/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

/* ────────── helpers ────────── */
function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || '0.0.0.0';
}
function norm(s: any) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function hasCell(v: any) {
  const s = norm(v).toLowerCase();
  return !!s && !['n/a','na','none','--','-','null','undefined'].includes(s);
}
function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return norm(v);
  }
  return fallback;
}
function gFuzzy(row: any, tokenSets: string[][]): { key: string; value: string } | null {
  if (!row) return null;
  const entries = Object.entries(row);
  const lc = entries.map(([k, v]) => [k.toLowerCase(), v] as const);
  for (const tokens of tokenSets) {
    const hit = lc.find(([lk, v]) =>
      tokens.every(t => lk.includes(t)) && String(v ?? '').trim() !== ''
    );
    if (hit) {
      const origKey = entries.find(([k]) => k.toLowerCase() === hit[0])?.[0] ?? hit[0];
      return { key: origKey, value: norm(hit[1]) };
    }
  }
  return null;
}
function nconf(v: string) { return norm(v).replace(/[^a-z0-9]/gi, '').toUpperCase(); }

/** Extract a robust last-name fingerprint from "Customer" */
function lastNameKey(customer: string) {
  let c = norm(customer);
  // Handle "Last, First ..." by taking the part before the comma as last
  if (c.includes(',')) c = c.split(',')[0];
  // Drop common suffixes
  c = c.replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, '').trim();
  // Take last token that has letters
  const tokens = c.split(/\s+/).filter(Boolean);
  let last = tokens.length ? tokens[tokens.length - 1] : '';
  // If that “last” is short or punctuation-y, try previous
  if (!/[a-z]/i.test(last) && tokens.length > 1) last = tokens[tokens.length - 2];
  return last.toLowerCase().replace(/[^a-z]/g, '');
}
function matchesLastName(job: any, inputLast: string) {
  const cust = g(job, ['Customer','customer']);
  if (!cust || !inputLast) return false;
  const a = lastNameKey(cust);
  const b = inputLast.toLowerCase().replace(/[^a-z]/g, '');
  if (!a || !b) return false;
  // accept equality or startsWith (handles double-barreled names)
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function findConfirmationField(row: any): { key: string; value: string } | null {
  const exacts = [
    'Confirmation #','Confirmation','confirmation','Confirm #','Confirm#','Confirmation#',
    'Conf #','Conf#','Confirmation Num','Confirmation Number','Conf Number'
  ];
  for (const k of exacts) {
    const v = row?.[k];
    if (hasCell(v)) return { key: k, value: norm(v) };
  }
  return gFuzzy(row, [['confirm']]) || gFuzzy(row, [['conf']]);
}

function toPublic(row: any) {
  const confHit = findConfirmationField(row);
  const confirmation = confHit?.value || '';
  const tag          = g(row, ['Tag','tag']) || gFuzzy(row, [['tag']])?.value || '';
  const customer     = g(row, ['Customer','customer']) || '';
  const regular      = g(row, ['Status','status'], 'Dropped Off');

  // raw track cells (show exactly what’s in the sheet if non-blank)
  const rawCape      = g(row, ['Caping Status','Cape Status','Caped Status','CapeStatus','capingStatus']);
  const rawWebbs     = g(row, ['Webbs Status','Webb Status','WebbsStatus','Euro Status','Skull Status','euroStatus','skullStatus']);
  const rawSpecialty = g(row, ['Specialty Status','Speciality Status','Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status: regular,
    tracks: {
      regularStatus: regular,
      capeStatus:      hasCell(rawCape)      ? norm(rawCape)      : null,
      webbsStatus:     hasCell(rawWebbs)     ? norm(rawWebbs)     : null,
      specialtyStatus: hasCell(rawSpecialty) ? norm(rawSpecialty) : null,
    },
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };
}

/* GAS proxy with timeout */
async function gas(origin: string, body: any, timeoutMs = 3500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${origin}/api/gas2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ────────── handler ────────── */
export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = norm(body.confirmation || '');
  const tagParam     = norm(body.tag || '');
  const lastName     = norm(body.lastName || '').toLowerCase();
  const origin = new URL(req.url).origin;

  /* 1) Tag + Last Name: single /job call; tolerant last-name match */
  if (tagParam && lastName) {
    const j = await gas(origin, { action: 'job', tag: tagParam });
    const job = j?.job;
    if (job && matchesLastName(job, lastName)) {
      return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
  }

  /* 2) Confirmation path: ≤2 calls (search → job), with one broad fallback */
  if (confirmation) {
    let rows: any[] = [];
    const first = await gas(origin, { action: 'search', q: confirmation });
    if (Array.isArray(first?.rows)) rows = first.rows;

    const want = nconf(confirmation);
    let match = rows.find((row:any) => {
      const hit = findConfirmationField(row);
      return !!hit && nconf(hit.value) === want;
    });

    if (!match) {
      const all = await gas(origin, { action: 'search', q: '@all' });
      const rows2: any[] = Array.isArray(all?.rows) ? all.rows : [];
      match = rows2.find((row:any) => {
        const hit = findConfirmationField(row);
        return !!hit && nconf(hit.value) === want;
      }) || null;
    }

    if (!match) return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });

    // Pull full job by Tag to get all columns
    const tag = g(match, ['Tag','tag']) || gFuzzy(match, [['tag']])?.value || '';
    if (tag) {
      const j2 = await gas(origin, { action: 'job', tag });
      const job = j2?.job;
      if (job) {
        return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type': 'application/json' } });
      }
    }
    // Fallback to the search row if /job fails
    return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
}

