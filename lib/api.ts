// lib/api.ts — hardened fetch + stable types + specialtyPounds auto-calc

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

  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;
  specialtyPounds?: string; // <-- we will set this automatically on save

  notes?: string;

  webbsOrder?: boolean; webbsFormNumber?: string; webbsPounds?: string;

  price?: number | string;            // total (optional if you compute elsewhere)
  priceProcessing?: number | string;  // optional
  priceSpecialty?: number | string;   // optional

  Paid?: boolean; paid?: boolean; paidProcessing?: boolean; paidSpecialty?: boolean;
};

const PROXY = '/api/gas2';

/* ---------- utils ---------- */

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

    const text = await res.text().catch(() => '');
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON text */ }

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

/* ---------- API wrappers ---------- */

// keep simple: search by string; returns rows[] normalized
export async function searchJobs(q: string) {
  const path = urlForGet({ action: 'search', q });
  const j = await fetchJSON<{ ok: boolean; rows?: Job[]; jobs?: Job[]; results?: Job[]; total?: number }>(path);
  return { ...j, rows: j.rows || j.results || j.jobs || [] };
}

export async function getJob(tag: string) {
  const path = urlForGet({ action: 'get', tag });
  return fetchJSON<{ ok: boolean; exists?: boolean; job?: Job }>(path);
}

/**
 * Auto-compute specialtyPounds every time you save.
 * - Sums Summer Sausage + Summer Sausage + Cheese + Jerky (numbers only)
 * - Writes result as string into `specialtyPounds`
 * - If all three are zero/empty, leaves any existing `specialtyPounds` as-is
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

// progress requires an object with { tag }
export async function progress(payload: { tag: string }) {
  return fetchJSON<{ ok: boolean; nextStatus?: string }>(PROXY, {
    method: 'POST',
    body: JSON.stringify({ action: 'progress', tag: payload.tag }),
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

