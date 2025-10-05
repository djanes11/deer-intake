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
    const txt = atob(b64); // Edge runtime has atob
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

// ---- Support bypass (token-based, sets a short-lived cookie) ----
const SUPPORT_TOKEN = process.env.SUPPORT_BYPASS_TOKEN || '';
const SUPPORT_COOKIE = 'support_bypass_ts';

function hasValidSupportCookie(req: NextRequest) {
  const tsStr = req.cookies.get(SUPPORT_COOKIE)?.value;
  if (!tsStr) return false;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  const age = Math.floor(Date.now() / 1000) - ts;
  return age <= MAX_AGE_S;
}


export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Always allow public routes and static assets
  if (isAsset(pathname) || isPublic(pathname)) return NextResponse.next();

  // ---- NEW: Support bypass gate (works even if LOCK=1) ----
  if (SUPPORT_TOKEN) {
    const supportParam = req.nextUrl.searchParams.get('support');
    // If a valid cookie already exists -> allow
    if (hasValidSupportCookie(req)) {
      const res = NextResponse.next();
      // refresh cookie rolling window
      res.cookies.set(SUPPORT_COOKIE, String(Math.floor(Date.now() / 1000)), {
        httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
      });
      return res;
    }
    // If a matching ?support=TOKEN is provided -> set cookie and allow
    if (supportParam && supportParam === SUPPORT_TOKEN) {
      const res = NextResponse.next();
      res.cookies.set(SUPPORT_COOKIE, String(Math.floor(Date.now() / 1000)), {
        httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
      });
      // Strip the token from the URL so it’s not leaked if copied
      const clean = new URL(req.url);
      clean.searchParams.delete('support');
      return NextResponse.redirect(clean);
    }
  }
  // ---- END NEW ----

  // No lock in this environment? Let everything through.
  if (!LOCK) return NextResponse.next();

  // If creds not configured, just hide everything else
  if (!USER || !PASS) return NextResponse.rewrite(new URL('/404', req.url));

  // Require Basic Auth for all other routes
  const creds = decodeBasicAuth(req.headers.get('authorization') || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    return unauthorized();
  }

  const res = NextResponse.next();
  // refresh rolling auth cookie window
  res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
  });
  return res;
}

  // Creds valid:
  const res = NextResponse.next();

  // If cookie missing or expired, set/refresh it and allow (NO 401 here)
  if (cookieExpired(req)) {
    res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: MAX_AGE_S,
    });
  } else {
    // also refresh on each valid hit to keep it rolling
    res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: MAX_AGE_S,
    });
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/image).*)'],
};
