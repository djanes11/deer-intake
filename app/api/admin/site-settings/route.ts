import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// simple protection for now
const ADMIN_TOKEN = (process.env.ADMIN_SETTINGS_TOKEN || '').trim();

function requireAuth(req: Request) {
  if (!ADMIN_TOKEN) return true; // if you forget to set it, it won’t block (dev convenience)
  const t = req.headers.get('x-admin-token') || '';
  return t.trim() === ADMIN_TOKEN;
}

export async function GET(req: Request) {
  try {
    if (!requireAuth(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single();
    if (error) throw error;

    return NextResponse.json({ ok: true, settings: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!requireAuth(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const body = await req.json().catch(() => ({}));

    const payload = {
      public_intake_enabled: !!body.public_intake_enabled,
      banner_enabled: !!body.banner_enabled,
      banner_message: String(body.banner_message || ''),
      hours: body.hours ?? {},
    };

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('site_settings')
      .update(payload)
      .eq('id', 1)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, settings: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
