// lib/stateform-data.ts

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

/**
 * Fetch payload through our server proxy so the client never needs env vars.
 */
export async function fetchStateformPayload(dry: boolean = true): Promise<StateformPayload> {
  const url = `/api/stateform/payload?dry=${dry ? '1' : '0'}`;
  const res = await fetch(url, { cache: 'no-store' });
  const txt = await res.text();

  if (!res.ok) {
    throw new Error(`stateform_payload failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  let json: any;
  try { json = JSON.parse(txt); } catch { throw new Error('stateform_payload returned non-JSON'); }
  if (!json?.ok) throw new Error(json?.error || 'stateform_payload returned not ok');
  return json as StateformPayload;
}

/**
 * Set page number via our server proxy (POST).
 */
export async function setStateformPageNumber(page: number): Promise<{ ok: true; pageNumber: number }> {
  const res = await fetch('/api/stateform/set-page', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`stateform_set_page failed: ${res.status} ${txt.slice(0, 200)}`);
  let json: any;
  try { json = JSON.parse(txt); } catch { throw new Error('stateform_set_page returned non-JSON'); }
  if (!json?.ok) throw new Error(json?.error || 'stateform_set_page returned not ok');
  return json as { ok: true; pageNumber: number };
}

