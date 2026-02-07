import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
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

    // IMPORTANT:
    // If "tag" is a PRIMARY KEY in your table, updating it may fail.
    // If it fails with constraint/PK errors, tell me and I’ll switch this to copy+delete.
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
