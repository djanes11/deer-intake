// lib/stateform/client.ts
export const GAS_BASE = process.env.GAS_BASE!;
const GAS_TOKEN = process.env.GAS_TOKEN || "";

async function gasGet(path: string) {
  const url = new URL(GAS_BASE);
  // path is like "action=stateform_payload&dry=1"
  path.split("&").forEach(kv => {
    const [k, v=""] = kv.split("=");
    if (k) url.searchParams.set(k, v);
  });
  if (GAS_TOKEN) url.searchParams.set("token", GAS_TOKEN);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`GAS error ${res.status}`);
  return res.json();
}

async function gasPost(action: string, body: any) {
  const url = new URL(GAS_BASE);
  url.searchParams.set("action", action);
  if (GAS_TOKEN) url.searchParams.set("token", GAS_TOKEN);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GAS error ${res.status}`);
  return res.json();
}

export async function getPreviewPayload() {
  return gasGet("action=stateform_payload&dry=1");
}

export async function getFlushPayload() {
  // Returns and clears buffer + increments page number
  return gasGet("action=stateform_payload&dry=0");
}

export async function appendFromTag(tag: string) {
  return gasPost("stateform_append_from_tag", { tag });
}

export async function currentStateformStatus() {
  return gasGet("action=stateform_status");
}
