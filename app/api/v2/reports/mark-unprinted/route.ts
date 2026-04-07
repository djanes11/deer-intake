import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { markIntakeSheetUnprinted } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'print');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();

    if (!tag) {
      return NextResponse.json({ ok: false, error: 'tag is required' }, { status: 400 });
    }

    const result = await markIntakeSheetUnprinted({ tag });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'print.sheet_marked_unprinted',
        targetType: 'job',
        targetLabel: tag,
        summary: `Returned tag ${tag} to the print queue`,
        details: { tag },
      });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
