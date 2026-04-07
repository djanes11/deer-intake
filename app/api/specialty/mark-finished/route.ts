import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'update_status');
    if (denied) return denied;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tag = String(body?.tag || '').trim();
    if (!tag) return NextResponse.json({ ok: false, error: 'Missing tag' }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('jobs')
      .update({ specialty_status: 'Finished' })
      .eq('tag', tag)
      .select('tag,specialty_status');

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: `No job found for tag ${tag}` }, { status: 404 });
    }

    await writeAuditEntry({
      req,
      processorId: processor?.id,
      action: 'specialty.finished',
      targetType: 'job',
      targetLabel: tag,
      summary: `Marked specialty finished for tag ${tag}`,
      details: { tag },
    });

    return NextResponse.json({ ok: true, data: data[0] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
