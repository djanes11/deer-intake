import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('processors')
      .select('slug,public_name,name,active')
      .eq('active', true)
      .order('public_name', { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      processors: (data || []).map((row: any) => ({
        slug: String(row.slug || ''),
        name: String(row.public_name || row.name || row.slug || ''),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), processors: [] }, { status: 500 });
  }
}
