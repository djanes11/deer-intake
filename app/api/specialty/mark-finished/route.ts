import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';
import { saveJob } from '@/lib/jobsSupabase';
import { deductSpecialtyInventoryForFinishedJob } from '@/lib/specialtyInventory';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'update_status');
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const tag = String(body?.tag || '').trim();
    if (!tag) return NextResponse.json({ ok: false, error: 'Missing tag' }, { status: 400 });

    const result = await saveJob({ tag, specialtyStatus: 'Finished' } as any, { processorContext: processor });
    if (!result?.ok || !result?.job) {
      const error = (result as any)?.error || `No job found for tag ${tag}`;
      return NextResponse.json({ ok: false, error }, { status: error.toLowerCase().includes('not found') ? 404 : 400 });
    }

    const inventory = await deductSpecialtyInventoryForFinishedJob({
      processorId: processor?.id,
      job: result.job as any,
    });

    await writeAuditEntry({
      req,
      processorId: processor?.id,
      action: 'specialty.finished',
      targetType: 'job',
      targetLabel: tag,
      summary: `Marked specialty finished for tag ${tag}`,
      details: {
        tag,
        inventoryDeductionCount: inventory.entries.length,
        inventoryWarning: inventory.warning || inventory.error || null,
      },
    });

    return NextResponse.json({
      ok: true,
      data: { tag, specialty_status: 'Finished' },
      job: result.job,
      inventoryEntries: inventory.entries,
      inventoryAvailable: inventory.available,
      inventoryWarning: inventory.warning || inventory.error || null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
