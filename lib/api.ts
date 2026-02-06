// lib/api.ts
// Single client-side entrypoint for talking to our Next API.
// NOW points to /api/v2/jobs (Supabase-backed) instead of /api/gas2 (GAS/Sheets).
//
// NOTE:
// - Frontend should NOT talk to Supabase directly.
// - Frontend calls /api/v2/jobs; server uses service role + lib/jobsSupabase.ts.
//
// Auth:
// - Sends token via header: x-api-token
// - Optionally supports query token on server for backward compatibility.

export type AnyRec = Record<string, any>;
type Json = Record<string, any>;

// ---------- CONFIG ----------
/**
 * Optional kill-switch:
 * Set NEXT_PUBLIC_USE_SUPABASE=1 to use Supabase API, otherwise fallback to legacy /api/gas2.
 * If you don't need fallback, you can hardcode '/api/v2/jobs'.
 */
const USE_SUPABASE =
  (process.env.NEXT_PUBLIC_USE_SUPABASE || '1').trim() === '1';

const API_BASE = USE_SUPABASE ? '/api/v2/jobs' : '/api/gas2';

// Keep Job super loose to avoid cross-file literal-union collisions.
export type Job = AnyRec & { tag?: string | null };

export interface SaveResponse {
  ok: boolean;
  row?: number;
  error?: string;
  job?: Job;
  exists?: boolean;
  [k: string]: any;
}

export interface GetResponse {
  ok?: boolean;
  exists: boolean;
  job?: Job;
  [k: string]: any;
}

export interface SearchOptions {
  limit?: number;
  status?: string;
  scope?: 'auto' | 'meat' | 'cape' | 'webbs' | 'all';
  [k: string]: any;
}

export type SearchParams = {
  status?: string;
  tag?: string | null;
  limit?: number;
  q?: string;
  [k: string]: any;
};

// ---------- TOKEN HEADER ----------
function tokenHeader(): Record<string, string> {
  // Put this in Vercel for the *facility* deployment only.
  // Do NOT put this in your public app env.
  const t = (process.env.NEXT_PUBLIC_DEER_API_TOKEN || '').trim();
  return t ? { 'x-api-token': t } : {};
}

// ----------- low-level fetch helpers (no-cache, JSON-safe) -----------
async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url, {
    cache: 'no-store',
    headers: {
      ...tokenHeader(),
    },
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

async function postJSON<T = any>(body: AnyRec): Promise<T> {
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...tokenHeader(),
    },
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

/** Read a single job by tag */
export async function getJob(tag: string): Promise<GetResponse> {
  if (!tag) throw new Error('Missing tag');
  const qs = new URLSearchParams({ action: 'get', tag });
  return getJSON<GetResponse>(`${API_BASE}?${qs.toString()}`);
}

/**
 * Save a job (create or update).
 * - Regular intake: include a real tag → upsert-by-tag.
 * - Overnight intake: send `{ requiresTag: true, tag: '' }` → server marks Requires Tag.
 */
export async function saveJob(job: Job): Promise<SaveResponse> {
  if (!job) throw new Error('Missing job');
  return postJSON<SaveResponse>({ action: 'save', job });
}

/**
 * Progress a job.
 * Accepts either:
 *   - progress('ABC123')
 *   - progress({ tag: 'ABC123' })
 *   - progress({ tag: 'ABC123', status: 'Finished' }) // optional force, if server supports
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

/** Search jobs. Use q='@report' if your server supports it. */
export async function searchJobs(
  q: string | SearchParams,
  opts: SearchOptions = {}
): Promise<any> {
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
    payload = { action: 'markcalled', tag, scope, notes };
  } else {
    const tag = arg1 as string;
    const scope = (arg2 as any) || 'auto';
    if (!tag) throw new Error('Missing tag');
    payload = { action: 'markcalled', tag, scope };
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

export function asBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'on', 'paid', 'x', '✓', '✔'].includes(s);
}

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

export function suggestedProcessingPrice(proc?: string, beef?: boolean, webbs?: boolean): number {
  const p = normProc(proc) || '';
  const base =
    p === 'Caped' ? 150
    : p === 'Cape & Donate' ? 20
    : p === 'Donate' ? 0
    : (['Standard Processing', 'Skull-Cap', 'European'] as string[]).includes(p) ? 130
    : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}

/**
 * Previously used GAS-only "job" action.
 * For v2, just call getJob(tag) or implement a dedicated "full" action server-side if needed.
 */
export async function getJobFull(tag: string) {
  // Keep behavior: return { ok, job } shape if server returns it.
  // v2 GET action=get already returns { ok, exists, job }.
  const r = await getJob(tag);
  return (r as any)?.job ?? null;
}
