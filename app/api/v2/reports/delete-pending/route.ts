import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { deletePendingJob } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'edit_jobs');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });
    }

    const jobId = String(body.jobId || '').trim();
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 });
    }

    const result = await deletePendingJob({ jobId, processorContext: processor });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'pending.removed',
        targetType: 'pending_job',
        targetId: jobId,
        targetLabel: jobId,
        summary: 'Removed a public intake from the active queue',
        details: { jobId },
      });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
