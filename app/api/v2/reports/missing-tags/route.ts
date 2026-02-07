import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // (keep as-is if you only use one)
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 500) || 500, 2000);

    // Adjust table name if yours differs
    const { data, error } = await supabase
      .from('jobs')
      .select('id, tag, confirmation, customer, phone, dropoff, status, webbs, paid_processing, process_type, price_processing, requires_tag, created_at')
      .eq('requires_tag', true)
      .or('tag.ilike.PENDING-%,tag.is.null,tag.eq.')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
