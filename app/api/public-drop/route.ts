// app/api/public-drop/route.ts
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';
import { saveJob } from '@/lib/jobsSupabase';
import { getPublicSiteSettings } from '@/lib/siteSettings';
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
  // Public status expects digits-only confirmation values.
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0');
  return `${yy}${mm}${dd}${rand}`;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(ip, 'public-drop', 15, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), { status: 429 });
  }

  const settings = await getPublicSiteSettings();
  if (!settings.public_intake_enabled) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: settings.banner_message || 'Overnight intake is currently unavailable.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawJob = (body?.job && typeof body.job === 'object' ? body.job : body) as Record<string, any>;
  const customer = String(rawJob.customer || '').trim();
  const phone = String(rawJob.phone || '').trim();
  const email = String(rawJob.email || '').trim();
  const processType = String(rawJob.processType || '').trim();
  const notes = String(rawJob.notes || '').trim();

  if (!customer || (!phone && !email)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Name and a contact (phone or email) are required.' }),
      { status: 400 }
    );
  }

  const confirmation = String(rawJob.confirmation || '').trim() || genConfirmation();
  const publicToken = String(rawJob.publicToken || '').trim() || genPublicToken();

  try {
    const result = await saveJob({
      ...rawJob,
      tag: '',
      confirmation,
      customer,
      phone,
      email: email || '',
      processType: processType || '',
      notes: notes || '',
      requiresTag: true,
      status: rawJob.status || 'Dropped Off',
      dropoff: rawJob.dropoff || new Date().toISOString().slice(0, 10),
      publicToken,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        confirmation: result?.job?.confirmation || confirmation,
        publicToken: result?.job?.publicToken || publicToken,
        job: result?.job || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('public-drop save error', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message || error || 'Submit failed') }),
      { status: 500 }
    );
  }
}
