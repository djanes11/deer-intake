import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

function getIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') || '0.0.0.0';
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(ip, 'public-drop', 15, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const customer = String(body.customer || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const processType = String(body.processType || '').trim();
  const notes = String(body.notes || '').trim();

  if (!customer || (!phone && !email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Name and a contact (phone or email) are required.' }), { status: 400 });
  }

  const job: Record<string, any> = {
    Customer: customer,
    Phone: phone,
    Email: email,
    'Process Type': processType,
    Notes: notes,
    Overnight: true,
  };

  const origin = new URL(req.url).origin;
  const r = await fetch(`${origin}/api/gas2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action: 'save', job }),
  });

  if (!r.ok) {
    return new Response(JSON.stringify({ ok: false, error: `Submit failed (${r.status})` }), { status: 500 });
  }
  const data = await r.json().catch(() => ({}));

  return new Response(JSON.stringify({ ok: true, confirmation: data?.confirmation || data?.job?.['Confirmation #'] || '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
