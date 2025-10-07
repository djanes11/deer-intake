// lib/api.ts
// Single client-side entrypoint for talking to our Next API proxy (/api/gas2),
// which in turn talks to Google Apps Script (GAS).
// Preserves previous helpers (getJob, saveJob, progress, searchJobs)
// and adds markCalled + logCallSimple used by the Calls report.
//
// NOTE: Do NOT call GAS directly from the browser. Always go through /api/gas2.
// That keeps your token server-side and lets the server add signatures, links, etc.

export type AnyRec = Record<string, any>;
type Json = Record<string, any>;

const API_BASE = '/api/gas2';

// Keep Job super loose to avoid cross-file literal-union collisions.
export type Job = AnyRec & { tag?: string };

export interface SaveResponse {
  ok: boolean;
  row?: number;
  error?: string;
  // echo from GAS
  job?: Job;
  exists?: boolean;
  // anything else GAS returns
  [k: string]: any;
}

export interface GetResponse {
  ok?: boolean;        // GAS "get" usually returns {exists, job}
  exists: boolean;
  job?: Job;
  [k: string]: any;
}

export interface SearchOptions {
  limit?: number;
  status?: string;
  scope?: 'auto' | 'meat' | 'cape' | 'webbs' | 'all';
  // free-form passthrough for future filters
  [k: string]: any;
}

// Accept object-style queries as well as plain string
export type SearchParams = {
  status?: string;
  tag?: string;
  limit?: number;
  q?: string;
  [k: string]: any;
};

// ----------- low-level fetch helpers (no-cache, JSON-safe) -----------
async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  const text = await r.text();
  try {
    const json = JSON.parse(text);
    if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
    return json as T;
  } catch {
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return text as unknown as T;
  }
}

async function postJSON<T = any>(body: AnyRec): Promise<T> {
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try {
    const json = JSON.parse(text);
    if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
    return json as T;
  } catch {
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return text as unknown as T;
  }
}

// ---------------- public API used across the app ----------------

/** Read a single job by tag (proxied through /api/gas2 → GAS) */
export async function getJob(tag: string): Promise<GetResponse> {
  if (!tag) throw new Error('Missing tag');
  const qs = new URLSearchParams({ action: 'get', tag });
  return getJSON<GetResponse>(`${API_BASE}?${qs.toString()}`);
}

/**
 * Save a job (create or update).
 * - Regular intake: include a real tag → upsert-by-tag.
 * - Overnight intake: send `{ requiresTag: true, tag: '' }` → server appends w/ "Requires Tag".
 *
 * IMPORTANT: We intentionally do NOT validate `job.tag` here.
 * The /api/gas2 route decides whether blank-tag is allowed.
 */
export async function saveJob(job: Job): Promise<SaveResponse> {
  if (!job) throw new Error('Missing job');
  return postJSON<SaveResponse>({ action: 'save', job });
}

/**
 * Progress a job.
 * Accepts either:
 *   - progress('ABC123')                 // bare tag → server auto-advances
 *   - progress({ tag: 'ABC123' })        // same as above
 *   - progress({ tag: 'ABC123', status: 'Finished' }) // force status
 */
export async function progress(
  arg: string | { tag: string; status?: string }
): Promise<{ ok?: boolean; nextStatus?: string } & Json> {
  if (typeof arg === 'string') {
    return postJSON({ action: 'progress', tag: arg });
  }
  const { tag, status } = arg;
  const body: any = { action: 'progress', tag };
  if (status) body.status = status;
  return postJSON(body);
}

/** Search jobs. Use q='@report' to fetch the "ready to call" report. */
export async function searchJobs(q: string | SearchParams, opts: SearchOptions = {}): Promise<any> {
  const params = new URLSearchParams({ action: 'search' });

  if (typeof q === 'string') {
    params.set('q', q || '');
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.status) params.set('status', opts.status);
    if (opts.scope) params.set('scope', opts.scope);
    Object.keys(opts).forEach((k) => {
      if (['limit', 'status', 'scope'].includes(k)) return;
      const v = (opts as AnyRec)[k];
      if (v != null) params.set(k, String(v));
    });
    return getJSON<any>(`${API_BASE}?${params.toString()}`);
  }

  // object-mode: copy known filters and any extras; allow opts to override
  const merged: Record<string, any> = { ...(q || {}), ...(opts || {}) };
  if (merged.q != null) params.set('q', String(merged.q));
  if (merged.status != null) params.set('status', String(merged.status));
  if (merged.tag != null) params.set('tag', String(merged.tag));
  if (merged.limit != null) params.set('limit', String(merged.limit));
  if (merged.scope != null) params.set('scope', String(merged.scope));
  Object.keys(merged).forEach((k) => {
    if (['q', 'status', 'tag', 'limit', 'scope'].includes(k)) return;
    const v = merged[k];
    if (v != null) params.set(k, String(v));
  });
  return getJSON<any>(`${API_BASE}?${params.toString()}`);
}

/** Mark Called with scope: 'auto' | 'meat' | 'cape' | 'webbs' | 'all' */
export async function markCalled(arg1: any, arg2?: any) {
  // Supports: markCalled({ tag, scope, notes })
  // or legacy: markCalled(tag, scope?)
  let payload: any;
  if (typeof arg1 === 'object' && arg1) {
    const { tag, scope, notes } = arg1 as any;
    if (!tag) throw new Error('Missing tag');
    payload = { action: 'markCalled', tag, scope, notes };
  } else {
    const tag = arg1 as string;
    const scope = (arg2 as any) || 'auto';
    if (!tag) throw new Error('Missing tag');
    payload = { action: 'markCalled', tag, scope };
  }
  return postJSON<SaveResponse>(payload);
}

/** Add a simple “attempt + note” row; does NOT flip any status by itself. */
export async function logCallSimple(arg1: any, arg2?: any, arg3?: any, arg4?: any) {
  // Supports: logCallSimple({ tag, scope, reason, notes, who, outcome })
  // or legacy: logCallSimple(tag, note, who?, outcome?)
  let payload: any;
  if (typeof arg1 === 'object' && arg1) {
    const { tag, scope, reason, notes, who, outcome } = arg1 as any;
    if (!tag) throw new Error('Missing tag');
    payload = { action: 'log-call', tag, scope, reason, notes, who, outcome };
  } else {
    const tag = arg1 as string;
    const note = (arg2 ?? '') as string;
    const who = arg3 as string | undefined;
    const outcome = arg4 as string | undefined;
    if (!tag) throw new Error('Missing tag');
    payload = { action: 'log-call', tag, notes: note, who, outcome };
  }
  return postJSON<SaveResponse>(payload);
}

// ---------------- convenience utilities ----------------

/** Cheap boolean parser that matches our server-side semantics. */
export function asBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'on', 'paid', 'x', '✓', '✔'].includes(s);
}

/** Normalize process type to one of our canonical labels (string in, string out). */
export function normProc(s?: string): string {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}

/** Client-side mirror of the processing price logic (for previews only). */
export function suggestedProcessingPrice(proc?: string, beef?: boolean, webbs?: boolean): number {
  const p = normProc(proc) || '';
  const base =
    p === 'Caped' ? 150
    : p === 'Cape & Donate' ? 50
    : p === 'Donate' ? 0
    : (['Standard Processing', 'Skull-Cap', 'European'] as string[]).includes(p) ? 130
    : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}


/** Fetch a full flat row for the overlay (server returns { ok, job }) */
export async function getJobFull(tag: string) {
  const r = await fetch('/api/gas2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'job', tag }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`getJobFull failed: ${r.status}`);
  const j = await r.json();
  return j?.job ?? null;
}
