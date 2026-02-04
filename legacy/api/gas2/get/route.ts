import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE;
const bad = (m:string,c=400)=>NextResponse.json({ok:false,error:m},{status:c});

export async function GET(req: Request) {
  if (!GAS_BASE) return bad('Missing NEXT_PUBLIC_GAS_BASE env', 500);
  const { searchParams } = new URL(req.url);
  const tag = String(searchParams.get('tag')||'').trim();
  if (!tag) return bad('Missing tag');
  const res = await fetch(`${GAS_BASE}?action=get&tag=${encodeURIComponent(tag)}`, { cache:'no-store' });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.ok===false) return bad(data?.error || `GAS error (${res.status})`, res.status||500);
  const exists = !!(data?.exists ?? data?.job ?? data?.record);
  const job = data?.job || data?.record || null;
  return NextResponse.json({ ok:true, exists, job });
}
