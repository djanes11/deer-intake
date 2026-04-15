import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { listJobsNeedingPrint } from '@/lib/jobsSupabase';

export async function GET(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'view');
    if (denied) return denied;

    const result = await listJobsNeedingPrint({ processorContext: processor });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
