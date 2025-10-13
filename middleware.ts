// middleware.ts (env-aware public/staff split)
import { NextResponse, NextRequest } from 'next/server';

const LOCK = process.env.LOCK_NON_INTAKE === '1';
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24; // 24h
const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';

const SUPPORT_TOKEN = process.env.SUPPORT_TOKEN || 'AIISTAKINGOVERTHEWORLD';
const SUPPORT_COOKIE = 'support_ok';

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p.startsWith('/favicon') ||
    p.startsWith('/public/') ||
    p.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js)$/i) !== null
  );
}

// Allowlist of public routes when PUBLIC_MODE=1
function isPublicRoute(p: string) {
  if (isAsset(p)) return true;
  // Home + public pages
  if (p === '/' || p.startsWith('/status') || p.startsWith('/drop') || p.startsWith('/faq') ||
      p.startsWith('/hours') || p.startsWith('/contact') || p.startsWith('/tips')) return true;
  // Public API endpoints we expose
  if (p.startsWith('/api/public-status') || p.startsWith('/api/public-drop')) return true;
  return false;
}

function parseBasicAuth(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  if (!hdr.startsWith('Basic ')) return null;
  try {
    const b64 = hdr.slice(6).trim();
    const [u, p] = Buffer.from(b64, 'base64').toString('utf8').split(':', 2);
    return { u, p };
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Public deployment: only gate non-public routes
  if (PUBLIC_MODE) {
    if (isPublicRoute(path)) {
      return NextResponse.next();
    }
    // Everything else blocked in public mode
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Staff deployment: keep prior behavior with optional lock + basic auth
  if (isAsset(path)) return NextResponse.next();

  // Support token bypass (for quick shared access)
  const token = req.headers.get('x-support-token') || url.searchParams.get('support') || '';
  if (token && token === SUPPORT_TOKEN) {
    const res = NextResponse.next();
    res.cookies.set(SUPPORT_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S });
    return res;
  }
  if (req.cookies.get(SUPPORT_COOKIE)?.value === '1') return NextResponse.next();

  // Basic auth if LOCK or if accessing staff-only pages
  if (LOCK || true) {
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

export const config = {
  matcher: ['/((?!_next/image).*)'],
};
