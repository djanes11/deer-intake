// lib/api.ts — hardened against AbortError + clearer errors + flexible search params

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
  hindRoastCount?: string; frontRoastCount?: string;
  backstrapPrep?: string; backstrapThickness?: string; backstrapThicknessOther?: string;
  specialtyProducts?: boolean; summerSausageLbs?: string | number; summerSausageCheeseLbs?: string | number; slicedJerkyLbs?: string | number; specialtyPounds?: string;
  notes?: string;
  webbsOrder?: boolean; webbsFormNumber?: string; webbsPounds?: string;
  price?: number | string; priceProcessing?: number | string; priceSpecialty?: number | string;
  Paid?: boolean; paid?: boolean; paidProcessing?: boolean; paidSpecialty?: boolean;
};

const PROXY = '/api/gas2';

function urlForGet(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return `${PROXY}?${q}`;
}

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

    // Read raw text first so we can show upstream HTML or text errors
    const text = await res.text().catch(() => '');
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : (text || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return (data ?? {}) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw new Error(err?.message || 'Network error');
  } finally {
    cancel();
  }
}

/* ---------- API wrappers ---------- */

// Accept string or structured params
export type SearchParams = string | { q?: string; status?: string; limit?: number };

export async function searchJobs(params: SearchParams) {
  const qs = new URLSearchParams({ action: 'search' });
  if (typeof params === 'string') {
    qs.set('q', params);
  } else {
    if (params.q) qs.set('q', params.q);
    if (params.status) qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
  }
  const path = `${PROXY}?${qs.toString()}`;
  const j = await fetchJSON<{ ok: boolean; rows?: Job[]; jobs?: Job[]; results?: Job[]; total?: number; error?: string }>(path);
  return { ...j, rows: j.rows || j.results || j.jobs || [] };
}

export async function getJob(tag: string) {
  const path = urlForGet({ action: 'get', tag });
  return fetchJSON<{ ok: boolean; exists?: boolean; job?: Job; error?: string }>(path);
}

export async function saveJob(job: Job) {
  return fetchJSON<{ ok: boolean; error?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'save', job }),
  });
}

export async function progress(input: { tag: string } | string) {
  const tag = typeof input === 'string' ? input : input.tag;
  return fetchJSON<{ ok: boolean; nextStatus?: string; error?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'progress', tag }),
  });
}

// NO STATUS FLIP — just increments attempts and appends notes
export async function logCallSimple(payload: { tag: string; reason?: string; notes?: string }) {
  return fetchJSON<{ ok: boolean; error?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'log-call', ...payload }),
  });
}

// STATUS FLIP to "Called" in the appropriate column (meat/cape/webbs)
export async function markCalled(payload: { tag: string; scope?: 'auto' | 'meat' | 'cape' | 'webbs'; notes?: string }) {
  return fetchJSON<{ ok: boolean; error?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'markCalled', tag: payload.tag, scope: payload.scope || 'auto', notes: payload.notes || '' }),
  });
}

