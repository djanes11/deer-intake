import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

/* ───────────── helpers ───────────── */

function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}
function norm(s: any) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function hasCell(v: any) {
  const s = norm(v).toLowerCase();
  return !!s && !['n/a','na','none','--','-','null','undefined'].includes(s);
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

// normalize confirmations for comparison: strip non-alphanum, uppercase
function nconf(v: string) { return norm(v).replace(/[^a-z0-9]/gi, '').toUpperCase(); }

function findConfirmation(row: any): { key: string; value: string } | null {
  // try exact common names
  const exact = ['Confirmation #','Confirmation','confirmation','Confirm #','Confirm#','Confirmation#']
    .map(k => ({ key: k, value: row?.[k] }))
    .find(x => hasCell(x.value));
  if (exact) return { key: exact.key, value: norm(exact.value) };

  // fallback fuzzy: includes "confirm"
  return gFuzzy(row, [['confirm']]);
}

/* Canonicalizers (keep your vocab) */
function canonSpecialty(input?: string | null) {
  const s = norm(input).toLowerCase(); if (!s) return '';
  if (/(in[_\s-]*progress)/.test(s))      return 'In Progress';
  if (/finished|ready/.test(s))           return 'Finished';
  if (/called|notified/.test(s))          return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))   return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))   return 'Dropped Off';
  return 'Dropped Off';
}
function canonWebbs(input?: string | null) {
  const s = norm(input).toLowerCase(); if (!s) return '';
  if (/sent|shipped|outbound/.test(s))         return 'Sent';
  if (/delivered|received|at\s*webb/.test(s))  return 'Delivered';
  if (/called|notified/.test(s))               return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))        return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))        return 'Dropped Off';
  return 'Dropped Off';
}
function canonCape(input?: string | null) {
  const s = norm(input).toLowerCase(); if (!s) return '';
  if (/(in[_\s-]*progress)/.test(s))    return 'In Progress';
  if (/finished|ready/.test(s))         return 'Finished';
  if (/called|notified/.test(s))        return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s)) return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s)) return 'Dropped Off';
  return 'Dropped Off';
}

function toPublic(row: any) {
  // Identifiers
  const confHit = findConfirmation(row);
  const confirmation = confHit?.value || '';
  const tag          = g(row, ['Tag','tag']) || gFuzzy(row, [['tag']])?.value || '';
  const customer     = g(row, ['Customer','customer']) || '';
  const primary      = g(row, ['Status','status'], 'Dropped Off');

  // Raw cells with generous aliases
  const rawCape      = g(row, ['Caping Status','Cape Status','Caped Status','CapeStatus','capingStatus']);
  const rawWebbs     = g(row, ['Webbs Status','Webb Status','WebbsStatus','Euro Status','Skull Status','euroStatus','skullStatus']);
  const rawSpecialty = g(row, ['Specialty Status','Speciality Status','Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status: primary, // primary/processing
    tracks: {
      regularStatus: primary,
      // SHOW if the sheet cell exists (non-blank). Hide only when truly blank/N/A.
      capeStatus:      hasCell(rawCape)      ? canonCape(rawCape)           : null,
      webbsStatus:     hasCell(rawWebbs)     ? canonWebbs(rawWebbs)         : null,
      specialtyStatus: hasCell(rawSpecialty) ? canonSpecialty(rawSpecialty) : null,
    },
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };
}

/* ───────────── handler ───────────── */

export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tagParam     = String(body.tag || '').trim();
  const lastName     = String(body.lastName || '').trim().toLowerCase();
  const origin = new URL(req.url).origin;

  /* 1) Fast path: Tag + Last Name → 1 call (full job) */
  if (tagParam && lastName) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
      body: JSON.stringify({ action:'job', tag: tagParam }),
    }).catch(() => null);
    const j = await r?.json().catch(()=> ({}));
    const job = j?.job;
    if (job) {
      const ln = (g(job, ['Customer','customer']) || '').split(' ').slice(-1)[0]?.toLowerCase() || '';
      if (ln === lastName) {
        return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type':'application/json' } });
      }
    }
    return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
  }

  /* 2) Confirmation path: at most TWO calls (search → job) */

  if (confirmation) {
    // First try: search with the string as-is
    let rows: any[] = [];
    {
      const r = await fetch(`${origin}/api/gas2`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
        body: JSON.stringify({ action:'search', q: confirmation }),
      }).catch(() => null);
      if (r?.ok) {
        const data = await r.json().catch(()=> ({}));
        if (Array.isArray(data?.rows)) rows = data.rows;
      }
    }

    // If not matched, do a single broad '@all' and match locally (still only 1 more call)
    let match = rows.find((row:any) => {
      const hit = findConfirmation(row);
      return !!hit && nconf(hit.value) === nconf(confirmation);
    });

    if (!match) {
      const r2 = await fetch(`${origin}/api/gas2`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
        body: JSON.stringify({ action:'search', q: '@all' }),
      }).catch(() => null);
      if (r2?.ok) {
        const data2 = await r2.json().catch(()=> ({}));
        const rows2: any[] = Array.isArray(data2?.rows) ? data2.rows : [];
        match = rows2.find((row:any) => {
          const hit = findConfirmation(row);
          return !!hit && nconf(hit.value) === nconf(confirmation);
        }) || null;
      }
    }

    if (!match) return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });

    // Pull full job by Tag so we get all columns
    const tag = g(match, ['Tag','tag']) || gFuzzy(match, [['tag']])?.value || '';
    if (tag) {
      const r3 = await fetch(`${origin}/api/gas2`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
        body: JSON.stringify({ action:'job', tag }),
      }).catch(() => null);
      const j3 = await r3?.json().catch(()=> ({}));
      const job = j3?.job;
      if (job) {
        return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type':'application/json' } });
      }
    }

    // Fallback: at least return what we saw on the search row
    return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type':'application/json' } });
  }

  return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
}
