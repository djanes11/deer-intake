// lib/stateform/client.ts (editor-first)
// Uses server proxy at /api/stateform/gas. Keep GAS URL/TOKEN server-only.

type AnyRec = Record<string, any>;

async function proxyGet(q: Record<string, string|number|boolean|undefined>) {
  const u = new URL("/api/stateform/gas", window.location.origin);
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(`Proxy GET ${r.status}`);
  return r.json();
}
async function proxyPost(action: string, body: AnyRec) {
  const r = await fetch("/api/stateform/gas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...(body||{}) }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Proxy POST ${r.status}`);
  return r.json();
}

// --- existing render/status endpoints ---
export const getPreviewPayload = () => proxyGet({ action: "stateform_payload", dry: 1 });
export const getFlushPayload   = () => proxyGet({ action: "stateform_payload", dry: 0 });
export const appendFromTag     = (tag: string) => proxyPost("stateform_append_from_tag", { tag });
export const currentStateformStatus = () => proxyGet({ action: "stateform_status" });

// --- new CRUD for the buffer ---
export const listDraft = () => proxyGet({ action: "stateform_list" });
export const upsertLine = (lineNo: number, fields: AnyRec) => proxyPost("stateform_upsert", { lineNo, fields });
export const deleteLine = (lineNo: number) => proxyPost("stateform_delete", { lineNo });
export const clearDraft = () => proxyPost("stateform_clear", {});
