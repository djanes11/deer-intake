// lib/api.ts
// Single client-side entrypoint for talking to our Next API proxy (/api/gas2),
// which in turn talks to Google Apps Script (GAS).
// Preserves previous helpers (getJob, saveJob, progress, searchJobs)
// and adds markCalled + logCallSimple used by the Calls report.

// NOTE: Do NOT call GAS directly from the browser. Always go through /api/gas2.
// That keeps your token server-side and lets the server add signatures, links, etc.

export type AnyRec = Record<string, any>;

// Keep Job loose enough to tolerate sheet changes without breaking the app.
// If you want stricter types, create a narrower interface and intersect.
export interface Job extends AnyRec {
  tag?: string;
  confirmation?: string;

  customer?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  county?: string;
  dropoff?: string; // yyyy-mm-dd
  sex?: '' | 'Buck' | 'Doe';

  // Processing types incl. new Donate variants
  processType?:
    | ''
    | 'Standard Processing'
    | 'Caped'
    | 'Skull-Cap'
    | 'European'
    | 'Cape & Donate'
    | 'Donate';

  // Status tracks
  status?: string;        // main (regular processing)
  capingStatus?: string;  // only when Caped
  webbsStatus?: string;   // only when Webbs Order

  // Cuts & prefs
  hind?: {
    'Hind - Steak'?: boolean;
    'Hind - Roast'?: boolean;
    'Hind - Grind'?: boolean;
    'Hind - None'?: boolean;
  };
  front?: {
    'Front - Steak'?: boolean;
    'Front - Roast'?: boolean;
    'Front - Grind'?: boolean;
    'Front - None'?: boolean;
  };
  hindRoastCount?: string;
  frontRoastCount?: string;

  steak?: string;
  steakOther?: string;
  burgerSize?: string;
  steaksPerPackage?: string;
  beefFat?: boolean;

  backstrapPrep?: '' | 'Whole' | 'Sliced' | 'Butterflied';
  backstrapThickness?: '' | '1/2"' | '3/4"' | 'Other';
  backstrapThicknessOther?: string;

  // Specialty
  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;
  specialtyPounds?: string;

  // Webbs
  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;

  // Price & paid flags (legacy + split)
  price?: number | string;
  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;

  // Server-populated read-only hints (timestamps, etc.) may appear here too
}

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

const API_BASE = '/api/gas2';

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
    // @ts-expect-error: non-JSON fallbacks
    return text as T;
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
    // @ts-expect-error: non-JSON fallbacks
    return text as T;
  }
}

// ---------------- public API used across the app ----------------

/** Read a single job by tag (proxied through /api/gas2 → GAS) */
export async function getJob(tag: string): Promise<GetResponse> {
  if (!tag) throw new Error('Missing tag');
  const u = new URL(API_BASE, location.origin);
  u.searchParams.set('action', 'get');
  u.searchParams.set('tag', tag);
  return getJSON<GetResponse>(u.toString());
}

/** Save a job (create or update). Triggers initial/finished emails server-side. */
export async function saveJob(job: Job): Promise<SaveResponse> {
  if (!job || !job.tag) throw new Error('Missing job.tag');
  return postJSON<SaveResponse>({ action: 'save', job });
}

/** Generic progress helper used earlier (kept for backward compatibility). */
export async function progress(payload: AnyRec): Promise<SaveResponse> {
  // Example payloads we’ve used:
  //   { action: 'progress', tag, status: 'Finished' }
  //   { action: 'progress', tag, capingStatus: 'Called' }
  //   { action: 'progress', tag, webbsStatus: 'Delivered' }
  if (!payload?.tag) throw new Error('Missing tag');
  const body = { action: 'progress', ...payload };
  return postJSON<SaveResponse>(body);
}

/** Search jobs. Use q='@report' to fetch the "ready to call" report. */
export async function searchJobs(q: string | SearchParams, opts: SearchOptions = {}): Promise<any> {
  const u = new URL(API_BASE, location.origin);
  u.searchParams.set('action', 'search');

  if (typeof q === 'string') {
    u.searchParams.set('q', q || '');
    if (opts.limit != null) u.searchParams.set('limit', String(opts.limit));
    if (opts.status) u.searchParams.set('status', opts.status);
    if (opts.scope) u.searchParams.set('scope', opts.scope);
    Object.keys(opts).forEach((k) => {
      if (['limit', 'status', 'scope'].includes(k)) return;
      const v = (opts as AnyRec)[k];
      if (v != null) u.searchParams.set(k, String(v));
    });
    return getJSON<any>(u.toString());
  }

  // object-mode: copy known filters and any extras; allow opts to override
  const params: Record<string, any> = { ...(q || {}), ...(opts || {}) };
  if (params.q != null) u.searchParams.set('q', String(params.q));
  if (params.status != null) u.searchParams.set('status', String(params.status));
  if (params.tag != null) u.searchParams.set('tag', String(params.tag));
  if (params.limit != null) u.searchParams.set('limit', String(params.limit));
  if (params.scope != null) u.searchParams.set('scope', String(params.scope));
  Object.keys(params).forEach((k) => {
    if (['q','status','tag','limit','scope'].includes(k)) return;
    const v = params[k];
    if (v != null) u.searchParams.set(k, String(v));
  });
  return getJSON<any>(u.toString());
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

/** Normalize process type to one of our canonical labels. */
export function normProc(s?: string): Job['processType'] {
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
