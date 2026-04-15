// app/api/v2/jobs/route.ts
import { NextRequest } from 'next/server';
import {
  getJobByTag,
  searchJobs,
  saveJob,
  logCall,
  progressJob,
  markCalled,
  listJobsNeedingTag,
  setJobTag,
} from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { Job } from '@/types/job';
import { writeAuditEntry } from '@/lib/auditLog';

function normalizeAction(v: string | null) {
  const s = (v || '').trim().toLowerCase();
  if (!s) return '';
  if (['get', 'job', 'read', 'fetch'].includes(s)) return 'get';
  if (['search', 'find', 'query'].includes(s)) return 'search';
  if (['save', 'upsert'].includes(s)) return 'save';
  if (['log-call', 'logcall', 'call'].includes(s)) return 'log-call';
  if (['markcalled', 'mark-called', 'mark_called'].includes(s)) return 'markcalled';
  if (['needstag', '@needstag', 'needs-tag', 'needs_tag'].includes(s)) return 'needstag';
  if (['settag', 'set-tag', 'set_tag'].includes(s)) return 'settag';
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = normalizeAction(searchParams.get('action'));
  const { denied, context: processorContext } = await requireProcessorPermission(req, 'view');
  if (denied) {
    return new Response(await denied.text(), { status: denied.status, headers: { 'content-type': 'application/json' } });
  }

  if (action === 'ping') {
    return new Response(JSON.stringify({ ok: true, pong: true }), { status: 200 });
  }

  if (action === 'get') {
    const tag = searchParams.get('tag');
    if (!tag) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing tag' }), {
        status: 400,
      });
    }

    try {
      const result = await getJobByTag(tag, { processorContext });
      return new Response(JSON.stringify(result), { status: 200 });
    } catch (err: any) {
      console.error('GET get error', err);
      return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
        status: 500,
      });
    }
  }

  if (action === 'search') {
    const q = searchParams.get('q') || '';
    try {
      const result = await searchJobs(q, { processorContext });
      return new Response(JSON.stringify(result), { status: 200 });
    } catch (err: any) {
      console.error('GET search error', err);
      return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
        status: 500,
      });
    }
  }

  if (action === 'needstag') {
    try {
      const result = await listJobsNeedingTag({ processorContext });
      return new Response(JSON.stringify(result), { status: 200 });
    } catch (err: any) {
      console.error('GET needstag error', err);
      return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
        status: 500,
      });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'Unknown action (GET)' }), {
    status: 400,
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({} as any));
  const action = normalizeAction(body.action || searchParams.get('action'));

  try {
    const permission =
      action === 'save' || action === 'log-call' || action === 'settag'
        ? 'edit_jobs'
        : action === 'progress' || action === 'markcalled'
          ? 'update_status'
          : 'view';
    const { denied, context: processorContext } = await requireProcessorPermission(req, permission as any);
    if (denied) {
      return new Response(await denied.text(), { status: denied.status, headers: { 'content-type': 'application/json' } });
    }

    if (action === 'save') {
      const job = body.job as Partial<Job>;
      if (!job) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing job payload' }), {
          status: 400,
        });
      }
      const result = await saveJob(job, { processorContext });
      if (result?.ok && job?.tag) {
        await writeAuditEntry({
          req,
          processorId: processorContext?.id,
          action: 'job.saved',
          targetType: 'job',
          targetLabel: String(job.tag),
          summary: `Saved intake record for tag ${job.tag}`,
          details: {
            tag: String(job.tag),
            customerName: (job as any)?.customerName || null,
          },
        });
      }
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'log-call') {
      const { tag, scope, reason, notes, outcome } = body;
      if (!tag) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing tag' }), {
          status: 400,
        });
      }
      const result = await logCall({ tag, scope, reason, notes, outcome });
      if ((result as any)?.ok !== false) {
        await writeAuditEntry({
          req,
          processorId: processorContext?.id,
          action: 'call.logged',
          targetType: 'job',
          targetLabel: String(tag),
          summary: `Logged a call attempt for tag ${tag}`,
          details: { tag, scope: scope || 'meat', reason: reason || null, outcome: outcome || null },
        });
      }
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'progress') {
      const { tag } = body;
      const tagFromQuery = searchParams.get('tag');
      const finalTag = tag || tagFromQuery;

      if (!finalTag) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing tag' }), {
          status: 400,
        });
      }

      const result = await progressJob(finalTag);
      if ((result as any)?.ok !== false) {
        await writeAuditEntry({
          req,
          processorId: processorContext?.id,
          action: 'status.progressed',
          targetType: 'job',
          targetLabel: String(finalTag),
          summary: `Progressed processing status for tag ${finalTag}`,
          details: { tag: finalTag },
        });
      }
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'markcalled') {
      const { tag, scope, notes } = body;
      const tagFromQuery = searchParams.get('tag');
      const finalTag = tag || tagFromQuery;

      if (!finalTag) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing tag' }), {
          status: 400,
        });
      }

      const result = await markCalled({ tag: finalTag, scope, notes });
      if ((result as any)?.ok !== false) {
        await writeAuditEntry({
          req,
          processorId: processorContext?.id,
          action: 'call.marked_called',
          targetType: 'job',
          targetLabel: String(finalTag),
          summary: `Marked ${scope || 'meat'} as called for tag ${finalTag}`,
          details: { tag: finalTag, scope: scope || 'meat' },
        });
      }
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'needstag') {
      const result = await listJobsNeedingTag({ processorContext });
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'settag') {
      const { jobId, newTag, stampDropEmail, returnRow } = body;
      const result = await setJobTag({
        jobId,
        newTag,
        stampDropEmail: !!stampDropEmail,
        returnRow: !!returnRow,
        processorContext,
      });
      if (result.ok) {
        await writeAuditEntry({
          req,
          processorId: processorContext?.id,
          action: 'job.tag_assigned',
          targetType: 'job',
          targetId: String(jobId || ''),
          targetLabel: String(newTag),
          summary: `Assigned tag ${newTag}`,
          details: { jobId: jobId || null, tag: newTag },
        });
      }
      const status = result.ok ? 200 : 400;
      return new Response(JSON.stringify(result), { status });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unknown action (POST)' }), {
      status: 400,
    });
  } catch (err: any) {
    console.error('POST v2/jobs error', err);

    const msg = String(err?.message || err || 'Server error');

    // Validation/shape issues should be 400 (client error), not 500
    if (
      msg.includes('Tag is required') ||
      msg.includes('Confirmation must be 13 digits') ||
      msg.includes('Missing job payload')
    ) {
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
}
