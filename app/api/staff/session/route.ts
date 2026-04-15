import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearLocalStaffSession, getLocalStaffSessionByToken } from '@/lib/localStaffAuth';
import { STAFF_ACCESS_COOKIE, STAFF_LOCAL_SESSION_COOKIE } from '@/lib/staffSession';

export const runtime = 'nodejs';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function cookieOptions(maxAge = COOKIE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accessToken = String(body?.accessToken || '').trim();
    const localSessionToken = String(body?.localSessionToken || '').trim();

    if (!accessToken && !localSessionToken) {
      return NextResponse.json({ ok: false, error: 'Missing session token.' }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });

    if (accessToken) {
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        return NextResponse.json({ ok: false, error: 'Staff auth is not configured.' }, { status: 500 });
      }
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data?.user) {
        return NextResponse.json({ ok: false, error: 'Invalid staff session.' }, { status: 401 });
      }
      res.cookies.set(STAFF_ACCESS_COOKIE, accessToken, cookieOptions());
      res.cookies.delete(STAFF_LOCAL_SESSION_COOKIE);
    }

    if (localSessionToken) {
      const localSession = await getLocalStaffSessionByToken(localSessionToken);
      if (!localSession?.active) {
        return NextResponse.json({ ok: false, error: 'Invalid local staff session.' }, { status: 401 });
      }
      res.cookies.set(STAFF_LOCAL_SESSION_COOKIE, localSessionToken, cookieOptions());
      res.cookies.delete(STAFF_ACCESS_COOKIE);
    }

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const localToken = req.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STAFF_LOCAL_SESSION_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=');

  if (localToken) {
    await clearLocalStaffSession(decodeURIComponent(localToken)).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_ACCESS_COOKIE, '', cookieOptions(0));
  res.cookies.set(STAFF_LOCAL_SESSION_COOKIE, '', cookieOptions(0));
  return res;
}
