// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const BASIC_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_PASS = process.env.BASIC_AUTH_PASS || '';

function isAsset(p: string) {
  // Allow Next internals + common static files
  return (
    p.startsWith('/_next/') ||
    p === '/favicon.ico' ||
    p.startsWith('/assets/') ||
    /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|txt|map)$/.test(p)
  );
}

function isPublicPath(p: string) {
  // Publicly viewable *only* the intake link and API used by your app scripts
  return p.startsWith('/intake/') || p.startsWith('/api/gas2');
}

function basicAuthOk(req: NextRequest) {
  if (!BASIC_USER || !BASIC_PASS) return false;
  const hdr = req.headers.get('authorization') || '';
  if (!hdr.startsWith('Basic ')) return false;
  try {
    const [user, pass] = Buffer.from(hdr.slice(6), 'base64').toString().split(':');
    return user === BASIC_USER && pass === BASIC_PASS;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Everything else is blocked for the public.
  // If you want staff access, set BASIC_AUTH_USER/PASS and you'll get a 401 prompt.
  if (BASIC_USER && BASIC_PASS) {
    if (basicAuthOk(req)) return NextResponse.next();
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Restricted"' },
    });
  }

  // No staff creds configured → pretend it doesn't exist
  return NextResponse.rewrite(new URL('/404', req.url)); // or: return NextResponse.json({error:'Not found'}, {status:404})
}

export const config = {
  matcher: ['/((?!_next/image).*)'], // run on almost everything
};
