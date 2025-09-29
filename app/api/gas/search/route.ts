import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE;
function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

async function doSearch(q:string, status:string, limit:string, offset:string){
  const url = (GAS_BASE as string) + `?action=search`
    + (q ? `&q=${encodeURIComponent(q)}` : '')
    + (status ? `&status=${encodeURIComponent(status)}` : '')
    + (limit ? `&limit=${encodeURIComponent(limit)}` : '')
    + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
  const res = await fetch(url, { cache:'no-store' });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.ok===false) return bad(data?.error || `GAS error (${res.status})`, res.status || 500);
  const rows = data?.rows || data?.results || data?.items || [];
  const total = data?.total ?? data?.count;
  return NextResponse.json({ ok:true, rows, total });
}

export async function GET(req: Request) {
  if (!GAS_BASE) return bad('Missing NEXT_PUBLIC_GAS_BASE env', 500);
  const { searchParams } = new URL(req.url);
  return doSearch(
    String(searchParams.get('q')||''),
    String(searchParams.get('status')||''),
    String(searchParams.get('limit')||''),
    String(searchParams.get('offset')||''),
  );
}

