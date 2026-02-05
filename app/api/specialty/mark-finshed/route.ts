import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: 'Missing Supabase env vars' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tag = String(body?.tag || '').trim();
    if (!tag) return NextResponse.json({ ok: false, error: 'Missing tag' }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { error } = await supabase
      .from('jobs')
      .update({ specialty_status: 'Finished' })
      .eq('tag', tag);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
