// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p === '/favicon.ico' ||
    p.startsWith('/assets/') ||
    /\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|txt|map)$/.test(p)
  );
}

function isAllowed(p: string) {
  return p.startsWith('/intake/') || p.startsWith('/api/gas2');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isAsset(pathname) || isAllowed(pathname)) return NextResponse.next();
  return NextResponse.rewrite(new URL('/404', req.url)); // silent block
}

export const config = { matcher: ['/((?!_next/image).*)'] };
