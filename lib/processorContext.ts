import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { STAFF_ACCESS_COOKIE } from '@/lib/staffSession';

export type ProcessorContext = {
  id: string | null;
  slug: string;
};

const DEFAULT_PROCESSOR_SLUG = (
  process.env.DEFAULT_PROCESSOR_SLUG ||
  process.env.PROCESSOR_SLUG ||
  'mcafee'
).trim().toLowerCase();
const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

let cachedProcessorContext: { id: string | null; slug: string; expiresAt: number } | null = null;
const hostnameCache = new Map<string, { ctx: ProcessorContext; expiresAt: number }>();

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseCookie(header: string | null, key: string) {
  const raw = String(header || '');
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === key) return decodeURIComponent(rest.join('=') || '');
  }
  return '';
}

export function normalizeHostname(input?: string | null): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() || '';
  const withoutProtocol = first.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0] || '';
  return withoutPath.split(':')[0] || '';
}

async function getRequestHostname(): Promise<string> {
  try {
    const h = await headers();
    return normalizeHostname(h.get('x-forwarded-host') || h.get('host') || '');
  } catch {
    return '';
  }
}

async function getRequestAccessToken(): Promise<string> {
  try {
    const h = await headers();
    const auth = String(h.get('authorization') || '').trim();
    if (auth.startsWith('Bearer ')) {
      const bearer = auth.slice(7).trim();
      if (bearer) return bearer;
    }
    return parseCookie(h.get('cookie'), STAFF_ACCESS_COOKIE);
  } catch {
    return '';
  }
}

async function getStaffProcessorContextFromRequest(): Promise<ProcessorContext | null> {
  if (IS_PUBLIC) return null;
  const supabase = createSupabaseAdmin();
  if (!supabase) return null;

  const token = await getRequestAccessToken();
  if (!token) return null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return null;

    const userId = String(authData.user.id || '').trim();
    const email = String(authData.user.email || '').trim().toLowerCase();
    if (!userId && !email) return null;

    let query = supabase
      .from('processor_users')
      .select('processor_id,processors!inner(id,slug)')
      .eq('active', true)
      .limit(1);

    if (userId) query = query.eq('user_id', userId);
    else query = query.ilike('email', email);

    const { data: membership, error: membershipError } = await query.maybeSingle();
    if (membershipError || !membership) return null;

    const processor = Array.isArray((membership as any).processors)
      ? (membership as any).processors[0]
      : (membership as any).processors;

    if (!processor?.id || !processor?.slug) return null;
    return {
      id: String(processor.id),
      slug: String(processor.slug),
    };
  } catch {
    return null;
  }
}

async function getEnvDefaultProcessorContext(): Promise<ProcessorContext> {
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

export async function getDefaultProcessorContext(): Promise<ProcessorContext> {
  const staffScoped = await getStaffProcessorContextFromRequest();
  if (staffScoped?.id) {
    return staffScoped;
  }
  const requestHostname = await getRequestHostname();
  if (requestHostname) {
    const requestScoped = await getProcessorContextForHostnameByType(
      requestHostname,
      IS_PUBLIC ? 'public' : 'staff'
    );
    if (requestScoped.id) {
      return requestScoped;
    }
  }
  return getEnvDefaultProcessorContext();
}

export async function getProcessorContextForHostname(hostname?: string | null): Promise<ProcessorContext> {
  return getProcessorContextForHostnameByType(hostname, 'public');
}

export async function getProcessorContextForHostnameByType(
  hostname?: string | null,
  type: 'public' | 'staff' = 'public'
): Promise<ProcessorContext> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return getEnvDefaultProcessorContext();

  const now = Date.now();
  const cacheKey = `${type}:${normalized}`;
  const cached = hostnameCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.ctx;
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) return getEnvDefaultProcessorContext();

  try {
    const { data, error } = await supabase
      .from('processors')
      .select('id, slug')
      .eq(type === 'staff' ? 'staff_hostname' : 'public_hostname', normalized)
      .maybeSingle();

    if (error) throw error;

    if (data?.id && data?.slug) {
      const ctx = { id: String(data.id), slug: String(data.slug) };
      hostnameCache.set(cacheKey, { ctx, expiresAt: now + 30_000 });
      return ctx;
    }
  } catch (error) {
    console.warn('Processor hostname lookup failed; falling back to default slug.', error);
  }

  const fallback = await getEnvDefaultProcessorContext();
  hostnameCache.set(cacheKey, { ctx: fallback, expiresAt: now + 30_000 });
  return fallback;
}
