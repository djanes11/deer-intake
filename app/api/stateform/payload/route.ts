// app/api/stateform/payload/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const dry = (req.nextUrl.searchParams.get('dry') ?? '1') === '1';
    assertValidBase(GAS);
    const url =
      `${GAS}?action=stateform_payload&dry=${dry ? '1' : '0'}` +
      (TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : '');
    const res = await fetch(url, { cache: 'no-store' });
    const txt = await res.text();
    if (!res.ok) {
      return new NextResponse(`GAS stateform_payload failed: ${res.status} ${txt.slice(0,200)}`, { status: 502 });
    }
    return new NextResponse(txt, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err?.message || err}`, { status: 500 });
  }
}
