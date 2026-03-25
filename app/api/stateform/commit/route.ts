// app/api/stateform/commit/route.ts
import { NextResponse } from "next/server";
import { commitStateformPageInSupabase } from '@/lib/stateform/supabase';

export async function POST() {
  try {
    const json = await commitStateformPageInSupabase();
    return NextResponse.json(json);
  } catch (err: any) {
    return new NextResponse(`Commit error: ${err?.message || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
