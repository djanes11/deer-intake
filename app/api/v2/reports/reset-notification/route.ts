import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { resetCustomerNotification } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'manage_notifications');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();
    const event = String(body?.event || '').trim();

    if (!tag || !event) {
      return NextResponse.json({ ok: false, error: 'tag and event are required' }, { status: 400 });
    }

    const result = await resetCustomerNotification({
      tag,
      event: event as any,
    });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'notification.flags_reset',
        targetType: 'job',
        targetLabel: tag,
        summary: `Reset ${event} notification flags for tag ${tag}`,
        details: { tag, event },
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
