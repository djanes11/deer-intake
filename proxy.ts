import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';
const LOCK = process.env.LOCK_NON_INTAKE === '1';
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24;
const ADMIN_HOSTNAME = (process.env.ADMIN_HOSTNAME || 'admin.wildgamebutcherboard.com').trim().toLowerCase();

function normalizeHostname(input: string | null | undefined) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .split(',')[0]
    ?.split(':')[0] || '';
}

function isAsset(path: string) {
  return (
    path.startsWith('/_next/') ||
    path.startsWith('/favicon') ||
    path.startsWith('/public/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js|map)$/i.test(path)
  );
}

function parseBasicAuth(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return null;

  try {
    const [user, pass] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':', 2);
    return { user, pass };
  } catch {
    return null;
  }
}

function isReadOnlyIntake(req: NextRequest, path: string) {
  if (req.method === 'GET' && path.startsWith('/intake/')) return true;

  if (path.startsWith('/api/gas2')) {
    const referer = req.headers.get('referer') || '';
    try {
      const refererPath = new URL(referer, req.url).pathname || '';
      if (refererPath.startsWith('/intake/')) return true;
    } catch {
      // Ignore malformed referer values.
    }
  }

  return false;
}

function isPublicPath(path: string) {
  return (
    path === '/' ||
    path === '/drop' ||
    path === '/overnight' ||
    path === '/status' ||
    path === '/contact' ||
    path === '/hours' ||
    path === '/faq-public' ||
    path === '/help/overnight-qr' ||
    path === '/tips' ||
    path === '/intake/overnight' ||
    path.startsWith('/api/public-') ||
    path === '/api/public/site-settings'
  );
}

export function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;
  const host = normalizeHostname(req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host);

  if (!PUBLIC_MODE && host === ADMIN_HOSTNAME && path === '/') {
    const target = new URL('/admin', req.url);
    return NextResponse.redirect(target);
  }

  if (PUBLIC_MODE) {
    if (isAsset(path)) return NextResponse.next();
    return NextResponse.next();
  }

  if (isAsset(path)) return NextResponse.next();

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  if (isReadOnlyIntake(req, path)) {
    return NextResponse.next();
  }

  if (LOCK) {
    const creds = parseBasicAuth(req);
    if (!creds || creds.user !== USER || creds.pass !== PASS) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
      });
    }
  }

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

export const config = { matcher: ['/((?!_next/image).*)'] };
