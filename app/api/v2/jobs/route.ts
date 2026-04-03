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
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffProcessorContext } from '@/lib/staffContext';
import { Job } from '@/types/job';

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
  const auth = requireStaffAccess(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth), { status: auth.status });
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
      const result = await getJobByTag(tag);
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
      const result = await searchJobs(q);
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
      const result = await listJobsNeedingTag();
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
  const auth = requireStaffAccess(req);

  if (!auth.ok) {
    return new Response(JSON.stringify(auth), { status: auth.status });
  }

  const body = await req.json().catch(() => ({} as any));
  const action = normalizeAction(body.action || searchParams.get('action'));

  try {
    if (action === 'save') {
      const job = body.job as Partial<Job>;
      if (!job) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing job payload' }), {
          status: 400,
        });
      }
      const processorContext = await getStaffProcessorContext(req);
      const result = await saveJob(job, { processorContext });
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
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'needstag') {
      const result = await listJobsNeedingTag();
      return new Response(JSON.stringify(result), { status: 200 });
    }

    if (action === 'settag') {
      const { jobId, newTag, stampDropEmail, returnRow } = body;
      const result = await setJobTag({
        jobId,
        newTag,
        stampDropEmail: !!stampDropEmail,
        returnRow: !!returnRow,
      });
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
