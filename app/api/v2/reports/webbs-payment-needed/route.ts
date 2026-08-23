import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { listWebbsProcessingPaymentNeeded, markWebbsProcessingPaid } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function GET(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'view');
    if (denied) return denied;

    const result = await listWebbsProcessingPaymentNeeded({ processorContext: processor });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'edit_jobs');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();
    const method = String(body?.method || '').trim().toLowerCase();
    if (!tag) {
      return NextResponse.json({ ok: false, error: 'tag is required' }, { status: 400 });
    }

    const result = await markWebbsProcessingPaid({ tag, method, processorContext: processor });
    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'payment.webbs_processing_paid',
        targetType: 'job',
        targetLabel: tag,
        summary: `Marked Webbs processing paid for tag ${tag}`,
        details: { tag, method: result.paymentMethodProcessing || method || 'other' },
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
