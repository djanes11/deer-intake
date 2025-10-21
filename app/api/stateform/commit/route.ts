// app/api/stateform/commit/route.ts
import { NextResponse } from "next/server";

const GAS =
  process.env.API_BASE ||
  process.env.GAS_BASE ||
  process.env.NEXT_PUBLIC_API_BASE;

const TOKEN =
  process.env.API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.NEXT_PUBLIC_API_TOKEN;

function assertValidBase(url?: string) {
  if (!url) throw new Error("Missing GAS_BASE / API_BASE / NEXT_PUBLIC_API_BASE");
}

async function commitPage(): Promise<any> {
  assertValidBase(GAS);
  const url = `${GAS}?action=stateform_payload&dry=0${
    TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GAS commit failed: ${res.status} ${txt.slice(0,200)}`);
  try { return JSON.parse(txt); } catch { return { ok: true }; }
}

export async function POST() {
  try {
    const json = await commitPage();
    return NextResponse.json(json);
  } catch (err: any) {
    return new NextResponse(`Commit error: ${err?.message || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
