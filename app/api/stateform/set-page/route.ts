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

export async function POST(req: Request) {
  try {
    assertBase();
    const body = await req.json().catch(() => ({}));
    const page = Number(body?.page);
    if (!(page > 0 && Number.isFinite(page))) {
      return NextResponse.json({ ok: false, error: 'invalid page' }, { status: 400 });
    }

    const url =
      `${GAS}?action=stateform_set_page` +
      (TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : '');

    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    });

    const txt = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `GAS stateform_set_page failed: ${res.status} ${txt.slice(0,200)}` },
        { status: 500 }
      );
    }
    return new NextResponse(txt, { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
