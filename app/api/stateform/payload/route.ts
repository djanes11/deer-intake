import { NextResponse } from 'next/server';

const GAS =
  process.env.API_BASE ||
  process.env.GAS_BASE ||
  process.env.NEXT_PUBLIC_API_BASE;

const TOKEN =
  process.env.API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.NEXT_PUBLIC_API_TOKEN;

function assertBase() {
  if (!GAS) throw new Error('Server env missing GAS_BASE / API_BASE');
}

export async function GET(req: Request) {
  try {
    assertBase();
    const { searchParams } = new URL(req.url);
    const dry = (searchParams.get('dry') ?? '1') === '1';
    const url =
      `${GAS}?action=stateform_payload&dry=${dry ? '1' : '0'}` +
      (TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : '');
    const res = await fetch(url, { cache: 'no-store' });
    const txt = await res.text();
    if (!res.ok) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: `GAS stateform_payload failed: ${res.status} ${txt.slice(0,200)}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Pass through the JSON from GAS
    return new NextResponse(txt, { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
