import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { markIntakeSheetPrinted } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'print');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Missing payload' }, { status: 400 });
    }

    const tag = String(body.tag || '').trim();
    if (!tag) {
      return NextResponse.json({ ok: false, error: 'tag is required' }, { status: 400 });
    }

    const result = await markIntakeSheetPrinted({ tag, processorContext: processor });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'print.sheet_marked_printed',
        targetType: 'job',
        targetLabel: tag,
        summary: `Marked intake sheet printed for tag ${tag}`,
        details: { tag },
      });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
