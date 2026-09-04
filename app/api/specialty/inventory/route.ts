import 'server-only';

import { NextResponse } from 'next/server';
import { writeAuditEntry } from '@/lib/auditLog';
import { getProcessorSpecialtyCatalog } from '@/lib/specialtyCatalog';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import {
  addSpecialtyInventoryEntry,
  isMissingSpecialtyInventoryError,
  loadSpecialtyInventoryEntries
} from '@/lib/specialtyInventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSlug(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function asPositiveNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: Request) {
  const { denied, context: processor } = await requireProcessorPermission(req, 'view');
  if (denied) return denied;

  const inventory = await loadSpecialtyInventoryEntries({ processorId: processor?.id });
  if (!inventory.ok) {
    return NextResponse.json({ ok: false, error: inventory.error || 'Unable to load inventory.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    available: inventory.available,
    entries: inventory.entries,
    warning: inventory.warning || null
  });
}

export async function POST(req: Request) {
  const { denied, context: processor } = await requireProcessorPermission(req, 'update_status');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const itemSlug = cleanSlug(body.itemSlug);
  const quantity = asPositiveNumber(body.quantity);
  const action = body.action === 'waste' ? 'waste' : 'batch';

  if (!itemSlug) {
    return NextResponse.json({ ok: false, error: 'Choose a specialty product.' }, { status: 400 });
  }
  if (!quantity) {
    return NextResponse.json({ ok: false, error: 'Enter pounds greater than zero.' }, { status: 400 });
  }

  const catalog = await getProcessorSpecialtyCatalog(processor?.id);
  const item = catalog.find((entry) => entry.slug === itemSlug);
  if (!item) {
    return NextResponse.json({ ok: false, error: 'Specialty product was not found in the catalog.' }, { status: 404 });
  }

  const quantityDelta = action === 'waste' ? -quantity : quantity;

  try {
    const entry = await addSpecialtyInventoryEntry({
      processorId: processor?.id || '',
      itemSlug: item.slug,
      itemName: item.name,
      shortName: item.shortName,
      quantityDelta,
      reason: action,
      note: action === 'waste' ? 'Manual removal from stock' : 'Manual batch added to stock'
    });

    await writeAuditEntry({
      req,
      processorId: processor?.id,
      action: action === 'waste' ? 'specialty.inventory.removed' : 'specialty.inventory.added',
      targetType: 'specialty_inventory',
      targetId: entry.id,
      targetLabel: item.name,
      summary:
        action === 'waste'
          ? `Removed ${quantity.toFixed(1)} lb of ${item.name} from specialty inventory`
          : `Added ${quantity.toFixed(1)} lb of ${item.name} to specialty inventory`,
      details: {
        itemSlug: item.slug,
        itemName: item.name,
        quantityDelta
      }
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const status = isMissingSpecialtyInventoryError(error) ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: (error as Error)?.message || 'Unable to save specialty inventory.' },
      { status }
    );
  }
}
