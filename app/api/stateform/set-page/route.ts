import { NextResponse } from 'next/server';
import { setStateformPageNumberInSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';

export async function POST(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const page = Number(body?.page);
    if (!(page > 0 && Number.isFinite(page))) {
      return NextResponse.json({ ok: false, error: 'invalid page' }, { status: 400 });
    }
    const result = await setStateformPageNumberInSupabase(page);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
