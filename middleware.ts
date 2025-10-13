// middleware.ts — keep existing behavior; whitelist read-only intake views
import { NextResponse, NextRequest } from 'next/server';

const LOCK = process.env.LOCK_NON_INTAKE === '1';
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24; // 24h
const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p.startsWith('/favicon') ||
    p.startsWith('/public/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js|map)$/i.test(p)
  );
}

// Public pages/APIs customers can hit without auth
function isPublicRoute(path: string) {
  if (isAsset(path)) return true;
  if (
    path === '/' ||
    path.startsWith('/status') ||
    path.startsWith('/drop') ||
    path.startsWith('/faq') ||
    path.startsWith('/faq-public') ||
    path.startsWith('/hours') ||
    path.startsWith('/contact') ||
    path.startsWith('/intake/overnight') ||
    // public APIs
    path.startsWith('/api/public-status') ||
    path.startsWith('/api/public-drop') ||
    // needed by public pages/forms
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
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // ── PUBLIC DEPLOYMENT ────────────────────────────────────────────────────
  if (PUBLIC_MODE) {
    // 1) allow standard public routes
    if (isPublicRoute(path)) return NextResponse.next();

    // 2) WHITELIST: read-only intake views from email — GETs only
    if (req.method === 'GET' && path.startsWith('/intake/')) {
      // This lets old emails keep working without adding tokens/params.
      // Editing is still blocked because POST/PUT/PATCH/DELETE are not allowed here.
      return NextResponse.next();
    }

    // 3) everything else → home
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── STAFF DEPLOYMENT (unchanged) ─────────────────────────────────────────
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

export const config = {
  matcher: ['/((?!_next/image).*)'],
};

