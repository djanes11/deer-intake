// app/api/stateform/commit/route.ts
import { NextResponse } from "next/server";
import { commitStateformPageInSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';

export async function POST(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const json = await commitStateformPageInSupabase();
    return NextResponse.json(json);
  } catch (err: any) {
    return new NextResponse(`Commit error: ${err?.message || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
