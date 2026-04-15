import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getDefaultProcessorContext, type ProcessorContext } from '@/lib/processorContext';
import { getLocalStaffSessionByToken } from '@/lib/localStaffAuth';
import { STAFF_ACCESS_COOKIE, STAFF_LOCAL_SESSION_COOKIE } from '@/lib/staffSession';

export type StaffIdentity = {
  userId: string | null;
  email: string | null;
  username?: string | null;
  processorId?: string | null;
  processorSlug?: string | null;
  role?: 'admin' | 'staff' | 'readonly' | null;
  mustChangePassword?: boolean | null;
  authType: 'supabase' | 'local' | 'api_token' | 'basic' | 'none';
};

export type StaffMembership = {
  processorId: string;
  processorSlug: string;
  email: string;
  role: 'admin' | 'staff' | 'readonly';
  active: boolean;
};

export type StaffProcessorContext = ProcessorContext & {
  authType: StaffIdentity['authType'];
  role: StaffMembership['role'] | null;
  membershipCount: number;
  userId: string | null;
  email: string | null;
};

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseBasicAuth(header: string | null) {
  const value = String(header || '');
  if (!value.startsWith('Basic ')) return null;
  try {
    const [user, pass] = Buffer.from(value.slice(6), 'base64').toString('utf8').split(':', 2);
    return { user, pass };
  } catch {
    return null;
  }
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

async function getBearerToken(req?: Request | null) {
  const explicitAuth = String(req?.headers.get('authorization') || '');
  if (explicitAuth.startsWith('Bearer ')) {
    const bearer = explicitAuth.slice(7).trim();
    if (bearer) return bearer;
  }

  const explicitCookie = parseCookie(req?.headers.get('cookie') || null, STAFF_ACCESS_COOKIE);
  if (explicitCookie) return explicitCookie;

  if (req) return '';

  try {
    const h = await headers();
    const auth = String(h.get('authorization') || '');
    if (auth.startsWith('Bearer ')) {
      const bearer = auth.slice(7).trim();
      if (bearer) return bearer;
    }
    return parseCookie(h.get('cookie') || null, STAFF_ACCESS_COOKIE);
  } catch {
    return '';
  }
}

async function getLocalSessionToken(req?: Request | null) {
  const explicitCookie = parseCookie(req?.headers.get('cookie') || null, STAFF_LOCAL_SESSION_COOKIE);
  if (explicitCookie) return explicitCookie;
  if (req) return '';

  try {
    const h = await headers();
    return parseCookie(h.get('cookie') || null, STAFF_LOCAL_SESSION_COOKIE);
  } catch {
    return '';
  }
}

function getRequestedProcessorSlug(req?: Request | null) {
  const headerSlug = String(req?.headers.get('x-processor-slug') || '').trim().toLowerCase();
  if (headerSlug) return headerSlug;
  try {
    const url = new URL(String(req?.url || ''));
    return String(url.searchParams.get('processor') || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function allowLegacyStaffAuth() {
  if (process.env.ALLOW_LEGACY_STAFF_AUTH === '1') return true;
  if (process.env.ALLOW_LEGACY_STAFF_AUTH === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export async function getStaffIdentity(req?: Request | null): Promise<StaffIdentity> {
  const supabase = createSupabaseAdmin();
  const bearer = await getBearerToken(req);

  if (supabase && bearer) {
    try {
      const { data, error } = await supabase.auth.getUser(bearer);
      if (!error && data?.user) {
        return {
          userId: String(data.user.id),
          email: String(data.user.email || '').trim().toLowerCase() || null,
          mustChangePassword: !!data.user.app_metadata?.wgbb_force_password_change,
          authType: 'supabase',
        };
      }
    } catch {
      // Fall through to legacy auth modes.
    }
  }

  const localToken = await getLocalSessionToken(req);
  if (localToken) {
    try {
      const local = await getLocalStaffSessionByToken(localToken);
      if (local) {
        return {
          userId: String(local.localUserId),
          email: null,
          username: String(local.username),
          processorId: String(local.processorId),
          processorSlug: String(local.processorSlug),
          role: local.role,
          mustChangePassword: !!local.mustChangePassword,
          authType: 'local',
        };
      }
    } catch {
      // Fall through to legacy auth modes.
    }
  }

  const apiToken = String(process.env.DEER_API_TOKEN || '').trim();
  const headerToken = String(req?.headers.get('x-api-token') || '').trim();
  if (allowLegacyStaffAuth() && apiToken && headerToken && headerToken === apiToken) {
    return { userId: null, email: null, authType: 'api_token' };
  }

  const basicUser = String(process.env.BASIC_AUTH_USER || '').trim();
  const basicPass = String(process.env.BASIC_AUTH_PASS || '').trim();
  if (allowLegacyStaffAuth() && basicUser && basicPass) {
    const creds = parseBasicAuth(req?.headers.get('authorization') || null);
    if (creds && creds.user === basicUser && creds.pass === basicPass) {
      return { userId: null, email: null, authType: 'basic' };
    }
  }

  return { userId: null, email: null, authType: 'none' };
}

export async function listStaffMemberships(req?: Request | null): Promise<StaffMembership[]> {
  const identity = await getStaffIdentity(req);
  if (identity.authType === 'local' && identity.processorId && identity.processorSlug) {
    return [{
      processorId: identity.processorId,
      processorSlug: identity.processorSlug,
      email: identity.username || '',
      role: (identity.role || 'staff') as StaffMembership['role'],
      active: true,
    }];
  }
  if (identity.authType !== 'supabase') return [];

  const supabase = createSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase
    .from('processor_users')
    .select('processor_id,email,role,active,processors!inner(id,slug)')
    .eq('active', true);

  if (identity.userId) {
    query = query.eq('user_id', identity.userId);
  } else if (identity.email) {
    query = query.ilike('email', identity.email);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map((row: any) => {
      const processor = Array.isArray(row.processors) ? row.processors[0] : row.processors;
      if (!processor?.id || !processor?.slug) return null;
      return {
        processorId: String(processor.id),
        processorSlug: String(processor.slug),
        email: String(row.email || '').trim().toLowerCase(),
        role: (String(row.role || 'staff') as StaffMembership['role']),
        active: !!row.active,
      } satisfies StaffMembership;
    })
    .filter(Boolean) as StaffMembership[];
}

export async function isPlatformAdmin(req?: Request | null): Promise<boolean> {
  const identity = await getStaffIdentity(req);
  if (identity.authType !== 'supabase') return false;

  const supabase = createSupabaseAdmin();
  if (!supabase) return false;

  let query = supabase
    .from('platform_admins')
    .select('id')
    .eq('active', true)
    .limit(1);

  if (identity.userId) {
    query = query.eq('user_id', identity.userId);
  } else if (identity.email) {
    query = query.ilike('email', identity.email);
  } else {
    return false;
  }

  const { data, error } = await query;
  if (error) throw error;
  return !!data?.length;
}

export async function getStaffProcessorContext(req?: Request | null): Promise<StaffProcessorContext> {
  const identity = await getStaffIdentity(req);
  if (identity.authType === 'local' && identity.processorId && identity.processorSlug) {
    return {
      id: identity.processorId,
      slug: identity.processorSlug,
      role: (identity.role || 'staff') as StaffMembership['role'],
      authType: identity.authType,
      membershipCount: 1,
      userId: identity.userId,
      email: identity.username || null,
    };
  }
  const memberships = await listStaffMemberships(req);
  const requestedSlug = getRequestedProcessorSlug(req);

  if (memberships.length === 1) {
    const only = memberships[0];
    return {
      id: only.processorId,
      slug: only.processorSlug,
      role: only.role,
      authType: identity.authType,
      membershipCount: 1,
      userId: identity.userId,
      email: identity.email,
    };
  }

  if (memberships.length > 1 && requestedSlug) {
    const matched = memberships.find((item) => item.processorSlug === requestedSlug);
    if (matched) {
      return {
        id: matched.processorId,
        slug: matched.processorSlug,
        role: matched.role,
        authType: identity.authType,
        membershipCount: memberships.length,
        userId: identity.userId,
        email: identity.email,
      };
    }
  }

  const fallback = await getDefaultProcessorContext();
  return {
    ...fallback,
    role: null,
    authType: identity.authType,
    membershipCount: memberships.length,
    userId: identity.userId,
    email: identity.email,
  };
}
