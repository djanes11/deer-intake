import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { normalizeHours } from '@/lib/siteSettings';
import { normalizePricing } from '@/lib/pricing';
import { getDefaultProcessorContext } from '@/lib/processorContext';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const processor = await getDefaultProcessorContext();
    let query = supabase.from('site_settings').select('*');
    query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);
    const { data, error } = await query.single();
    if (error) throw error;

    return NextResponse.json({ ok: true, settings: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const body = await req.json().catch(() => ({}));
    const processor = await getDefaultProcessorContext();

    const payload = {
      ...(processor?.id ? { processor_id: processor.id } : {}),
      public_intake_enabled: !!body.public_intake_enabled,
      banner_enabled: !!body.banner_enabled,
      banner_message: String(body.banner_message || ''),
      hours: normalizeHours(body.hours),
      ...normalizePricing(body),
    };

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const query = processor.id
      ? supabase.from('site_settings').upsert(payload, { onConflict: 'processor_id' }).select('*').single()
      : supabase.from('site_settings').update(payload).eq('id', 1).select('*').single();
    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, settings: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
