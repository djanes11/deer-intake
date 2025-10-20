// lib/stateform-data.ts
// Helpers to talk to your Apps Script API for the State Form staging queue.
export type StateformEntry = {
  dateIn?: string; dateOut?: string; name?: string; address?: string; phone?: string;
  sex?: string; whereKilled?: string; howKilled?: string; donated?: string; confirmation?: string;
};

export type StateformPayload = {
  ok: boolean;
  pageYear: string;
  pageNumber: number;
  processorName: string;
  processorLocation: string;
  processorCounty: string;
  processorStreet: string;
  processorCity: string;
  processorZip: string;
  processorPhone: string;
  entries: StateformEntry[];
};

const GAS_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const GAS_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || process.env.NEXT_PUBLIC_API_KEY || '';

function withToken(url: string) {
  const sep = url.includes('?') ? '&' : '?';
  const tok = GAS_TOKEN ? `${sep}token=${encodeURIComponent(GAS_TOKEN)}` : '';
  return url + tok;
}

export async function fetchStateformPayload(dry = true): Promise<StateformPayload> {
  const url = withToken(`${GAS_BASE}?action=stateform_payload&dry=${dry ? '1' : '0'}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`stateform_payload failed: ${res.status}`);
  return res.json();
}

export async function fetchStateformStatus(): Promise<any> {
  const url = withToken(`${GAS_BASE}?action=stateform_status`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`stateform_status failed: ${res.status}`);
  return res.json();
}

export async function appendTagToStateform(tag: string): Promise<{ok:boolean; error?: string}> {
  const res = await fetch(GAS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stateform_append_from_tag', tag, token: GAS_TOKEN })
  });
  if (!res.ok) throw new Error(`append_from_tag failed: ${res.status}`);
  return res.json();
}
