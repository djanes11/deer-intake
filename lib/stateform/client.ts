// lib/stateform/client.ts
// Client-side helpers for talking to our GAS proxy at /api/stateform/gas

type Json = Record<string, any>;

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.set(k, String(v));
  }
  return u.toString();
}

async function proxyGet(params: Record<string, any>): Promise<Json> {
  const url = `/api/stateform/gas?${qs(params)}`;
  const res = await fetch(url, { cache: "no-store" });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // noop
  }
  if (!res.ok || (json && json.ok === false)) {
    const msg = (json && (json.error || json.message)) || `GET ${url} failed (${res.status})`;
    throw new Error(msg);
  }
  return json ?? {};
}

async function proxyPost(body: Json): Promise<Json> {
  const res = await fetch("/api/stateform/gas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // noop
  }
  if (!res.ok || (json && json.ok === false)) {
    const msg = (json && (json.error || json.message)) || `POST ${body?.action || ""} failed (${res.status})`;
    throw new Error(msg);
  }
  return json ?? {};
}

/** Status: page number, count in buffer, capacity (44) */
export async function currentStateformStatus() {
  return proxyGet({ action: "stateform_status" });
}

/** List current staged rows (the 44-line buffer). */
export async function listDraft() {
  return proxyGet({ action: "stateform_list" });
}

/** Insert/update a single line in the 44-line buffer. `patch` is partial row fields. */
export async function upsertLine(lineNo: number, patch: Json) {
  return proxyPost({ action: "stateform_upsert_line", lineNo, patch });
}

/** Delete one line from the buffer. */
export async function deleteLine(lineNo: number) {
  return proxyPost({ action: "stateform_delete_line", lineNo });
}

/** Clear the entire current page (all 44 rows). */
export async function clearDraft() {
  return proxyPost({ action: "stateform_clear" });
}

/**
 * Add by Tag:
 * - If tag already staged, the server should return { ok:true, already:true, lineNo }
 * - If not, it fills the first empty slot and returns { ok:true, lineNo }
 * We *return* the server JSON so the page can scroll to that line.
 */
export async function appendFromTag(tag: string) {
  return proxyPost({ action: "stateform_append_from_tag", tag });
}

/** (Optional) Fetch the render payload (dry run) for debugging. */
export async function getPreviewPayload(dry = true) {
  return proxyGet({ action: "stateform_payload", dry: dry ? 1 : 0 });
}
