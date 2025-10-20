// lib/stateform-data.ts (proxy version: no client env needed)
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

export async function fetchStateformPayload(dry = true): Promise<StateformPayload> {
  const url = `/api/stateform/payload?dry=${dry ? '1' : '0'}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`stateform_payload failed: ${res.status} ${text.slice(0,200)} URL=${url}`);
  }
  return res.json();
}

export async function fetchStateformStatus(): Promise<any> {
  const url = `/api/stateform/payload?dry=1`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`stateform_status failed: ${res.status}`);
  return res.json();
}

export async function appendTagToStateform(tag: string): Promise<{ok:boolean; error?: string}> {
  const res = await fetch('/api/stateform/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`append_from_tag failed: ${res.status} ${text.slice(0,200)}`);
  }
  return res.json();
}
