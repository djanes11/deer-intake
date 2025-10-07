/* lib/api.ts
 * Central client helper for /api/gas2.
 * IMPORTANT: Keeps legacy exports & names your pages already import.
 */

export type Job = {
  tag?: string;
  customer?: string;
  phone?: string;
  email?: string;

  status?: string;          // Meat / regular processing track
  capingStatus?: string;    // Cape track
  webbsStatus?: string;     // Webbs track

  // Paid flags that existing pages check
  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;

  // Pricing fields pages may read
  price?: number | string;
  priceProcessing?: number | string;
  ['Processing Price']?: number | string;

  // Called / attempts fields some UIs read
  callAttempts?: number | string;
  callAttemptsMeat?: number | string;
  callAttemptsCape?: number | string;
  callAttemptsWebbs?: number | string;
  lastCallAt?: string;

  // Specialty fields seen elsewhere
  specialtyProducts?: boolean;

  // Open structure: keep anything coming from GAS
  [k: string]: any;
};

export type Trio = { meat: number; cape: number; webbs: number };
export type DashboardCounts = { needsTag: number; ready: Trio };

const API = '/api/gas2';

async function postJSON<T = any>(body: any): Promise<T> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { __raw: text }; }
  if (!r.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${r.status}`);
  }
  return json as T;
}

/* ---------------- Basic job ops (legacy names kept) ---------------- */

export async function getJob(tag: string): Promise<Job> {
  const url = new URL(API, location.origin);
  url.searchParams.set('action', 'get');
  url.searchParams.set('tag', tag);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { __raw: t }; }
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  // GAS get returns { ok, exists, job } or similar — normalize:
  return (j?.job || j) as Job;
}

export async function saveJob(job: Job): Promise<any> {
  return postJSON({ action: 'save', job });
}

// Legacy “progress(tag)” that some pages import
export async function progress(tag: string): Promise<any> {
  return postJSON({ action: 'progress', tag });
}

/* ---------------- Search helpers ---------------- */

export async function searchJobs(q: string): Promise<Job[]> {
  const res = await postJSON<{ rows?: Job[]; results?: Job[]; [k: string]: any }>({ action: 'search', q });
  const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res?.results) ? res.results : Array.isArray(res) ? (res as any) : [];
  return rows as Job[];
}

/* Overnight / tags */
export async function setTag(row: number, tag: string): Promise<any> {
  return postJSON({ action: 'settag', row, tag });
}
export async function needsTag(limit = 500): Promise<Job[]> {
  const res = await postJSON<{ rows?: any[] }>({ action: 'needstag', limit });
  return Array.isArray(res?.rows) ? (res.rows as Job[]) : [];
}

/* ---------------- Call report helpers (keep names/signatures) ---------------- */

export async function markCalled(args: { tag: string; scope: 'meat'|'cape'|'webbs'|'all'; notes?: string }): Promise<any> {
  // Your GAS listens for `action: 'markCalled'`
  return postJSON({ action: 'markCalled', ...args });
}

export async function logCallSimple(args: { tag: string; scope?: 'meat'|'cape'|'webbs'; reason?: string; notes?: string }): Promise<any> {
  // Your GAS listens for `action: 'log-call'`
  return postJSON({ action: 'log-call', ...args });
}

/* ---------------- Picked Up helpers (UI calls these) ----------------
   NOTE: These call the route actions you added:
   - pickedUpProcessing
   - pickedUpCape
   - pickedUpWebbs
   If your GAS instead exposes a single pickedUp { tag, scope }, you can
   switch these three to call that one action in route.ts (already supported).
*/

export async function pickedUpProcessing(tag: string): Promise<any> {
  return postJSON({ action: 'pickedUpProcessing', tag });
}
export async function pickedUpCape(tag: string): Promise<any> {
  return postJSON({ action: 'pickedUpCape', tag });
}
export async function pickedUpWebbs(tag: string): Promise<any> {
  return postJSON({ action: 'pickedUpWebbs', tag });
}

/* ---------------- Dashboard KPI counts ---------------- */

// ---- keep your other imports/exports above ----

// Counts for the three tracks
export type Trio = { meat: number; cape: number; webbs: number };

// What the dashboard cards read
export type DashboardCounts = {
  ok: boolean;          // <-- add this (your page.tsx expects it)
  needsTag: number;
  ready: Trio;
  called: Trio;         // <-- add this (your page.tsx expects it)
};

// ...

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const out = await postJSON<{ ok?: boolean; needsTag?: number; ready?: Trio; called?: Trio }>({
    action: 'dashboardcounts'
  });
  const needsTag = Number(out?.needsTag ?? 0);
  const readyIn = out?.ready || { meat: 0, cape: 0, webbs: 0 };
  const calledIn = out?.called || { meat: 0, cape: 0, webbs: 0 };
  return {
    ok: out?.ok ?? true,
    needsTag,
    ready: {
      meat: Number(readyIn.meat || 0),
      cape: Number(readyIn.cape || 0),
      webbs: Number(readyIn.webbs || 0),
    },
    called: {
      meat: Number(calledIn.meat || 0),
      cape: Number(calledIn.cape || 0),
      webbs: Number(calledIn.webbs || 0),
    },
  };
}


/* ---------------- Optional read-only link (kept for compatibility) ---------------- */

export async function viewLink(tag: string): Promise<string> {
  const res = await postJSON<{ ok: boolean; url?: string }>({ action: 'viewlink', tag });
  return String(res?.url || '');
}
