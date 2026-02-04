// app/api/gas2/route.ts
// LEGACY COMPAT ROUTE
// This endpoint used to proxy to Google Apps Script (Sheets).
// It now forwards requests to the Supabase-backed API at /api/v2/jobs
// so older client code keeps working while we migrate/clean up.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getToken(req: NextRequest) {
  // Support both old query token patterns and new header token
  const url = new URL(req.url);
  return (
    req.headers.get('x-api-token') ||
    url.searchParams.get('token') ||
    null
  );
}

function forwardHeaders(req: NextRequest): HeadersInit {
  const token = getToken(req);
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) h['x-api-token'] = token;
  return h;
}

export async function GET(req: NextRequest) {
  const urlIn = new URL(req.url);
  const action = urlIn.searchParams.get('action') || 'ping';

  // Build /api/v2/jobs URL
  const url = new URL(urlIn.origin + '/api/v2/jobs');
  // copy all query params except legacy token
  urlIn.searchParams.forEach((v, k) => {
    if (k === 'token') return;
    url.searchParams.set(k, v);
  });
  // ensure action exists
  if (!url.searchParams.get('action')) url.searchParams.set('action', action);

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
  });

  const text = await r.text();
  // pass through as-is
  return new Response(text, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('content-type') || 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  const urlIn = new URL(req.url);
  const body = await req.json().catch(() => ({} as any));

  // Normalize a couple legacy action names to v2
  const rawAction = String(body?.action || '').trim();
  const a = rawAction.toLowerCase();

  // legacy gas2 used: markCalled (camel) -> v2 expects markcalled normalization
  if (a === 'markcalled' || a === 'mark_called' || a === 'mark-called' || a === 'markcalled') {
    body.action = 'markcalled';
  } else if (a === 'logcall' || a === 'log-call' || a === 'call') {
    body.action = 'log-call';
  }

  // Forward to /api/v2/jobs
  const url = new URL(urlIn.origin + '/api/v2/jobs');
  // preserve query params (except token)
  urlIn.searchParams.forEach((v, k) => {
    if (k === 'token') return;
    url.searchParams.set(k, v);
  });

  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: forwardHeaders(req),
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('content-type') || 'application/json' },
  });
}
