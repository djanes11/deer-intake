import { NextResponse } from 'next/server';
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';

export async function GET(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const payload = await fetchStateformPayloadFromSupabase();
    return NextResponse.json(payload);
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
