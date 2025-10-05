// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

// Turn lock on only where you want it (e.g., Production)
const LOCK = process.env.LOCK_NON_INTAKE === '1';

const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24; // 24h

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
  // Public: intake view + gas endpoint + 404 page itself
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
  const { pathname, searchParams } = req.nextUrl;

  // Always allow public routes and static assets
  if (isAsset(pathname) || isPublic(pathname)) return NextResponse.next();

  // --- Support bypass (read-only audit) ---
  // If you want me to browse the app: append ?support=AIISTAKINGOVERTHEWORLD
  // This bypasses auth only for the specific request with that query string.
  const supportKey = searchParams.get('support');
  if (supportKey === 'AIISTAKINGOVERTHEWORLD') {
    return NextResponse.next();
  }
  // ---------------------------------------

  // No lock in this environment? Let everything through.
  if (!LOCK) return NextResponse.next();

  // If creds not configured, hide everything else
  if (!USER || !PASS) return NextResponse.rewrite(new URL('/404', req.url));

  // Require Basic Auth for all other routes
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    return unauthorized();
  }

  // Creds valid:
  const res = NextResponse.next();

  // Issue/refresh a short-lived cookie so the browser doesn't re-prompt constantly
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

