// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

// === Config flags from env ===
const LOCK = process.env.LOCK_NON_INTAKE === '1'; // turn auth on/off
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24; // 24h rolling window

// Optional: support bypass token for trusted access (e.g., for debugging without Basic Auth)
const SUPPORT_TOKEN = process.env.SUPPORT_BYPASS_TOKEN || '';
const SUPPORT_COOKIE = 'support_bypass_ts';

// ---------- Route helpers ----------
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
  // Public: read-only intake view, gas endpoint, 404
  return p.startsWith('/intake/') || p.startsWith('/api/gas2') || p === '/404';
}

// ---------- Auth helpers ----------
function decodeBasicAuth(h: string): { user: string; pass: string } | null {
  if (!h?.startsWith('Basic ')) return null;
  const b64 = h.slice(6).trim();
  try {
    // middleware runs on edge; atob is available
    const txt = atob(b64);
    const i = txt.indexOf(':');
    if (i < 0) return null;
    return { user: txt.slice(0, i), pass: txt.slice(i + 1) };
  } catch {
    return null;
  }
}

function cookieExpired(req: NextRequest, name: string) {
  const tsStr = req.cookies.get(name)?.value;
  if (!tsStr) return true;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return true;
  const age = Math.floor(Date.now() / 1000) - ts;
  return age > MAX_AGE_S;
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function hasValidSupportCookie(req: NextRequest) {
  return !cookieExpired(req, SUPPORT_COOKIE);
}

// ---------- Main middleware ----------
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets and declared public routes
  if (isAsset(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  // Support bypass: if token is configured, allow either by cookie or one-time query param
  if (SUPPORT_TOKEN) {
    // If we already have a valid support cookie → allow and refresh it
    if (hasValidSupportCookie(req)) {
      const res = NextResponse.next();
      res.cookies.set(SUPPORT_COOKIE, String(Math.floor(Date.now() / 1000)), {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: MAX_AGE_S,
      });
      return res;
    }

    // First-time visit with ?support=TOKEN → set cookie and redirect to clean URL
    const supportParam = req.nextUrl.searchParams.get('support');
    if (supportParam && supportParam === SUPPORT_TOKEN) {
      const res = NextResponse.next();
      res.cookies.set(SUPPORT_COOKIE, String(Math.floor(Date.now() / 1000)), {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: MAX_AGE_S,
      });
      const clean = new URL(req.url);
      clean.searchParams.delete('support');
      return NextResponse.redirect(clean);
    }
  }

  // If lock is off, allow everything else through
  if (!LOCK) {
    return NextResponse.next();
  }

  // If creds not configured, hide everything else behind 404
  if (!USER || !PASS) {
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  // Basic Auth check
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    // Wrong/missing creds -> prompt
    return unauthorized();
  }

  // Valid creds -> allow and set/refresh 24h rolling cookie
  const res = NextResponse.next();
  res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: MAX_AGE_S,
  });
  return res;
}

// Make sure middleware runs for everything except the Next image optimizer path
export const config = {
  matcher: ['/((?!_next/image).*)'],
};

