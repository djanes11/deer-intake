import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { listRemovedPendingJobs } from '@/lib/jobsSupabase';

export async function GET(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const result = await listRemovedPendingJobs();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
