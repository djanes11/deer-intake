// middleware.ts — Keep staff locked, but allow read-only intake where old emails point
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_MODE = process.env.PUBLIC_MODE === '1';
const LOCK = process.env.LOCK_NON_INTAKE === '1';
const USER = process.env.BASIC_AUTH_USER || '';
const PASS = process.env.BASIC_AUTH_PASS || '';
const REALM = 'Staff';
const MAX_AGE_S = 60 * 60 * 24;

function isAsset(p: string) {
  return (
    p.startsWith('/_next/') ||
    p.startsWith('/favicon') ||
    p.startsWith('/public/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot|css|js|map)$/i.test(p)
  );
}

function parseBasicAuth(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  if (!hdr.startsWith('Basic ')) return null;
  try {
    const [u, p] = Buffer.from(hdr.slice(6), 'base64').toString('utf8').split(':', 2);
    return { u, p };
  } catch { return null; }
}

// Is this request clearly part of a read-only intake view?
function isReadOnlyIntake(req: NextRequest, path: string) {
  // 1) The page itself: GET /intake/*
  if (req.method === 'GET' && path.startsWith('/intake/')) return true;

  // 2) The data call from that page: /api/gas2 with a Referer under /intake/*
  if (path.startsWith('/api/gas2')) {
    const ref = req.headers.get('referer') || '';
    try {
      const refPath = new URL(ref, req.url).pathname || '';
      if (refPath.startsWith('/intake/')) return true;
    } catch { /* ignore bad referer */ }
  }

  return false;
}

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // ── Public project: leave your existing public rules alone ──
  if (PUBLIC_MODE) {
    if (isAsset(path)) return NextResponse.next();
    // your existing allowlist here if you have one; otherwise just pass through
    return NextResponse.next();
  }

  // ── Staff project ─────────────────────────────────────────────────────────
  if (isAsset(path)) return NextResponse.next();

  // ✅ Read-only intake carve-out so old email links keep working
  if (isReadOnlyIntake(req, path)) {
    return NextResponse.next();
  }

  // Everything else stays behind basic auth (unchanged)
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

