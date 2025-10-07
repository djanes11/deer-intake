// lib/api.ts
// Centralized client helpers for talking to /api/gas2
// - Keeps generic helpers you likely already use (saveJob, progressTag, search, get)
// - Adds dashboard KPIs, signed view link, and mark-paid / mark-picked-up per track
// - Adds Overnight Review helpers (fetchNeedsTag, setTag)
// - Adds Called report helper (fetchCalled)

export type AnyRec = Record<string, any>;

export type Track = 'meat' | 'cape' | 'webbs';

export type DashboardCounts = {
  ok: boolean;
  // Overnight items that need a Tag
  needsTag: number;
  // “Ready to call” counts by track (Finished/Ready but not Called)
  ready: { meat: number; cape: number; webbs: number };
  // “Called” queue counts by track
  called: { meat: number; cape: number; webbs: number };
};

/* -------------------------------------------------------
 * Low-level POST wrapper (kept tiny & predictable)
 * -----------------------------------------------------*/
export async function postJSON<T = any>(body: Record<string, any>): Promise<T> {
  const r = await fetch('/api/gas2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  try {
    const j = JSON.parse(txt);
    if (!r.ok || j?.ok === false) {
      throw new Error(j?.error || `HTTP ${r.status}`);
    }
    return j as T;
  } catch (e) {
    // If upstream returned plain text, surface it
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 400)}`);
    throw new Error(`Bad JSON from /api/gas2: ${txt.slice(0, 400)}`);
  }
}

/* -------------------------------------------------------
 * Generic pass-throughs you may already be using
 * (kept to avoid breaking existing code)
 * -----------------------------------------------------*/
export async function saveJob(job: AnyRec) {
  return postJSON({ action: 'save', job });
}

export async function progressTag(tag: string) {
  return postJSON({ action: 'progress', tag });
}

export async function search(q: string, limit?: number) {
  const body: AnyRec = { action: 'search', q };
  if (limit) body.limit = limit;
  return postJSON(body);
}

export async function get(tag: string) {
  return postJSON({ action: 'get', tag });
}

/* -------------------------------------------------------
 * Dashboard KPIs
 * (pairs with route.ts action: "dashboardcounts")
 * -----------------------------------------------------*/
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const j = await postJSON<DashboardCounts>({ action: 'dashboardcounts' });
  return {
    ok: !!j?.ok,
    needsTag: Number(j?.needsTag || 0),
    ready: {
      meat: Number(j?.ready?.meat || 0),
      cape: Number(j?.ready?.cape || 0),
      webbs: Number(j?.ready?.webbs || 0),
    },
    called: {
      meat: Number(j?.called?.meat || 0),
      cape: Number(j?.called?.cape || 0),
      webbs: Number(j?.called?.webbs || 0),
    },
  };
}

/* -------------------------------------------------------
 * Signed read-only link (if/when you need it)
 * -----------------------------------------------------*/
export async function viewLink(tag: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!tag) throw new Error('viewLink(): tag required');
  return postJSON<{ ok: boolean; url?: string; error?: string }>({ action: 'viewlink', tag });
}

/* -------------------------------------------------------
 * Per-track actions
 * -----------------------------------------------------*/
export async function markPaidProcessing(tag: string) {
  if (!tag) throw new Error('markPaidProcessing(): tag required');
  // Both camelCase and header-case are accepted by GAS; include both for safety.
  return postJSON({ action: 'save', job: { tag, paidProcessing: true, 'Paid Processing': true } });
}

/**
 * Mark a specific track picked up.
 * - meat → sets Status = "Picked Up" and stamps Picked Up - Processing (+ timestamp)
 * - cape → sets Caping Status = "Picked Up"
 * - webbs → sets Webbs Status = "Picked Up"
 */
export async function markPickedUp(tag: string, track: Track) {
  if (!tag) throw new Error('markPickedUp(): tag required');

  const now = new Date().toISOString();

  if (track === 'meat') {
    return postJSON({
      action: 'save',
      job: {
        tag,
        status: 'Picked Up',
        Status: 'Picked Up',
        'Picked Up - Processing': true,
        'Picked Up - Processing At': now,
      },
    });
  }
  if (track === 'cape') {
    return postJSON({
      action: 'save',
      job: {
        tag,
        capingStatus: 'Picked Up',
        'Caping Status': 'Picked Up',
      },
    });
  }
  // webbs
  return postJSON({
    action: 'save',
    job: {
      tag,
      webbsStatus: 'Picked Up',
      'Webbs Status': 'Picked Up',
    },
  });
}

/* -------------------------------------------------------
 * Overnight Review helpers
 * -----------------------------------------------------*/
export type OvernightRow = {
  row: number;
  customer: string;
  confirmation: string;
  phone: string;
  dropoff?: string;
  status?: string;
  tag?: string;
  requiresTag?: boolean;
};

export async function fetchNeedsTag(limit = 500): Promise<OvernightRow[]> {
  const j = await postJSON<{ ok: boolean; rows: AnyRec[] }>({ action: 'needstag', limit });
  const rows = Array.isArray(j?.rows) ? j.rows : [];
  return rows.map((r) => ({
    row: Number(r?.row ?? r?.Row ?? 0) || 0,
    customer: String(r?.customer ?? r?.['Customer Name'] ?? r?.Customer ?? '') || '',
    confirmation: String(r?.confirmation ?? '') || '',
    phone: String(r?.phone ?? r?.Phone ?? '') || '',
    dropoff:
      String(
        r?.dropoff ?? r?.['Drop-off'] ?? r?.['Drop Off'] ??
        r?.['Drop-off Date'] ?? r?.['Drop Off Date'] ?? r?.['Date Dropped'] ?? ''
      ),
    status: String(r?.status ?? r?.Status ?? '') || '',
    tag: String(r?.tag ?? r?.Tag ?? '') || '',
    requiresTag: !!(r?.requiresTag ?? r?.['Requires Tag']),
  }));
}

export async function setTag(row: number, tag: string) {
  if (!row || !tag) throw new Error('setTag(): row and tag are required');
  // The route will also attempt the drop-off email if not stamped yet.
  return postJSON({ action: 'settag', row, tag });
}

/* -------------------------------------------------------
 * Called report helper
 * (mirrors the GAS @recall pool; you can filter to meat/cape/webbs === "Called")
 * -----------------------------------------------------*/
export type CalledRow = {
  tag: string;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;          // meat status
  capingStatus?: string;    // cape status
  webbsStatus?: string;     // webbs status
  paidProcessing?: boolean;
  pickedUpProcessing?: boolean;
  lastCallAt?: string;
  processType?: string;
  beefFat?: boolean;
  webbsOrder?: boolean;
  specialtyProducts?: boolean;
  summerSausageLbs?: string;
  summerSausageCheeseLbs?: string;
  slicedJerkyLbs?: string;
};

export async function fetchCalled(): Promise<CalledRow[]> {
  const data = await postJSON<{ ok: boolean; rows: AnyRec[] }>({ action: 'search', q: '@recall' });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((r: AnyRec) => ({
    tag: String(r?.tag ?? r?.Tag ?? ''),
    customer: String(r?.customer ?? r?.['Customer Name'] ?? ''),
    phone: String(r?.phone ?? ''),
    dropoff: String(r?.dropoff ?? ''),
    status: String(r?.status ?? r?.Status ?? ''),
    capingStatus: String(r?.capingStatus ?? r?.['Caping Status'] ?? ''),
    webbsStatus: String(r?.webbsStatus ?? r?.['Webbs Status'] ?? ''),
    paidProcessing: !!(r?.paidProcessing || r?.['Paid Processing']),
    pickedUpProcessing: !!(r?.['Picked Up - Processing']),
    lastCallAt: String(r?.lastCallAt ?? r?.['Last Call At'] ?? ''),
    processType: String(r?.processType ?? ''),
    beefFat: !!r?.beefFat,
    webbsOrder: !!r?.webbsOrder,
    specialtyProducts: !!r?.specialtyProducts,
    summerSausageLbs: String(r?.summerSausageLbs ?? ''),
    summerSausageCheeseLbs: String(r?.summerSausageCheeseLbs ?? ''),
    slicedJerkyLbs: String(r?.slicedJerkyLbs ?? ''),
  }));
}

/* -------------------------------------------------------
 * Light utils (optional)
 * -----------------------------------------------------*/
export function fmtMoney(n: number | string) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}
export function toInt(val: any) {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
