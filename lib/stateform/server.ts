// lib/stateform/server.ts
import { NextRequest } from "next/server";

export async function gasGetServer(
  req: NextRequest,
  q: Record<string, string | number | boolean | undefined>
) {
  const url = new URL("/api/stateform/gas", req.url); // absolute
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(`Proxy GET ${r.status}`);
  return r.json();
}

export async function gasPostServer(
  req: NextRequest,
  body: Record<string, any>
) {
  const url = new URL("/api/stateform/gas", req.url);
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Proxy POST ${r.status}`);
  return r.json();
}
