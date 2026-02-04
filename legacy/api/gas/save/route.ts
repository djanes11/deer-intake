import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE;
const bad = (m:string,c=400)=>NextResponse.json({ok:false,error:m},{status:c});

export async function POST(req: Request) {
  if (!GAS_BASE) return bad('Missing NEXT_PUBLIC_GAS_BASE env', 500);
  let body:any=null; try{ body=await req.json(); }catch{}
  const job = body?.job || body;
  if (!job?.tag) return bad('Missing job.tag');

  const res = await fetch(GAS_BASE+'?action=save', {
    method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
    body: JSON.stringify({ job }),
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.ok===false) return bad(data?.error || `GAS error (${res.status})`, res.status||500);

  const r = NextResponse.json({ ok:true, ...data });
  r.headers.set('X-Route','save-v2'); // fingerprint
  return r;
}

