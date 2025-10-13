// middleware.ts — Option A: support-token bypass in BOTH modes
import { NextRequest, NextResponse } from 'next/server';

// ───── Env flags ─────────────────────────────────────────────────────────────
const PUBLIC_MODE = process.env.PUBLIC_MODE === '1'; // public site vs staff
const LOCK = process.env.LOCK_NON_INTAKE === '1';    // staff basic-auth lock

const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';

const SUPPORT_TOKEN  = process.env.SUPPORT_TOKEN || 'AIISTAKINGOVERTHEWORLD';
const SUPPORT_COOKIE = 'support_ok';
const MAX_AGE_S = 60 * 60 * 24; // 24h

// ───── Helpers ───────────────────────────────────────────────────────────────
function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p.startsWith('/favicon') ||
    p.startsWith('/public/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js)$/i.test(p)
  );
}

// Public pages/APIs customers can hit without a token
function isPublicRoute(path: string) {
  if (isAsset(path)) return true;

  if (
    path === '/' ||
    path.startsWith('/status') ||
    path.startsWith('/drop') ||
    path.startsWith('/faq') ||          // keep if you have a public /faq
    path.startsWith('/faq-public') ||
    path.startsWith('/hours') ||
    path.startsWith('/contact') ||
    path.startsWith('/intake/overnight') || // QR/kiosk overnight intake
    // public APIs
    path.startsWith('/api/public-status') ||
    path.startsWith('/api/public-drop') ||
    // needed by public pages/forms under the same origin
    path.startsWith('/api/gas2')
  ) return true;

  return false;
}

function parseBasicAuth(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  if (!hdr.startsWith('Basic ')) return null;
  try {
    const [u, p] = Buffer.from(hdr.slice(6), 'base64').toString('utf8').split(':', 2);
    return { u, p };
  } catch {
    return null;
  }
}

// ───── Core middleware ───────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 🔓 Support-token bypass (works in BOTH modes)
  // Include ?support=<SUPPORT_TOKEN> in links, or send x-support-token header.
  const token = req.headers.get('x-support-token') || url.searchParams.get('support') || '';
  if (token && token === SUPPORT_TOKEN) {
    const res = NextResponse.next();
    res.cookies.set(SUPPORT_COOKIE, '1', {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
    });
    return res;
  }
  // Already validated via cookie? Let them through to anything.
  if (req.cookies.get(SUPPORT_COOKIE)?.value === '1') {
    return NextResponse.next();
  }

  // ── Public deployment: allow only public routes; redirect everything else ──
  if (PUBLIC_MODE) {
    if (isPublicRoute(path)) return NextResponse.next();
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── Staff deployment: keep assets open; guard the rest with basic auth ─────
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
  // small cookie to hint a recent auth (optional)
  res.cookies.set('auth_ts', String(Math.floor(Date.now() / 1000)), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: MAX_AGE_S,
  });
  return res;
}

// Apply to everything (except Next image optimizer path)
export const config = {
  matcher: ['/((?!_next/image).*)'],
};

