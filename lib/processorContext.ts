import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type ProcessorContext = {
  id: string | null;
  slug: string;
};

const DEFAULT_PROCESSOR_SLUG = (
  process.env.DEFAULT_PROCESSOR_SLUG ||
  process.env.PROCESSOR_SLUG ||
  'mcafee'
).trim().toLowerCase();

let cachedProcessorContext: { id: string | null; slug: string; expiresAt: number } | null = null;
const hostnameCache = new Map<string, { ctx: ProcessorContext; expiresAt: number }>();

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function normalizeHostname(input?: string | null): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() || '';
  const withoutProtocol = first.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0] || '';
  return withoutPath.split(':')[0] || '';
}

export async function getDefaultProcessorContext(): Promise<ProcessorContext> {
  const now = Date.now();
  if (cachedProcessorContext && cachedProcessorContext.expiresAt > now) {
    return {
      id: cachedProcessorContext.id,
      slug: cachedProcessorContext.slug,
    };
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return { id: null, slug: DEFAULT_PROCESSOR_SLUG };
  }

  try {
    const { data, error } = await supabase
      .from('processors')
      .select('id, slug')
      .eq('slug', DEFAULT_PROCESSOR_SLUG)
      .maybeSingle();

    if (error) throw error;

    cachedProcessorContext = {
      id: data?.id ? String(data.id) : null,
      slug: DEFAULT_PROCESSOR_SLUG,
      expiresAt: now + 30_000,
    };
  } catch (error) {
    console.warn('Processor context lookup failed; falling back to default slug.', error);
    cachedProcessorContext = {
      id: null,
      slug: DEFAULT_PROCESSOR_SLUG,
      expiresAt: now + 30_000,
    };
  }

  return {
    id: cachedProcessorContext.id,
    slug: cachedProcessorContext.slug,
  };
}

export async function getProcessorContextForHostname(hostname?: string | null): Promise<ProcessorContext> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return getDefaultProcessorContext();

  const now = Date.now();
  const cached = hostnameCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.ctx;
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) return getDefaultProcessorContext();

  try {
    const { data, error } = await supabase
      .from('processors')
      .select('id, slug')
      .eq('public_hostname', normalized)
      .maybeSingle();

    if (error) throw error;

    if (data?.id && data?.slug) {
      const ctx = { id: String(data.id), slug: String(data.slug) };
      hostnameCache.set(normalized, { ctx, expiresAt: now + 30_000 });
      return ctx;
    }
  } catch (error) {
    console.warn('Processor hostname lookup failed; falling back to default slug.', error);
  }

  const fallback = await getDefaultProcessorContext();
  hostnameCache.set(normalized, { ctx: fallback, expiresAt: now + 30_000 });
  return fallback;
}
