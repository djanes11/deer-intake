import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Return a *specific* error so you're not guessing.
  if (!url || !key) {
    const present = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    throw new Error(
      `Supabase env not configured. Missing: ${!url ? 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)' : ''}${!url && !key ? ' + ' : ''}${!key ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}. Present=${JSON.stringify(
        present
      )}`
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 500) || 500, 2000);

    // Use select('*') so we don't explode when column names differ (e.g. customer vs customer_name).
    // Client code can normalize/display whatever fields exist.
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
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
