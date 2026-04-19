import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sharedRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function clean(raw: unknown) {
  return String(raw || '').trim();
}

function getIp(req: Request) {
  try {
    return (
      (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

export async function POST(req: Request) {
  try {
    const rl = await sharedRateLimit(getIp(req), 'processor-interest', 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const businessName = clean(body?.businessName);
    const contactName = clean(body?.contactName);
    const email = clean(body?.email).toLowerCase();
    const phone = clean(body?.phone);
    const state = clean(body?.state);
    const annualVolume = clean(body?.annualVolume);
    const currentWorkflow = clean(body?.currentWorkflow);
    const message = clean(body?.message);
    const website = clean(body?.website);

    if (website) {
      return NextResponse.json({ ok: true });
    }

    if (!businessName) {
      return NextResponse.json({ ok: false, error: 'Processor name is required.' }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json({ ok: false, error: 'Contact name is required.' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const url = new URL(req.url);
    const host = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host || '').trim().toLowerCase();
    const { error } = await supabase.from('processor_interest_requests').insert({
      business_name: businessName,
      contact_name: contactName,
      email,
      phone: phone || null,
      state: state || null,
      annual_volume: annualVolume || null,
      current_workflow: currentWorkflow || null,
      notes: message || null,
      source_host: host || null,
      status: 'new',
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
