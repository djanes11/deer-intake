// lib/api.ts — stable types, hardened fetch, mobile-safe, Vercel-friendly

export type Job = {
  tag?: string;
  customer?: string;
  phone?: string;
  dropoff?: string;

  status?: string;
  capingStatus?: string;
  webbsStatus?: string;

  callAttempts?: number;
  lastCallAt?: string;
  lastCalledBy?: string;
  callNotes?: string;

  confirmation?: string;
  email?: string;
  address?: string; city?: string; state?: string; zip?: string;
  county?: string; sex?: string; processType?: string;

  steak?: string; steakOther?: string; burgerSize?: string; steaksPerPackage?: string; beefFat?: boolean;

  hind?: {
    'Hind - Steak'?: boolean; 'Hind - Roast'?: boolean; 'Hind - Grind'?: boolean; 'Hind - None'?: boolean;
  };
  front?: {
    'Front - Steak'?: boolean; 'Front - Roast'?: boolean; 'Front - Grind'?: boolean; 'Front - None'?: boolean;
  };
  hindRoastCount?: string; frontRoastCount?: string;

  backstrapPrep?: string; backstrapThickness?: string; backstrapThicknessOther?: string;

  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;
  specialtyPounds?: string; // computed on save

  notes?: string;

  webbsOrder?: boolean; webbsFormNumber?: string; webbsPounds?: string;

  price?: number | string;
  priceProcessing?: number | string;
  priceSpecialty?: number | string;

  Paid?: boolean; paid?: boolean; paidProcessing?: boolean; paidSpecialty?: boolean;
};

const PROXY = '/api/gas2';

/* ---------------- utils ---------------- */

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

async function fetchJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const { signal, cancel } = withTimeout(20000); // 20s
  try {
    const res = await fetch(input, {
      ...init,
      signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
      keepalive: false,
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* upstream returned text */ }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : (text || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return (data ?? {}) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Request timed out');
    throw new Error(err?.message || 'Network error');
  } finally {
    cancel();
  }
}

function toInt(val: any): number {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------------- API wrappers ---------------- */

// Accepts either a string query or an object of params (status/limit/q/etc)
type SearchParams =
  | string
  | { q?: string; status?: string; limit?: number; [k: string]: string | number | undefined };

export async function searchJobs(params: SearchParams) {
  const qs = new URLSearchParams();
  qs.set('action', 'search');

  if (typeof params === 'string') {
    if (params.trim()) qs.set('q', params.trim());
  } else if (params && typeof params === 'object') {
    if (params.q) qs.set('q', String(params.q));
    if (params.status) qs.set('status', String(params.status));
    if (params.limit != null) qs.set('limit', String(params.limit));
    // pass through any extra filters
    Object.entries(params).forEach(([k, v]) => {
      if (['q', 'status', 'limit'].includes(k)) return;
      if (v == null) return;
      qs.set(k, String(v));
    });
  }

  const path = `${PROXY}?${qs.toString()}`;
  const j = await fetchJSON<{ ok: boolean; rows?: Job[]; jobs?: Job[]; results?: Job[]; total?: number }>(path);
  return { ...j, rows: j.rows || j.results || j.jobs || [] };
}

export async function getJob(tag: string) {
  const path = `${PROXY}?${new URLSearchParams({ action: 'get', tag }).toString()}`;
  return fetchJSON<{ ok: boolean; exists?: boolean; job?: Job }>(path);
}

/**
 * Auto-compute specialtyPounds every time you save.
 * - Sums Summer Sausage + Summer Sausage + Cheese + Jerky (numbers only)
 * - Writes result as string into `specialtyPounds`
 * - If all three are zero/empty, preserves existing specialtyPounds (if any)
 */
export async function saveJob(job: Job) {
  const ss  = toInt(job.summerSausageLbs);
  const ssc = toInt(job.summerSausageCheeseLbs);
  const jer = toInt(job.slicedJerkyLbs);
  const pounds = ss + ssc + jer;

  const payload: Job = {
    ...job,
    specialtyPounds: pounds > 0 ? String(pounds) : (job.specialtyPounds ?? ''),
  };

  return fetchJSON<{ ok: boolean }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'save', job: payload }),
  });
}

// Accepts either a string tag or an object { tag }
export async function progress(arg: string | { tag: string }) {
  const tag = typeof arg === 'string' ? arg : arg?.tag;
  return fetchJSON<{ ok: boolean; nextStatus?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'progress', tag }),
  });
}

// NO STATUS FLIP — just increments attempts and appends notes
export async function logCallSimple(payload: { tag: string; reason?: string; notes?: string }) {
  return fetchJSON<{ ok: boolean }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'log-call', ...payload }),
  });
}

// STATUS FLIP to "Called" in the appropriate column (meat/cape/webbs)
export async function markCalled(payload: { tag: string; scope?: 'auto' | 'meat' | 'cape' | 'webbs'; notes?: string }) {
  return fetchJSON<{ ok: boolean }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({
      action: 'markCalled',
      tag: payload.tag,
      scope: payload.scope || 'auto',
      notes: payload.notes || '',
    }),
  });
}
