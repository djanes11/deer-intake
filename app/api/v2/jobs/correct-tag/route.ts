import { NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { identifierSettingsFromPublicCopy } from '@/lib/identifiers';
import { correctJobTag } from '@/lib/jobTagCorrection';
import { JobWriteError } from '@/lib/jobWriteSafety';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context } = await requireProcessorPermission(req, 'edit_jobs');
    if (denied) return denied;
    if (!context?.id || context.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only admins can correct tags.' }, { status: 403 });
    const body = await req.json().catch(() => null);
    if (!body || ['jobId', 'oldTag', 'newTag', 'updatedAt'].some(key => typeof body[key] !== 'string' || !body[key])) {
      return NextResponse.json({ ok: false, error: 'Missing tag correction details. Reopen the intake.' }, { status: 400 });
    }
    const settings = await getPublicSiteSettings(null, context);
    const job = await correctJobTag(getSupabaseServer(), {
      processorId: context.id, role: context.role,
      jobId: body.jobId, oldTag: body.oldTag, newTag: body.newTag, updatedAt: body.updatedAt,
      identifiers: identifierSettingsFromPublicCopy(settings.publicCopy),
    });
    let warning: string | undefined;
    try {
      await writeAuditEntry({ req, processorId: context.id, action: 'job.tag_corrected', targetType: 'job', targetId: job.id,
        targetLabel: job.tag, summary: `Corrected tag ${body.oldTag} to ${job.tag}`,
        details: { oldTag: body.oldTag, newTag: job.tag } });
    } catch (error) {
      console.error('Tag corrected but audit logging failed', error);
      warning = 'The tag was corrected, but the activity log could not be updated.';
    }
    return NextResponse.json({ ok: true, job, warning });
  } catch (error) {
    if (error instanceof JobWriteError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error('Tag correction failed', error);
    return NextResponse.json({ ok: false, error: 'Could not confirm the tag correction. Reopen the intake from Search before retrying.' }, { status: 500 });
  }
}
