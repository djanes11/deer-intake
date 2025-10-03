// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

// Toggle lock (set LOCK_NON_INTAKE=1 in prod). Leave unset in dev if you want no lock.
const LOCK = process.env.LOCK_NON_INTAKE === '1';

const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';                    // shows in the browser prompt
const MAX_AGE_S = 60 * 60 * 24;           // 24 hours

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
  // PUBLIC: intake view + your gas endpoint + 404 page itself + assets
  return p.startsWith('/intake/') || p.startsWith('/api/gas2') || p === '/404';
}

function decodeBasicAuth(h: string): { user: string; pass: string } | null {
  // h looks like: "Basic base64(user:pass)"
  if (!h?.startsWith('Basic ')) return null;
  const b64 = h.slice(6).trim();
  try {
    // atob is available in the Edge runtime
    const txt = atob(b64);
    const idx = txt.indexOf(':');
    if (idx < 0) return null;
    return { user: txt.slice(0, idx), pass: txt.slice(idx + 1) };
  } catch {
    return null;
  }
}

function needPrompt(req: NextRequest): boolean {
  // Force a re-prompt every 24h by requiring a fresh auth_ts cookie
  const tsStr = req.cookies.get('auth_ts')?.value;
  if (!tsStr) return true;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return true;
  const age = Math.floor(Date.now() / 1000) - ts;
  return age > MAX_AGE_S;
}

function unauthorized(realm = REALM) {
  // Return 401 to trigger browser Basic Auth prompt
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"` },
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always let assets and the public pages through
  if (isAsset(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  // If not locking (e.g., in Preview/Dev), pass-through
  if (!LOCK) return NextResponse.next();

  // If no creds configured, silently 404 the rest of the site
  if (!USER || !PASS) {
    return NextResponse.rewrite(new URL('/404', req.url));
  }

  // Protected route: require Basic Auth
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    return unauthorized();
  }

  // Valid creds. If cookie expired/missing, force a one-time re-prompt (401).
  // After the user submits creds, we’ll set a fresh cookie and allow.
  if (needPrompt(req)) {
    return unauthorized(REALM);
  }

  // Fresh enough: allow and refresh cookie TTL silently
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
  // Run on most paths; skipping the image optimizer keeps noise down
  matcher: ['/((?!_next/image).*)'],
};
