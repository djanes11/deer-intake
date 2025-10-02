// app/api/gas2/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GAS_BASE = process.env.GAS_BASE!;
const GAS_TOKEN = process.env.GAS_TOKEN!;

function buildGetUrl(params: URLSearchParams) {
  const url = new URL(GAS_BASE);
  // forward all incoming params
  for (const [k, v] of params) url.searchParams.set(k, v);
  // inject token as query param (what GAS expects)
  url.searchParams.set('token', GAS_TOKEN);
  return url.toString();
}

export async function GET(req: NextRequest) {
  try {
    const url = buildGetUrl(req.nextUrl.searchParams);
    const r = await fetch(url, { cache: 'no-store' });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'proxy GET failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) || {};
    // inject token into body
    const payload = { ...body, token: GAS_TOKEN };
    const r = await fetch(GAS_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'proxy POST failed' }, { status: 500 });
  }
}

