// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const LOCK = process.env.LOCK_NON_INTAKE === '1';
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24; // 24h

// Support token for temporary access (set this in Vercel env)
const SUPPORT_TOKEN = process.env.SUPPORT_TOKEN || 'AIISTAKINGOVERTHEWORLD';
const SUPPORT_COOKIE = 'support_ok';

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
// Public routes that never require auth
function isPublic(p: string) {
  // Public intake viewer + GAS endpoint + 404 page
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

function cookieExpired(req: NextRequest) {
  const tsStr = req.cookies.get('auth_ts')?.value;
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

export function middleware(req: NextRequest) {
  // Public Overnight Intake (render-only): allow GET/HEAD/OPTIONS without auth
  {
    const { pathname } = req.nextUrl;
    const method = req.method.toUpperCase();
    if ((pathname === '/intake/overnight' || pathname.startsWith('/intake/overnight/')) &&
        (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')) {
      return NextResponse.next();
    }
  }

  const { pathname, searchParams } = req.nextUrl;

  // Always allow static assets and explicitly public routes
  if (isAsset(pathname) || isPublic(pathname)) return NextResponse.next();

  // --- Support token bypass (for you/me to review site) ---
  // Grant access if ?support=SUPPORT_TOKEN, and persist for 24h via cookie.
  const supportParam = searchParams.get('support');
  const supportCookie = req.cookies.get(SUPPORT_COOKIE)?.value;
  if (supportParam === SUPPORT_TOKEN || supportCookie === SUPPORT_TOKEN) {
    const res = NextResponse.next();
    if (supportParam === SUPPORT_TOKEN && supportCookie !== SUPPORT_TOKEN) {
      res.cookies.set(SUPPORT_COOKIE, SUPPORT_TOKEN, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: MAX_AGE_S,
      });
    }
    return res;
  }
  // --------------------------------------------------------

  // If lock is off, let everything through
  if (!LOCK) return NextResponse.next();

  // If creds not configured, hide everything else
  if (!USER || !PASS) return NextResponse.rewrite(new URL('/404', req.url));

  // Basic auth for staff routes
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    return unauthorized();
  }

  // Valid creds -> refresh sliding session cookie
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

export const config = {
  matcher: ['/((?!_next/image).*)'],
};

