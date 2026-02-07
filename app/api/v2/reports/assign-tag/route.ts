import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function envInfo() {
  const url =
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  return {
    url,
    key,
    present: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}

function supabaseAdmin() {
  const { url, key, present } = envInfo();
  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new Error(`Supabase env not configured. Missing: ${missing.join(', ')}. Present: ${JSON.stringify(present)}`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });

    const pendingTag = String(body.pendingTag || '').trim();
    const newTag = String(body.tag || '').trim();
    if (!pendingTag || !newTag) {
      return NextResponse.json({ ok: false, error: 'pendingTag and tag are required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from('jobs')
      .update({ tag: newTag, requires_tag: false })
      .eq('tag', pendingTag)
      .select('tag')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, tag: data?.tag });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}