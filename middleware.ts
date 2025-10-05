// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const LOCK = process.env.LOCK_NON_INTAKE === '1';

// Support bypass: either set SUPPORT_TOKEN env and use ?support=...,
// or use Basic Auth "travis:butcherman" (ONLY for support).
const SUPPORT_TOKEN = process.env.SUPPORT_TOKEN || 'AIISTAKINGOVERTHEWORLD';
const SUPPORT_USER = 'travis';
const SUPPORT_PASS = 'butcherman';

const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';

// cookies
const AUTH_COOKIE = 'auth_ts';
const SUPPORT_COOKIE = 'support_ok';
const STAFF_MAX_AGE_S = 60 * 60 * 24; // 24h
const SUPPORT_MAX_AGE_S = 60 * 60 * 2; // 2h

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p === '/favicon.ico' ||
    p === '/robots.txt' ||
    p === '/sitemap.xml' ||
    p.startsWith('/assets/') ||
    /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|txt|map)$/.test(p)
  );
}
function isPublic(p: string) {
  // keep public readonly view + GAS bridge public
  return p.startsWith('/intake/') || p.startsWith('/api/gas2') || p === '/404';
}

function decodeBasicAuth(h: string): { user: string; pass: string } | null {
  if (!h?.startsWith('Basic ')) return null;
  const b64 = h.slice(6).trim();
  try {
    const txt = atob(b64);
    const i = txt.indexOf(':');
    if (i < 0) return null;
    return { user: txt.slice(0, i), pass: txt.slice(i + 1) };
  } catch {
    return null;
  }
}

function cookieExpired(tsStr: string | undefined, maxAge: number) {
  if (!tsStr) return true;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return true;
  const age = Math.floor(Date.now() / 1000) - ts;
  return age > maxAge;
}

function stampCookie(res: NextResponse, name: string, maxAge: number) {
  res.cookies.set(name, String(Math.floor(Date.now() / 1000)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge,
  });
}

function unauthorized(realm = REALM) {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"` },
  });
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Always allow assets and declared public routes
  if (isAsset(pathname) || isPublic(pathname)) return NextResponse.next();

  // If not locking, let everything through
  if (!LOCK) return NextResponse.next();

  // --- Support bypass 1: cookie already set ---
  const supportTs = req.cookies.get(SUPPORT_COOKIE)?.value;
  if (!cookieExpired(supportTs, SUPPORT_MAX_AGE_S)) {
    // keep support session rolling
    const res = NextResponse.next();
    stampCookie(res, SUPPORT_COOKIE, SUPPORT_MAX_AGE_S);
    return res;
  }

  // --- Support bypass 2: query param token ---
  const token = searchParams.get('support');
  if (token && SUPPORT_TOKEN && token === SUPPORT_TOKEN) {
    const res = NextResponse.next();
    stampCookie(res, SUPPORT_COOKIE, SUPPORT_MAX_AGE_S);
    return res;
  }

  // --- Support bypass 3: support basic auth (travis:butcherman) ---
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (creds && creds.user === SUPPORT_USER && creds.pass === SUPPORT_PASS) {
    const res = NextResponse.next();
    stampCookie(res, SUPPORT_COOKIE, SUPPORT_MAX_AGE_S);
    return res;
  }

  // --- Staff auth (basic) for everyone else ---
  if (!USER || !PASS) {
    // Misconfigured staff creds -> hide
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  const staffCreds = creds;
  if (!staffCreds || staffCreds.user !== USER || staffCreds.pass !== PASS) {
    return unauthorized();
  }

  const res = NextResponse.next();
  // refresh staff cookie to avoid surprise logouts during shift
  stampCookie(res, AUTH_COOKIE, STAFF_MAX_AGE_S);
  return res;
}

export const config = {
  matcher: ['/((?!_next/image).*)'],
};

