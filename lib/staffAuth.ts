import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getLocalStaffSessionByToken } from '@/lib/localStaffAuth';
import { STAFF_ACCESS_COOKIE, STAFF_LOCAL_SESSION_COOKIE } from '@/lib/staffSession';

type StaffAccessResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

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

async function getSupabaseUserFromBearer(token: string) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !token) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
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

function getBearerToken(req: Request) {
  const authHeader = String(req.headers.get('authorization') || '').trim();
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieToken = parseCookie(req.headers.get('cookie'), STAFF_ACCESS_COOKIE);
  if (cookieToken) return cookieToken;
  return '';
}

export async function requireStaffAccess(req: Request): Promise<StaffAccessResult> {
  const bearer = getBearerToken(req);
  if (bearer) {
    const user = await getSupabaseUserFromBearer(bearer);
    if (user) return { ok: true };
  }

  const localToken = parseCookie(req.headers.get('cookie'), STAFF_LOCAL_SESSION_COOKIE);
  if (localToken) {
    const session = await getLocalStaffSessionByToken(localToken);
    if (session?.active) return { ok: true };
  }

  const apiToken = String(process.env.DEER_API_TOKEN || '').trim();
  const basicUser = String(process.env.BASIC_AUTH_USER || '').trim();
  const basicPass = String(process.env.BASIC_AUTH_PASS || '').trim();

  const hasApiToken = !!apiToken;
  const hasBasicAuth = !!basicUser && !!basicPass;

  const headerToken = String(req.headers.get('x-api-token') || '').trim();
  if (hasApiToken && headerToken && headerToken === apiToken) {
    return { ok: true };
  }

  if (hasApiToken) {
    try {
      const url = new URL(req.url);
      const queryToken = String(url.searchParams.get('token') || '').trim();
      if (queryToken && queryToken === apiToken) {
        return { ok: true };
      }
    } catch {
      // Ignore malformed URLs and continue with other auth checks.
    }
  }

  if (hasBasicAuth) {
    const creds = parseBasicAuth(req.headers.get('authorization'));
    if (creds && creds.user === basicUser && creds.pass === basicPass) {
      return { ok: true };
    }
  }

  if (!hasApiToken && !hasBasicAuth) {
    if (process.env.NODE_ENV !== 'production') return { ok: true };
    return { ok: false, status: 500, error: 'Staff API auth is not configured.' };
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}
