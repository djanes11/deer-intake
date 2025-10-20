// lib/stateform-data.ts

// === Types used by the page (keep these in sync with your GAS response) ===
export type StateformEntry = {
  dateIn?: string;
  dateOut?: string;
  name?: string;
  address?: string;
  phone?: string;
  sex?: string;
  whereKilled?: string;
  howKilled?: string;
  donated?: string;
  confirmation?: string;
};

export type StateformPayload = {
  ok: boolean;
  pageYear?: string;
  pageNumber?: number;
  processorName?: string;
  processorLocation?: string;
  processorCounty?: string;
  processorStreet?: string;
  processorCity?: string;
  processorZip?: string;
  processorPhone?: string;
  entries: StateformEntry[];
};

// === Env wiring (same pattern everywhere) ===
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.GAS_BASE ||
  process.env.API_BASE;

const API_TOKEN =
  process.env.NEXT_PUBLIC_API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.API_TOKEN;

function requireApiBase() {
  if (!API_BASE) {
    throw new Error('GAS_BASE / API_BASE / NEXT_PUBLIC_API_BASE is not set');
  }
}

function withToken(u: string) {
  return API_TOKEN ? `${u}&token=${encodeURIComponent(API_TOKEN)}` : u;
}

// === Public helpers ===

/**
 * Get the current staging payload for preview/print.
 * @param dry if true, do not consume rows (preview mode)
 */
export async function fetchStateformPayload(dry: boolean = true): Promise<StateformPayload> {
  requireApiBase();
  const url = withToken(`${API_BASE}?action=stateform_payload&dry=${dry ? '1' : '0'}`);

  const res = await fetch(url, { cache: 'no-store' });
  const txt = await res.text();

  if (!res.ok) {
    throw new Error(`stateform_payload failed: ${res.status} ${txt.slice(0, 200)}`);
  }

  let json: any;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error('stateform_payload returned non-JSON');
  }

  if (!json || json.ok !== true) {
    throw new Error(json?.error || 'stateform_payload returned not ok');
  }

  return json as StateformPayload;
}

/**
 * Set the (next) page number that the state form uses.
 * Requires an Apps Script POST handler at action=stateform_set_page.
 */
export async function setStateformPageNumber(page: number): Promise<{ ok: true; pageNumber: number }> {
  requireApiBase();
  const url = withToken(`${API_BASE}?action=stateform_set_page`);

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page }),
  });

  const txt = await res.text();

  if (!res.ok) {
    throw new Error(`stateform_set_page failed: ${res.status} ${txt.slice(0, 200)}`);
  }

  let json: any;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error('stateform_set_page returned non-JSON');
  }

  if (!json || json.ok !== true) {
    throw new Error(json?.error || 'stateform_set_page returned not ok');
  }

  return json as { ok: true; pageNumber: number };
}

