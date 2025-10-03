// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const LOCKDOWN = process.env.LOCKDOWN === '1';           // turn on in prod only
const STAFF_SECRET = process.env.STAFF_SECRET || '';     // set this in Vercel env

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

function isAllowedPublic(p: string) {
  // Publicly viewable routes
  return (
    p === '/404' ||                   // allow the 404 page to render
    p.startsWith('/intake/') ||
    p.startsWith('/api/gas2')
  );
}

function staffBypass(req: NextRequest) {
  // If no secret set, no bypass (keeps things simple)
  if (!STAFF_SECRET) return false;

  // 1) cookie
  const cookie = req.cookies.get('staff_ok')?.value;
  if (cookie && cookie === '1') return true;

  // 2) one-time query param ?s=SECRET to set cookie
  const url = new URL(req.url);
  const s = url.searchParams.get('s');
  if (s && s === STAFF_SECRET) {
    const res = NextResponse.next();
    res.cookies.set('staff_ok', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });
    // strip ?s=... from URL
    url.searchParams.delete('s');
    res.headers.set('Location', url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
    return res;
  }
  return false;
}

export function middleware(req: NextRequest) {
  // Don’t lock down unless explicitly enabled
  if (!LOCKDOWN) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow assets + the public pages
  if (isAsset(pathname) || isAllowedPublic(pathname)) {
    return NextResponse.next();
  }

  // Staff bypass (cookie or one-time ?s=SECRET)
  const bypass = staffBypass(req);
  if (bypass instanceof NextResponse) return bypass; // handled (cookie set + redirect)
  if (bypass === true) return NextResponse.next();

  // Everyone else → 404
  return NextResponse.rewrite(new URL('/404', req.url));
}

// Run broadly, but skip the Next image optimizer path
export const config = { matcher: ['/((?!_next/image).*)'] };
