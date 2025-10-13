// app/api/public-status/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

// ───────── helpers ─────────
function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}
function norm(s: any) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function hasCell(v: any) {
  const s = norm(v).toLowerCase();
  return !!s && !['n/a','na','none','--','-'].includes(s);
}
// exact getter for known header variants
function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return norm(v);
  }
  return fallback;
}
// Canonicalize to your vocab (keeps whatever the sheet implies)
function canonSpecialty(input?: string | null) {
  const s = norm(input).toLowerCase();
  if (!s) return '';
  if (/(in[_\s-]*progress)/.test(s))      return 'In Progress';
  if (/finished|ready/.test(s))           return 'Finished';
  if (/called|notified/.test(s))          return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))   return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))   return 'Dropped Off';
  return 'Dropped Off';
}
function canonWebbs(input?: string | null) {
  const s = norm(input).toLowerCase();
  if (!s) return '';
  if (/sent|shipped|outbound/.test(s))         return 'Sent';
  if (/delivered|received|at\s*webb/.test(s))  return 'Delivered';
  if (/called|notified/.test(s))               return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s))        return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s))        return 'Dropped Off';
  return 'Dropped Off';
}
function canonCape(input?: string | null) {
  const s = norm(input).toLowerCase();
  if (!s) return '';
  if (/(in[_\s-]*progress)/.test(s))    return 'In Progress';
  if (/finished|ready/.test(s))         return 'Finished';
  if (/called|notified/.test(s))        return 'Called';
  if (/picked[_\s-]*up|pickup/.test(s)) return 'Picked Up';
  if (/dropped[_\s-]*off|drop/.test(s)) return 'Dropped Off';
  return 'Dropped Off';
}

function toPublic(row: any) {
  const confirmation = g(row, ['Confirmation #','Confirmation','confirmation']);
  const tag          = g(row, ['Tag','tag']);
  const customer     = g(row, ['Customer','customer']);
  const primary      = g(row, ['Status','status'], 'Dropped Off');

  // read raw cells (add generous aliases)
  const rawCape      = g(row, ['Caping Status','Cape Status','Caped Status','CapeStatus','capingStatus']);
  const rawWebbs     = g(row, ['Webbs Status','Webb Status','WebbsStatus','Euro Status','Skull Status','euroStatus','skullStatus']);
  const rawSpecialty = g(row, ['Specialty Status','Speciality Status','Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status: primary,
    tracks: {
      // SHOW if the cell exists (non-blank) — including “Dropped Off”
      capeStatus:      hasCell(rawCape)      ? canonCape(rawCape)         : null,
      webbsStatus:     hasCell(rawWebbs)     ? canonWebbs(rawWebbs)       : null,
      specialtyStatus: hasCell(rawSpecialty) ? canonSpecialty(rawSpecialty) : null,
      regularStatus: primary,
    },
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };
}

// ───────── handler ─────────
export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tagParam     = String(body.tag || '').trim();
  const lastName     = String(body.lastName || '').trim().toLowerCase();

  const origin = new URL(req.url).origin;

  // Fast path: Tag + Last Name → 1 call, full job
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

  // Faster confirmation path: ONE search by confirmation → then ONE job by tag
  if (confirmation) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
      body: JSON.stringify({ action:'search', q: confirmation }),
    }).catch(() => null);

    if (!r?.ok) {
      return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
    }
    const data = await r.json().catch(()=> ({}));
    const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];

    const match = rows.find((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation);
    if (!match) {
      // No broad fallback to keep it snappy; tell them to try Tag+Last Name
      return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
    }

    // Pull full job by Tag so we get Webbs/Specialty/Cape columns
    const tag = g(match, ['Tag','tag']);
    if (tag) {
      const r2 = await fetch(`${origin}/api/gas2`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
        body: JSON.stringify({ action:'job', tag }),
      }).catch(() => null);
      const j2 = await r2?.json().catch(()=> ({}));
      const job = j2?.job;
      if (job) {
        return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type':'application/json' } });
      }
    }

    // Fallback: we’ll at least return what we saw on the search row
    return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type':'application/json' } });
  }

  return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
}

