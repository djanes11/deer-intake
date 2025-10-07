// lib/api.ts
// Central helpers for /api/gas2 with backwards-compatible exports used across your app.

export type AnyRec = Record<string, any>;
export type Track = 'meat' | 'cape' | 'webbs';
export type Trio = { meat: number; cape: number; webbs: number };

/** Shape used around the app (intake, calls) */
export type Job = {
  tag?: string;
  customer?: string | null;
  ['Customer Name']?: string | null;
  phone?: string | null;
  email?: string | null;

  status?: string | null;          // meat
  Status?: string | null;
  capingStatus?: string | null;    // cape
  ['Caping Status']?: string | null;
  webbsStatus?: string | null;     // webbs
  ['Webbs Status']?: string | null;

  lastCallAt?: string | null;
  ['Last Call At']?: string | null;

  paidProcessing?: boolean | null;
  ['Paid Processing']?: boolean | null;
  ['Picked Up - Processing']?: boolean | null;
  ['Picked Up - Processing At']?: string | null;

  processType?: string | null;
  beefFat?: boolean | null;
  webbsOrder?: boolean | null;

  // specialty fields used in reports
  specialtyProducts?: boolean | null;
  summerSausageLbs?: string | null;
  summerSausageCheeseLbs?: string | null;
  slicedJerkyLbs?: string | null;

  // misc
  dropoff?: string | null;
  confirmation?: string | null;
};

export type DashboardCounts = {
  ok: boolean;
  needsTag: number;
  ready: Trio;
  called: Trio;
};

/* -------------------------------------------------------
 * Low-level POST wrapper
 * -----------------------------------------------------*/
export async function postJSON<T = any>(body: Record<string, any>): Promise<T> {
  const r = await fetch('/api/gas2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let j: any;
  try {
    j = JSON.parse(txt);
  } catch {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 400)}`);
    throw new Error(`Bad JSON from /api/gas2: ${txt.slice(0, 400)}`);
  }
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP ${r.status}`);
  }
  return j as T;
}

/* -------------------------------------------------------
 * Generic helpers (existing usage)
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
 * Back-compat aliases (to fix build/imports without touching pages)
 * -----------------------------------------------------*/
export const progress = progressTag;    // import { progress } from '@/lib/api'
export const getJob = get;              // import { getJob } from '@/lib/api'
export const searchJobs = search;       // import { searchJobs } from '@/lib/api'

/* -------------------------------------------------------
 * Calls report helpers (back-compat + safe implementations)
 * -----------------------------------------------------*/
export async function markCalled(tag: string, track: Track = 'meat') {
  if (!tag) throw new Error('markCalled(): tag required');
  const now = new Date().toISOString();

  if (track === 'cape') {
    return postJSON({
      action: 'save',
      job: {
        tag,
        capingStatus: 'Called',
        'Caping Status': 'Called',
        lastCallAt: now,
        'Last Call At': now,
      },
    });
  }
  if (track === 'webbs') {
    return postJSON({
      action: 'save',
      job: {
        tag,
        webbsStatus: 'Called',
        'Webbs Status': 'Called',
        lastCallAt: now,
        'Last Call At': now,
      },
    });
  }
  // meat (regular processing)
  return postJSON({
    action: 'save',
    job: {
      tag,
      status: 'Called',
      Status: 'Called',
      lastCallAt: now,
      'Last Call At': now,
    },
  });
}

export async function logCallSimple(tag: string, note: string) {
  if (!tag) throw new Error('logCallSimple(): tag required');
  // Try a dedicated action first; if your GAS ignores it, still returns ok:true.
  try {
    return await postJSON({ action: 'logCall', tag, note });
  } catch {
    const stamp = new Date().toISOString();
    return postJSON({
      action: 'save',
      job: { tag, note: `[${stamp}] ${note}` },
    });
  }
}

/* -------------------------------------------------------
 * Dashboard / KPI (used on homepage)
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
 * Signed read-only link (optional; some pages use it)
 * -----------------------------------------------------*/
export async function viewLink(tag: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!tag) throw new Error('viewLink(): tag required');
  return postJSON<{ ok: boolean; url?: string; error?: string }>({ action: 'viewlink', tag });
}

/* -------------------------------------------------------
 * Per-track actions (pickup / paid)
 * -----------------------------------------------------*/
export async function markPaidProcessing(tag: string) {
  if (!tag) throw new Error('markPaidProcessing(): tag required');
  return postJSON({ action: 'save', job: { tag, paidProcessing: true, 'Paid Processing': true } });
}

export async function markPickedUp(tag: string, track: Track) {
  if (!tag) throw new Error('markPickedUp(): tag required');
  const now = new Date().toISOString();

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
  if (track === 'webbs') {
    return postJSON({
      action: 'save',
      job: {
        tag,
        webbsStatus: 'Picked Up',
        'Webbs Status': 'Picked Up',
      },
    });
  }
  // meat
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
  return postJSON({ action: 'settag', row, tag });
}

/* -------------------------------------------------------
 * Called report helper (used by "Pickup Queue / Called" pages)
 * -----------------------------------------------------*/
export type CalledRow = {
  tag: string;
  customer: string;
  phone: string;
  dropoff?: string;
  status?: string;          // meat
  capingStatus?: string;    // cape
  webbsStatus?: string;     // webbs
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
 * Light utils
 * -----------------------------------------------------*/
export function fmtMoney(n: number | string) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}
export function toInt(val: any) {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
