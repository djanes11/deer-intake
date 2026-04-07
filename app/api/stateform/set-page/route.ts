import { NextResponse } from 'next/server';
import { setStateformPageNumberInSupabase } from '@/lib/stateform/supabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'update_status');
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const page = Number(body?.page);
    if (!(page > 0 && Number.isFinite(page))) {
      return NextResponse.json({ ok: false, error: 'invalid page' }, { status: 400 });
    }
    const result = await setStateformPageNumberInSupabase(page);
    await writeAuditEntry({
      req,
      processorId: processor?.id,
      action: 'state_form.page_set',
      targetType: 'state_form',
      targetLabel: `Page ${page}`,
      summary: `Set the state-form current page to ${page}`,
      details: { page },
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
