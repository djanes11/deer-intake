// app/api/public-status/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function ip(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '0.0.0.0';
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(ip(req), 'public-status', 30, 60_000);
  if (!rl.allowed) return new Response(JSON.stringify({ ok:false, error:'Rate limited' }), { status:429 });

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tag = String(body.tag || '').trim();
  const lastName = String(body.lastName || '').trim().toLowerCase();
  if (!confirmation && !(tag && lastName)) {
    return new Response(JSON.stringify({ ok:false, error:'Provide Confirmation # OR (Tag + Last Name).' }), { status:400 });
  }

  const origin = new URL(req.url).origin;

  // Fast path: exact tag lookup
  if (tag) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      cache:'no-store',
      body: JSON.stringify({ action:'job', tag }),
    });
    const j = await r.json().catch(()=> ({}));
    const job = j?.job;
    if (job) {
      const ln = String((job['Customer'] || job.customer || '')).trim().split(' ').slice(-1)[0].toLowerCase();
      if (ln === lastName) return ok(job);
    }
    return notFound();
  }

  // Confirmation fallback: do a broad search, then filter by exact Confirmation #
  // Try a focused search first
  let rows: any[] = [];
  for (const qtry of [confirmation, '@report', '@needsTag', '@all']) {
    const r = await fetch(`${origin}/api/gas2`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      cache:'no-store',
      body: JSON.stringify({ action:'search', q: qtry }),
    });
    if (!r.ok) continue;
    const data = await r.json().catch(()=> ({}));
    const got = Array.isArray(data?.rows) ? data.rows : [];
    rows = rows.concat(got);
  }

  // De-dupe and match by exact confirmation
  const seen = new Set<string>();
  rows = rows.filter((row) => {
    const id = String(row['Tag'] || row.tag || '') + '|' + String(row['Confirmation #'] || row.confirmation || '');
    if (seen.has(id)) return false; seen.add(id); return true;
  });

  const match = rows.find((row) => String(row['Confirmation #'] || row.confirmation || '').trim() === confirmation);
  if (match) return ok(match);

  return notFound();

  function ok(row: any) {
    const status = String(row['Status'] || row.status || 'Dropped Off');
    const safe = {
      ok: true,
      confirmation: String(row['Confirmation #'] || ''),
      tag: String(row['Tag'] || ''),
      customer: String(row['Customer'] || '').replace(/(.).+\\s+(.+)/, '$1*** $2'),
      status,
      pickup: { hours: SITE.hours, address: SITE.address, mapsUrl: SITE.mapsUrl, phone: SITE.phone },
    };
    return new Response(JSON.stringify(safe), { headers:{ 'Content-Type':'application/json' } });
  }
  function notFound() {
    return new Response(JSON.stringify({ ok:false, notFound:true }), { status:200 });
  }
}

