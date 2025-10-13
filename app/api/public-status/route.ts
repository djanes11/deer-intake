// app/api/public-status/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}

function g(row: any, names: string[], fallback = ''): string {
  for (const k of names) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}
function relevant(v?: string | null) {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return !!s && !['n/a','na','none','no','false','-','--'].includes(s);
}

function toPublic(row: any) {
  const confirmation = g(row, ['Confirmation #','Confirmation','confirmation']);
  const tag          = g(row, ['Tag','tag']);
  const customer     = g(row, ['Customer','customer']);
  const status       = g(row, ['Status','status'], 'Dropped Off');

  // exact columns you asked to surface:
  const webbsExact      = g(row, ['Webbs Status']);
  const specialtyExact  = g(row, ['Specialty Status']);

  // fallbacks/aliases if your sheet uses different headers in some rows
  const capeStatus      = g(row, ['Cape Status','Caping Status','Caped Status','CapeStatus','capingStatus']);
  const webbsStatus     = relevant(webbsExact) ? webbsExact
                        : g(row, ['Skull Status','Euro Status','WebbsStatus','euroStatus']);
  const specialtyStatus = relevant(specialtyExact) ? specialtyExact
                        : g(row, ['Specialty Products Status','SpecialtyStatus','specialtyStatus']);

  return {
    ok: true,
    confirmation,
    tag,
    customer: customer ? customer.replace(/(.).+\s+(.+)/, '$1*** $2') : '',
    status,
    tracks: {
      regularStatus: status,
      capeStatus: relevant(capeStatus) ? capeStatus : null,
      webbsStatus: relevant(webbsStatus) ? webbsStatus : null,
      specialtyStatus: relevant(specialtyStatus) ? specialtyStatus : null,
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

  // Exact tag path (fast)
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

  // Confirmation path: search broadly, then exact match by Confirmation #
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

  // de-dupe and choose exact confirmation
  const seen = new Set<string>();
  rows = rows.filter((row:any) => {
    const id = `${g(row,['Tag','tag'])}|${g(row,['Confirmation #','Confirmation','confirmation'])}`;
    if (seen.has(id)) return false; seen.add(id); return true;
  });

  const match = rows.find((row:any) => g(row, ['Confirmation #','Confirmation','confirmation']) === confirmation);
  if (!match) return notFound();

  return new Response(JSON.stringify(toPublic(match)), { headers:{ 'Content-Type':'application/json' } });
}
