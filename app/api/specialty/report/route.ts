import 'server-only';

import { NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { getProcessorSpecialtyCatalog } from '@/lib/specialtyCatalog';
import { loadSpecialtyInventoryEntries } from '@/lib/specialtyInventory';
import { getSupabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrderRow = {
  id: string;
  tag: string;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  dropoff_date: string | null;
  specialty_status: string | null;
  specialty_finished_email_sent_at: string | null;
  specialty_finished_sms_sent_at: string | null;
  last_call_at: string | null;
  updated_at: string | null;
  specialtyItems?: Array<{
    slug: string;
    name: string;
    shortName: string;
    quantity: number;
  }>;
};

function specialtyItemMap(itemRows: unknown[] | null | undefined) {
  const itemMap = new Map<string, OrderRow['specialtyItems']>();
  for (const item of itemRows || []) {
    const row = item as Record<string, unknown>;
    const key = String(row.job_id || '');
    const list = itemMap.get(key) || [];
    list.push({
      slug: String(row.item_slug || ''),
      name: String(row.item_name || ''),
      shortName: String(row.short_name || ''),
      quantity: Number(row.quantity ?? 0),
    });
    itemMap.set(key, list);
  }
  return itemMap;
}

export async function GET(req: Request) {
  const { denied, context: processor } = await requireProcessorPermission(req, 'view');
  if (denied) return denied;

  const supabase = getSupabaseServer();

  let query = supabase
    .from('jobs')
    .select(
      'id,tag,customer_name,phone,email,dropoff_date,specialty_status,specialty_finished_email_sent_at,specialty_finished_sms_sent_at,last_call_at,updated_at'
    )
    .eq('specialty_products', true)
    .is('pending_deleted_at', null)
    .or('specialty_status.is.null,specialty_status.neq.Picked Up');

  if (processor?.id) query = query.eq('processor_id', processor.id);

  const [{ data, error }, specialtyCatalog, inventory] = await Promise.all([
    query.order('dropoff_date', { ascending: true }).order('tag', { ascending: true }),
    getProcessorSpecialtyCatalog(processor?.id),
    loadSpecialtyInventoryEntries({ processorId: processor?.id }),
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Unable to load specialty report.' }, { status: 500 });
  }
  if (!inventory.ok) {
    return NextResponse.json({ ok: false, error: inventory.error || 'Unable to load specialty inventory.' }, { status: 500 });
  }

  const rows = ((data as unknown) || []) as OrderRow[];
  const jobIds = rows.map((row) => row.id).filter(Boolean);
  let itemMap = new Map<string, OrderRow['specialtyItems']>();

  if (jobIds.length) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('job_specialty_items')
      .select('job_id,item_slug,item_name,short_name,quantity,sort_order')
      .in('job_id', jobIds)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      return NextResponse.json({ ok: false, error: itemsError.message || 'Unable to load specialty items.' }, { status: 500 });
    }
    itemMap = specialtyItemMap(itemRows);
  }

  return NextResponse.json({
    ok: true,
    rows: rows.map((row) => ({
      ...row,
      specialtyItems: itemMap.get(String(row.id)) || [],
    })),
    specialtyCatalog: specialtyCatalog.map((item) => ({
      slug: item.slug,
      name: item.name,
      shortName: item.shortName,
      active: item.active,
      sortOrder: item.sortOrder,
    })),
    inventoryEntries: inventory.entries,
    inventoryAvailable: inventory.available,
    inventoryWarning: inventory.warning || null,
    refreshedAt: new Date().toISOString(),
  });
}
