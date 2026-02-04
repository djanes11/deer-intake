// app/api/public-drop/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { getSupabaseServer } from '@/lib/supabaseClient';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getIp(req: NextRequest): string {
  return (
    (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function genPublicToken() {
  // 24-ish chars url-safe
  return crypto.randomBytes(18).toString('base64url');
}

function genConfirmation() {
  // Keep it simple + unique enough: YYMMDD-XXXX
  // You can change later without breaking anything.
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${yy}${mm}${dd}-${rand}`;
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
    return new Response(
      JSON.stringify({ ok: false, error: 'Name and a contact (phone or email) are required.' }),
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Generate confirmation + token here so the response can show it immediately
  const confirmation = genConfirmation();
  const publicToken = genPublicToken();

  const insertPayload = {
    tag: null,
    confirmation,
    customer_name: customer,
    phone: phone || null,
    email: email || null,
    process_type: processType || null,
    notes: notes || null,

    requires_tag: true,
    dropoff_date: new Date().toISOString(),
    status: 'Dropped Off',

    public_token: publicToken,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(insertPayload)
    .select('id, confirmation, public_token')
    .maybeSingle();

  if (error) {
    console.error('public-drop insert error', error);
    return new Response(JSON.stringify({ ok: false, error: 'Submit failed' }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      confirmation: data?.confirmation || confirmation,
      publicToken: data?.public_token || publicToken,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
