// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Prefer GAS_BASE, fall back to GAS_URL for compatibility
const RAW_GAS = (process.env.GAS_BASE || process.env.GAS_URL || '').trim();
const GAS_TOKEN = (process.env.GAS_TOKEN || '').trim();

function isHttpUrl(s: string) { try { new URL(s); return true; } catch { return false; } }

function buildGasUrl(input: string): string {
  const s = (input || '').trim();
  if (!s) throw new Error('GAS_BASE is empty');
  if (isHttpUrl(s)) {
    // ensure /exec
    return /\/exec(\?|$)/.test(s) ? s : s.replace(/\/dev(\?|$).*/i, '/exec');
  }
  // allow just a script ID
  if (/^[A-Za-z0-9_-]+$/.test(s)) {
    return `https://script.google.com/macros/s/${s}/exec`;
  }
  throw new Error('GAS_BASE must be a full https URL (ending with /exec) or a valid script ID');
}

let GAS_URL = '';
let GAS_URL_ERR = '';
try {
  GAS_URL = buildGasUrl(RAW_GAS);
  if (!/^https:\/\//i.test(GAS_URL) || !/\/exec(\?|$)/.test(GAS_URL)) {
    throw new Error('GAS_BASE must be an https Apps Script deployment URL ending with /exec');
  }
} catch (e: any) {
  GAS_URL_ERR = e?.message || String(e);
}

function digits(s: string) { return (s || '').replace(/\D+/g, ''); }
function lc(s: string) { return (s || '').toLowerCase().trim(); }

async function gasGet(params: Record<string, string>) {
  if (!GAS_URL) throw new Error(GAS_URL_ERR || 'Invalid GAS_BASE');
  const url = new URL(GAS_URL);
  url.searchParams.set('action', params.action);
  for (const k of Object.keys(params)) {
    if (k !== 'action' && params[k] != null) url.searchParams.set(k, params[k]);
  }
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`GAS ${params.action} ${r.status}`);
  return r.json();
}

type GasJob = {
  tag?: string;
  confirmation?: string;
  customer?: string;
  status?: string;
  capingStatus?: string;   // GAS spelling
  webbsStatus?: string;
  specialtyStatus?: string;
};

function lastNameOf(full: string) {
  const parts = lc(full).split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
function hasValue(s?: string) { return !!(s && String(s).trim()); }

export async function POST(req: NextRequest) {
  try {
    if (!GAS_URL) throw new Error(GAS_URL_ERR || 'Invalid GAS_BASE');

    const body = (await req.json?.()) || {};
    const confIn = String(body.confirmation || '').trim();
    const tagIn  = String(body.tag || '').trim();
    const lastIn = lc(String(body.lastName || ''));

    const confDigits = digits(confIn);

    let job: GasJob | null = null;

    // 1) Fast path: confirmation (full and digits-only), then exact compare
    if (confIn) {
      for (const q of [confIn, confDigits].filter(Boolean)) {
        const sr = await gasGet({ action: 'search', q });
        const rows: GasJob[] = (sr && sr.rows) || [];
        job = rows.find(r =>
          lc(String(r.confirmation || '')) === lc(confIn) ||
          (confDigits && digits(String(r.confirmation || '')) === confDigits)
        ) || null;
        if (job?.tag) {
          const gr = await gasGet({ action: 'get', tag: String(job.tag) });
          if (gr && gr.ok && gr.exists && gr.job) job = gr.job as GasJob;
          break;
        }
      }
    }

    // 2) Fallback: Tag + Last Name
    if (!job && tagIn) {
      const gr = await gasGet({ action: 'get', tag: tagIn });
      if (gr && gr.ok && gr.exists && gr.job) {
        const j: GasJob = gr.job;
        if (!lastIn || lastNameOf(String(j.customer || '')) === lastIn) job = j;
      }
    }

    if (!job) {
      return Response.json({ ok: false, notFound: true, error: 'No match.' }, { status: 404 });
    }

    // Build payload expected by the customer status page
    const resp = {
      ok: true,
      tag: job.tag || '',
      confirmation: job.confirmation || '',
      status: job.status || '—',
      tracks: {
        // map capingStatus -> capeStatus for UI
        capeStatus: hasValue(job.capingStatus) ? String(job.capingStatus) : undefined,
        webbsStatus: hasValue(job.webbsStatus) ? String(job.webbsStatus) : undefined,
        specialtyStatus: hasValue(job.specialtyStatus) ? String(job.specialtyStatus) : undefined,
      },
    };

    return Response.json(resp, { status: 200 });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message || 'Lookup failed' }, { status: 500 });
  }
}
