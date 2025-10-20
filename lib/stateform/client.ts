// lib/stateform/client.ts
type AnyRec = Record<string, any>;

async function proxyGet(q: Record<string, string|number|boolean|undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const res = await fetch(`/api/stateform/gas?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Proxy GET ${res.status}`);
  return res.json();
}

async function proxyPost(action: string, body: AnyRec) {
  const res = await fetch(`/api/stateform/gas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...(body || {}) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Proxy POST ${res.status}`);
  return res.json();
}

// Existing endpoints
export const getPreviewPayload       = () => proxyGet({ action: "stateform_payload", dry: 1 });
export const getFlushPayload         = () => proxyGet({ action: "stateform_payload", dry: 0 });
export const appendFromTag           = (tag: string) => proxyPost("stateform_append_from_tag", { tag });
export const currentStateformStatus  = () => proxyGet({ action: "stateform_status" });

// Buffer CRUD
export const listDraft  = () => proxyGet({ action: "stateform_list" });
export const upsertLine = (lineNo: number, fields: AnyRec) => proxyPost("stateform_upsert", { lineNo, fields });
export const deleteLine = (lineNo: number) => proxyPost("stateform_delete", { lineNo });
export const clearDraft = () => proxyPost("stateform_clear", {});
