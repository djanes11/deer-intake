import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}

// ---- helpers ---------------------------------------------------------------
function norm(s: any) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
function isMeaningful(v?: string | null) {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return !!s && !['n/a','na','none','no','false','-','--'].includes(s);
}

// exact getter for known header variants
function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return norm(v);
  }
  return fallback;
}

// fuzzy getter: first key whose lowercase includes all tokens
function gFuzzy(row: any, tokenSets: string[][]): { value: string; key: string } | null {
  if (!row) return null;
  const entries = Object.entries(row);
  const lcEntries = entries.map(([k, v]) => [k.toLowerCase(), v] as const);
  for (const tokens of tokenSets) {
    const hit = lcEntries.find(([lk, v]) => tokens.every(t => lk.includes(t)) && String(v ?? '').trim() !== '');
    if (hit) {
      const originalKey = entries.find(([k]) => k.toLowerCase() === hit[0])?.[0] ?? hit[0];
      return { value: norm(hit[1]), key: originalKey };
    }
  }
  return null;
}

// canonicalizers for your two customer-facing tracks
function canonSpecialty(input?: string | null) {
  const s = norm(input).toLowerCase();
  if (!isMeaningful(s)) return '';
  if (/(in[_\s-]*progress)/.test(s))      return 'In Progress';
  if (/finished|ready/.test(s))           return 'Finished';
  if (/called|notified/.test(s))          return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))   return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))   return 'Dropped Off';
  return 'Dropped Off';
}
function canonWebbs(input?: string | null) {
  const s = norm(input).toLowerCase();
  if (!isMeaningful(s)) return '';
  if (/sent|shipped|outbound/.test(s))         return 'Sent';
  if (/delivered|received|at\s*webb/.test(s))  return 'Delivered';
  if (/called|notified/.test(s))               return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))        return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))        return 'Dropped Off';
  return 'Dropped Off';
}

function toPublic(row: any, debug = false) {
  const confirmation = g(row, ['Confirmation #','Confirmation','confirmation']) || gFuzzy(row, [['confirm']])?.value || '';
  const tag          = g(row, ['Tag','tag']) || gFuzzy(row, [['tag']])?.value || '';
  const customer     = g(row, ['Customer','customer']);
  const primary      = g(row, ['Status','status'], 'Dropped Off');

  // exact names first, plus common alternates; then canonicalize
  const rawWebbs     = g(row, ['Webbs Status','WebbsStatus','Euro Status','Skull Status','euroStatus','skullStatus'])
                    || gFuzzy(row, [['webb','status'], ['euro','status'], ['skull','status']])?.value || '';
  const rawSpecialty = g(row, ['Specialty Status','Specialty Products Status','SpecialtyStatus','specialtyStatus'])
                    || gFuzzy(row, [['special','status']])?.value || '';

  const webbsCanon     = canonWebbs(rawWebbs);
  const specialtyCanon = canonSpecialty(rawSpecialty);

  const payload: any = {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status: primary,
    tracks: {
      regularStatus: primary,
      // send only when meaningful & not just "Dropped Off"
      webbsStatus: webbsCanon && webbsCanon !== 'Dropped Off' ? webbsCanon : null,
      specialtyStatus: specialtyCanon && specialtyCanon !== 'Dropped Off' ? specialtyCanon : null,
    },
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };

  if (debug) {
    payload.__debug = {
      allKeysLower: Object.keys(row || {}).map(k => k.toLowerCase()).sort(),
      matched: {
        confirmation: confirmation,
        tag: tag,
        webbsRaw: rawWebbs,
        specialtyRaw: rawSpecialty,
        webbsCanon: webbsCanon,
        specialtyCanon: specialtyCanon,
      }
    };
  }

  return payload;
}

// ---- handler ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const rl = rateLimit(clientIp(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tag        = String(body.tag || '').trim();
  const lastName   = String(body.lastName || '').trim().toLowerCase();

  if (!confirmation && !(tag && lastName)) {
    return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
  }

  const origin = new URL(req.url).origin;

  // Exact TAG path
  if (tag) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
      body: JSON.stringify({ action:'job', tag }),
    }).catch(() => null);
    const j = await r?.json().catch(()=> ({}));
    const job = j?.job;
    if (job) {
      const ln = (g(job, ['Customer','customer']) || '').split(' ').slice(-1)[0]?.toLowerCase() || '';
      if (ln === lastName) {
        return new Response(JSON.stringify(toPublic(job, debug)), { headers:{ 'Content-Type':'application/json' } });
      }
    }
    return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
  }

  // Confirmation path: query broadly, then exact match
  const queries = [confirmation, '@report', '@needsTag', '@calls', '@all', ''];
  let rows: any[] = [];
  for (const q of queries) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
      body: JSON.stringify({ action:'search', q }),
    }).catch(() => null);
    if (!r?.ok) continue;
    const data = await r.json().catch(()=> ({}));
    const got = Array.isArray(data?.rows) ? data.rows : [];
    rows = rows.concat(got);
    if (got.some((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation)) break;
  }

  // de-dupe and select exact confirmation
  const seen = new Set<string>();
  rows = rows.filter((row:any) => {
    const id = `${g(row,['Tag','tag'])}|${g(row,['Confirmation #','Confirmation','confirmation'])}`;
    if (seen.has(id)) return false; seen.add(id); return true;
  });

  const match = rows.find((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation);
  if (!match) return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });

  return new Response(JSON.stringify(toPublic(match, debug)), { headers:{ 'Content-Type':'application/json' } });
}
