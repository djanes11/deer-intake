import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { setJobTag } from '@/lib/jobsSupabase';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'edit_jobs');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });

    const pendingTag = String(body.pendingTag || '').trim();
    const jobId = String(body.jobId || '').trim();
    const newTag = String(body.tag || '').trim();

    if ((!pendingTag && !jobId) || !newTag) {
      return NextResponse.json(
        { ok: false, error: 'jobId (or pendingTag) and tag are required' },
        { status: 400 }
      );
    }

    let resolvedJobId = jobId;
    if (!resolvedJobId) {
      const supabase = getSupabaseServer();
      const { data: found, error: findError } = await supabase
        .from('jobs')
        .select('id')
        .eq('tag', pendingTag)
        .maybeSingle();

      if (findError) throw findError;
      if (!found?.id) {
        return NextResponse.json({ ok: false, error: 'Pending job not found' }, { status: 404 });
      }
      resolvedJobId = String(found.id);
    }

    const result = await setJobTag({
      jobId: resolvedJobId,
      newTag,
      returnRow: true,
    });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'job.tag_assigned',
        targetType: 'job',
        targetId: resolvedJobId,
        targetLabel: newTag,
        summary: `Assigned tag ${newTag} to a pending public intake`,
        details: { jobId: resolvedJobId, tag: newTag, pendingTag: pendingTag || null },
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
