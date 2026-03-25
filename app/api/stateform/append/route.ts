// app/api/stateform/append/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { restageStateformJobByTag } from '@/lib/stateform/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tag = String(body?.tag || '').trim();
    if (!tag) {
      return NextResponse.json({ ok: false, error: 'Missing tag' }, { status: 400 });
    }
    const result = await restageStateformJobByTag(tag);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
