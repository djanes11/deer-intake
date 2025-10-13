import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function getIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') || '0.0.0.0';
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(ip, 'public-status', 30, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const tag = String(body.tag || '').trim();
  const lastName = String(body.lastName || '').trim().toLowerCase();

  if (!confirmation && !(tag && lastName)) {
    return new Response(JSON.stringify({ ok: false, error: 'Provide Confirmation # OR (Tag + Last Name).' }), { status: 400 });
  }

  let q = '';
  if (confirmation) q = confirmation;
  else q = `${tag} ${lastName}`;

  const origin = new URL(req.url).origin;
  const r = await fetch(`${origin}/api/gas2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'search', q }),
  });

  if (!r.ok) {
    return new Response(JSON.stringify({ ok: false, error: `Lookup failed (${r.status})` }), { status: 500 });
  }
  const data = await r.json().catch(() => ({}));
  const rows: any[] = data?.rows || [];

  const match = rows.find((row) => {
    const conf = String(row['Confirmation #'] || row.confirmation || '').trim();
    const t = String(row['Tag'] || row.tag || '').trim();
    const ln = String(row['Customer'] || row.customer || '').trim().split(' ').slice(-1)[0].toLowerCase();
    if (confirmation) return conf === confirmation;
    return t === tag && ln === lastName;
  });

  if (!match) {
    return new Response(JSON.stringify({ ok: false, notFound: true }), { status: 200 });
  }

  const status = String(match['Status'] || match.status || 'Dropped Off');
  const safe = {
    ok: true,
    confirmation: String(match['Confirmation #'] || ''),
    tag: String(match['Tag'] || ''),
    customer: String(match['Customer'] || '').replace(/(.).+\s+(.+)/, '$1*** $2'),
    status,
    pickup: {
      hours: SITE.hours,
      address: SITE.address,
      mapsUrl: SITE.mapsUrl,
      phone: SITE.phone,
    },
  };

  return new Response(JSON.stringify(safe), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
