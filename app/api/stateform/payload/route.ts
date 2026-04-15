import { NextResponse } from 'next/server';
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';

export async function GET(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'view');
    if (denied) return denied;
    const payload = await fetchStateformPayloadFromSupabase(processor);
    return NextResponse.json(payload);
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
