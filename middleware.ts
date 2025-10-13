// middleware.ts — whitelist read-only intake links
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';
const LOCK = process.env.LOCK_NON_INTAKE === '1';

const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';

const SUPPORT_COOKIE = 'support_ok';
const MAX_AGE_S = 60 * 60 * 24; // 24h

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p.startsWith('/favicon') ||
    p.startsWith('/public/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js|map)$/i.test(p)
  );
}

// Public pages/APIs customers can hit without auth
function isPublicRoute(path: string, url: URL) {
  if (isAsset(path)) return true;

  // Normal customer pages
  if (
    path === '/' ||
    path.startsWith('/status') ||
    path.startsWith('/drop') ||
    path.startsWith('/faq') ||          // keep if you have a public /faq
    path.startsWith('/faq-public') ||
    path.startsWith('/hours') ||
    path.startsWith('/contact') ||
    path.startsWith('/intake/overnight') ||
    // public APIs
    path.startsWith('/api/public-status') ||
    path.startsWith('/api/public-drop') ||
    // internal API used by various forms/pages
    path.startsWith('/api/gas2')
  ) return true;

  // ✅ Read-only intake link from email:
  // allow /intake/<tag> iff it has a token (?t=...) or explicit read-only flag (?ro=1)
  if (path.startsWith('/intake/')) {
    const hasToken = !!url.searchParams.get('t');   // the page verifies HMAC(token) server-side
    const isRO     = url.searchParams.get('ro') === '1';
    if (hasToken || isRO) return true;
  }

  return false;
}

function parseBasicAuth(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  if (!hdr.startsWith('Basic ')) return null;
  try {
    const [u, p] = Buffer.from(hdr.slice(6), 'base64').toString('utf8').split(':', 2);
    return { u, p };
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // If you previously set a support cookie, honor it (no change to your flow)
  if (req.cookies.get(SUPPORT_COOKIE)?.value === '1') {
    return NextResponse.next();
  }

  // ── PUBLIC DEPLOYMENT ──
  if (PUBLIC_MODE) {
    if (isPublicRoute(path, url)) return NextResponse.next();
    // Everything else → home
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── STAFF DEPLOYMENT ──
  if (isAsset(path)) return NextResponse.next();

  if (LOCK) {
    const creds = parseBasicAuth(req);
    if (!creds || creds.u !== USER || creds.p !== PASS) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
      });
    }
  }

  const res = NextResponse.next();
  res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
  });
  return res;
}

export const config = { matcher: ['/((?!_next/image).*)'] };

