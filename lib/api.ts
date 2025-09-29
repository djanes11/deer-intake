const BASE = '/api/gas2';

export type GetJobResp = { ok: boolean; exists: boolean; job?: any; error?: string };
export type SaveResp   = { ok: boolean; error?: string; row?: number };
export type ProgressResp = { ok: boolean; nextStatus?: 'Processing'|'Finished'|null; error?: string };
export type SearchJobsResp = { ok: boolean; rows: any[]; total?: number; error?: string };

async function fetchJson(url: string, init?: RequestInit, attempts = 3, timeoutMs = 7000) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal });
      clearTimeout(to);
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      lastErr = data?.error || `HTTP ${res.status}`;
      // retry on transient
      if ([429, 502, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, 250*(i+1))); continue; }
      break;
    } catch (e:any) {
      clearTimeout(to);
      lastErr = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || e);
      await new Promise(r => setTimeout(r, 250*(i+1)));
    }
  }
  return { ok: false, error: String(lastErr || 'Network error') };
}

export async function getJob(tag: string): Promise<GetJobResp> {
  return fetchJson(`${BASE}/get?tag=${encodeURIComponent(tag)}`);
}

export async function saveJob(job: any): Promise<SaveResp> {
  return fetchJson(`${BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ job })
  });
}

export async function progress(tag: string): Promise<ProgressResp> {
  return fetchJson(`${BASE}/progress`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ tag })
  });
}

export async function searchJobs(
  opts?: string | { q?: string; status?: string; limit?: number; offset?: number }
): Promise<SearchJobsResp> {
  const o = typeof opts === 'string' ? { q: opts } : (opts || {});
  const p = new URLSearchParams();
  if (o.q) p.set('q', o.q);
  if (o.status) p.set('status', o.status);
  if (o.limit != null) p.set('limit', String(o.limit));
  if (o.offset != null) p.set('offset', String(o.offset));
  return fetchJson(`${BASE}/search?${p.toString()}`);
}

