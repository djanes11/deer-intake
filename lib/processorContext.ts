import 'server-only';

import { createClient } from '@supabase/supabase-js';

const DEFAULT_PROCESSOR_SLUG = (
  process.env.DEFAULT_PROCESSOR_SLUG ||
  process.env.PROCESSOR_SLUG ||
  'mcafee'
).trim().toLowerCase();

let cachedProcessorContext: { id: string | null; slug: string; expiresAt: number } | null = null;

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getDefaultProcessorContext(): Promise<{ id: string | null; slug: string }> {
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
