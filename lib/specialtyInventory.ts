import 'server-only';

import { getSupabaseServer } from './supabaseClient';

export type SpecialtyInventoryReason = 'batch' | 'job_finished' | 'adjustment' | 'waste';

export type SpecialtyInventoryEntry = {
  id: string;
  itemSlug: string;
  itemName: string;
  shortName: string;
  quantityDelta: number;
  reason: SpecialtyInventoryReason;
  note: string | null;
  tag: string | null;
  jobId: string | null;
  createdAt: string | null;
};

type SupabaseLike = ReturnType<typeof getSupabaseServer>;

type InventoryItemInput = {
  slug?: string | null;
  item_slug?: string | null;
  name?: string | null;
  item_name?: string | null;
  shortName?: string | null;
  short_name?: string | null;
  quantity?: number | string | null;
};

const MISSING_INVENTORY_MESSAGE =
  'Specialty inventory is not active yet. Run sql/2026-09-04-specialty-inventory-ledger.sql in Supabase.';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanSlug(value: unknown): string {
  return asString(value).toLowerCase();
}

export function isMissingSpecialtyInventoryError(error: unknown): boolean {
  const message = [
    (error as { message?: string } | null)?.message,
    (error as { details?: string } | null)?.details,
    (error as { hint?: string } | null)?.hint,
    (error as { code?: string } | null)?.code
  ]
    .filter(Boolean)
    .join(' ');

  return /specialty_inventory_ledger|schema cache|does not exist|could not find|not active yet/i.test(message);
}

function mapInventoryEntry(row: Record<string, unknown>): SpecialtyInventoryEntry {
  return {
    id: String(row.id ?? ''),
    itemSlug: String(row.item_slug ?? ''),
    itemName: String(row.item_name ?? ''),
    shortName: String(row.short_name ?? ''),
    quantityDelta: asNumber(row.quantity_delta),
    reason: String(row.reason ?? 'adjustment') as SpecialtyInventoryReason,
    note: row.note == null ? null : String(row.note),
    tag: row.tag == null ? null : String(row.tag),
    jobId: row.job_id == null ? null : String(row.job_id),
    createdAt: row.created_at == null ? null : String(row.created_at)
  };
}

export async function loadSpecialtyInventoryEntries({
  processorId,
  limit = 10000,
  supabase = getSupabaseServer()
}: {
  processorId?: string | null;
  limit?: number;
  supabase?: SupabaseLike;
}): Promise<{ ok: boolean; available: boolean; entries: SpecialtyInventoryEntry[]; warning?: string; error?: string }> {
  if (!processorId) return { ok: true, available: true, entries: [] };

  const { data, error } = await supabase
    .from('specialty_inventory_ledger')
    .select('id,item_slug,item_name,short_name,quantity_delta,reason,note,tag,job_id,created_at')
    .eq('processor_id', processorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSpecialtyInventoryError(error)) {
      return { ok: true, available: false, entries: [], warning: MISSING_INVENTORY_MESSAGE };
    }
    return { ok: false, available: true, entries: [], error: error.message };
  }

  return { ok: true, available: true, entries: (data ?? []).map((row) => mapInventoryEntry(row)) };
}

export async function addSpecialtyInventoryEntry({
  processorId,
  itemSlug,
  itemName,
  shortName,
  quantityDelta,
  reason,
  note,
  jobId = null,
  tag = null,
  supabase = getSupabaseServer()
}: {
  processorId: string;
  itemSlug: string;
  itemName: string;
  shortName: string;
  quantityDelta: number;
  reason: SpecialtyInventoryReason;
  note?: string | null;
  jobId?: string | null;
  tag?: string | null;
  supabase?: SupabaseLike;
}): Promise<SpecialtyInventoryEntry> {
  const slug = cleanSlug(itemSlug);
  const delta = asNumber(quantityDelta);

  if (!processorId) throw new Error('Missing processor id.');
  if (!slug) throw new Error('Missing specialty product.');
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Inventory quantity must not be zero.');

  const { data, error } = await supabase
    .from('specialty_inventory_ledger')
    .insert({
      processor_id: processorId,
      job_id: jobId,
      tag,
      item_slug: slug,
      item_name: itemName,
      short_name: shortName || itemName,
      quantity_delta: delta,
      reason,
      note: note || null
    })
    .select('id,item_slug,item_name,short_name,quantity_delta,reason,note,tag,job_id,created_at')
    .single();

  if (error) {
    if (isMissingSpecialtyInventoryError(error)) throw new Error(MISSING_INVENTORY_MESSAGE);
    throw new Error(error.message || 'Unable to save specialty inventory.');
  }

  return mapInventoryEntry(data ?? {});
}

async function loadFinishedJobEntries({
  processorId,
  jobId,
  supabase
}: {
  processorId: string;
  jobId: string;
  supabase: SupabaseLike;
}): Promise<SpecialtyInventoryEntry[]> {
  const { data, error } = await supabase
    .from('specialty_inventory_ledger')
    .select('id,item_slug,item_name,short_name,quantity_delta,reason,note,tag,job_id,created_at')
    .eq('processor_id', processorId)
    .eq('job_id', jobId)
    .eq('reason', 'job_finished')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingSpecialtyInventoryError(error)) return [];
    throw new Error(error.message || 'Unable to load specialty inventory deductions.');
  }

  return (data ?? []).map((row) => mapInventoryEntry(row));
}

function normalizeJobItems(value: unknown): InventoryItemInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as InventoryItemInput) : null))
    .filter(Boolean) as InventoryItemInput[];
}

export async function deductSpecialtyInventoryForFinishedJob({
  processorId,
  job,
  supabase = getSupabaseServer()
}: {
  processorId?: string | null;
  job?: Record<string, unknown> | null;
  supabase?: SupabaseLike;
}): Promise<{ ok: boolean; available: boolean; entries: SpecialtyInventoryEntry[]; warning?: string; error?: string }> {
  const jobId = asString(job?.id);
  const jobProcessorId = asString(job?.processor_id) || asString(job?.processorId) || asString(processorId);
  const tag = asString(job?.tag) || null;
  const items = normalizeJobItems(job?.specialtyItems ?? job?.specialty_items ?? job?.job_specialty_items)
    .map((item) => ({
      slug: cleanSlug(item.slug ?? item.item_slug),
      name: asString(item.name ?? item.item_name),
      shortName: asString(item.shortName ?? item.short_name),
      quantity: asNumber(item.quantity)
    }))
    .filter((item) => item.slug && item.quantity > 0);

  if (!jobProcessorId || !jobId || items.length === 0) {
    return { ok: true, available: true, entries: [] };
  }

  try {
    for (const item of items) {
      const { error } = await supabase
        .from('specialty_inventory_ledger')
        .insert({
          processor_id: jobProcessorId,
          job_id: jobId,
          tag,
          item_slug: item.slug,
          item_name: item.name || item.shortName || item.slug,
          short_name: item.shortName || item.name || item.slug,
          quantity_delta: -Math.abs(item.quantity),
          reason: 'job_finished',
          note: 'Auto deducted when specialty job was marked finished'
        });

      if (error && error.code !== '23505') throw error;
    }

    return {
      ok: true,
      available: true,
      entries: await loadFinishedJobEntries({ processorId: jobProcessorId, jobId, supabase })
    };
  } catch (error) {
    if (isMissingSpecialtyInventoryError(error)) {
      return { ok: true, available: false, entries: [], warning: MISSING_INVENTORY_MESSAGE };
    }
    return {
      ok: false,
      available: true,
      entries: [],
      error: (error as Error)?.message || 'Unable to deduct specialty inventory.'
    };
  }
}
