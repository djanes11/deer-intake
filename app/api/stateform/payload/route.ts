import { NextResponse } from 'next/server';
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';

export async function GET(req: Request) {
  try {
    const payload = await fetchStateformPayloadFromSupabase();
    return NextResponse.json(payload);
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
