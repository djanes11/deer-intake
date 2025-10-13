import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}

// ── helpers ────────────────────────────────────────────────────────────────
function norm(s: any) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return norm(v);
  }
  return fallback;
}

// Canonicalize to the exact vocab you want
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

function toPublic(row: any) {
  const confirmation = g(row, ['Confirmation #','Confirmation','confirmation']);
  const tag          = g(row, ['Tag','tag']);
  const customer     = g(row, ['Customer','customer']);
  const primary      = g(row, ['Status','status'], 'Dropped Off');

  // Read exact columns first; include common alternates
  const rawWebbs     = g(row, ['Webbs Status','WebbsStatus','Euro Status','Skull Status','euroStatus','skullStatus']);
  const rawSpecialty = g(row, ['Specialty Status','Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  // Canonicalize
  const webbsCanon     = canonWebbs(rawWebbs);
  const specialtyCanon = canonSpecialty(rawSpecialty);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status: primary,
    tracks: {
      // show all so you can verify; remove if you want to hide “Dropped Off”
      webbsStatus: webbsCanon || null,
      specialtyStatus: specialtyCanon || null,
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

// ── handler ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tagParam     = String(body.tag || '').trim();
  const lastName     = String(body.lastName || '').trim().toLowerCase();

  const origin = new URL(req.url).origin;

  // 1) Exact TAG path (full job includes all fields)
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

  // 2) Confirmation path: find by search, then pull full job by Tag
  if (confirmation) {
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

    const match = rows.find((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation);
    if (!match) return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });

    // 🔑 pull the full job by Tag so we get Webbs/Specialty columns
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
    // fallback to match if job call fails
    return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type':'application/json' } });
  }

  return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
}
