// app/api/public-status/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}

// Safe getter that tolerates different column headers / casing
function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    if (row == null) break;
    const v = row[k] ?? row[k.toLowerCase?.()] ?? row[k.replace(/\s+/g, '')];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}

// Build the public-safe payload we’ll return
function toPublic(row: any) {
  const confirmation = g(row, ['Confirmation #','Confirmation','confirmation']);
  const tag          = g(row, ['Tag','tag']);
  const customer     = g(row, ['Customer','customer']);
  const status       = g(row, ['Status','status'], 'Dropped Off');

  // extra tracks (use whatever your sheet calls them; include generous aliases)
  const regularStatus   = status; // main status is the “regular/processing” status
  const capeStatus      = g(row, ['Cape Status','Caping Status','Caped Status','CapeStatus','capingStatus']);
  const webbsStatus     = g(row, ['Webbs Status','Skull Status','Euro Status','WebbsStatus','euroStatus']);
  const specialtyStatus = g(row, ['Specialty Status','Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status,
    tracks: {
      regularStatus,
      capeStatus: capeStatus || null,
      webbsStatus: webbsStatus || null,
      specialtyStatus: specialtyStatus || null,
    },
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };
}

function notFound() {
  return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tag        = String(body.tag || '').trim();
  const lastName   = String(body.lastName || '').trim().toLowerCase();
  if (!confirmation && !(tag && lastName)) {
    return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
  }

  const origin = new URL(req.url).origin;

  // 1) Exact TAG path first
  if (tag) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, cache:'no-store',
      body: JSON.stringify({ action:'job', tag }),
    }).catch(() => null);

    const j = await r?.json().catch(()=> ({}));
    const job = j?.job;
    if (job) {
      const ln = g(job, ['Customer','customer']).split(' ').slice(-1)[0]?.toLowerCase() || '';
      if (ln === lastName) return new Response(JSON.stringify(toPublic(job)), { headers:{ 'Content-Type':'application/json' } });
    }
    return notFound();
  }

  // 2) Confirmation path: query broadly, then filter by exact Confirmation #
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

  // de-dupe
  const seen = new Set<string>();
  rows = rows.filter((row:any) => {
    const id = `${g(row,['Tag','tag'])}|${g(row,['Confirmation #','Confirmation','confirmation'])}`;
    if (seen.has(id)) return false; seen.add(id); return true;
  });

  const match = rows.find((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation);
  if (!match) return notFound();

  return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type':'application/json' } });
}
