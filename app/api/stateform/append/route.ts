// app/api/stateform/append/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GAS =
  process.env.API_BASE ||
  process.env.GAS_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '';

const TOKEN =
  process.env.API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.NEXT_PUBLIC_API_TOKEN ||
  '';

function assertValidBase(u: string) {
  if (!u || !/^https?:\/\//i.test(u)) {
    throw new Error('Missing/invalid Apps Script base URL. Set API_BASE (or GAS_BASE).');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertValidBase(GAS);
    const body = await req.json().catch(() => ({}));
    const res = await fetch(GAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stateform_append_from_tag', tag: body?.tag, token: TOKEN })
    });
    const txt = await res.text();
    if (!res.ok) {
      return new NextResponse(`GAS append failed: ${res.status} ${txt.slice(0,200)}`, { status: 502 });
    }
    return new NextResponse(txt, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err?.message || err}`, { status: 500 });
  }
}
