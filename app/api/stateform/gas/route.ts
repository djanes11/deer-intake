import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

function base() {
  const b = process.env.GAS_BASE || "";
  if (!/^https?:\/\//i.test(b)) throw new Error("Set GAS_BASE (full https URL to your GAS web app)");
  return b;
}
function tok() { return process.env.GAS_TOKEN || ""; }

async function gasGet(params: URLSearchParams) {
  const u = new URL(base());
  params.forEach((v, k) => u.searchParams.set(k, v));
  if (tok() && !u.searchParams.has("token")) u.searchParams.set("token", tok());
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(`GAS GET ${r.status}`);
  return r.json();
}
async function gasPost(action: string, body: any) {
  const u = new URL(base());
  u.searchParams.set("action", action);
  if (tok()) u.searchParams.set("token", tok());
  const r = await fetch(u.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GAS POST ${r.status}`);
  return r.json();
}

export async function GET(req: NextRequest) {
  try { return NextResponse.json(await gasGet(req.nextUrl.searchParams)); }
  catch (e: any) { return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    if (!action) return NextResponse.json({ ok:false, error:"Missing action" }, { status:400 });
    return NextResponse.json(await gasPost(action, body));
  } catch (e: any) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 });
  }
}
