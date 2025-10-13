// app/api/public-status/route.ts
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const GAS_URL   = process.env.GAS_URL!;   // e.g. https://script.google.com/macros/s/XXXX/exec
const GAS_TOKEN = process.env.GAS_TOKEN || '';

function d(s: string) { return (s || '').replace(/\D+/g, ''); }
function lc(s: string) { return (s || '').toLowerCase().trim(); }

async function gasGet(params: Record<string, string>) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', params.action);
  Object.keys(params).forEach(k => {
    if (k !== 'action' && params[k] != null) url.searchParams.set(k, params[k]);
  });
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
  capingStatus?: string;   // GAS uses this spelling
  webbsStatus?: string;
  specialtyStatus?: string;
};

function lastNameOf(full: string) {
  const parts = lc(full).split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function hasValue(s?: string) {
  return !!(s && String(s).trim());
}

export async function POST(req: NextRequest) {
  try {
    const { confirmation = '', tag = '', lastName = '' } = await req.json?.() || {};
    const conf = String(confirmation || '').trim();
    const confDigits = d(conf);
    const tagStr = String(tag || '').trim();
    const last = lc(String(lastName || ''));

    let job: GasJob | null = null;

    // 1) Fast path: exact by confirmation
    if (conf) {
      // search by full and by digits-only, then exact-match confirmation
      const tryQueries = [conf, confDigits].filter(Boolean);
      for (const q of tryQueries) {
        const sr = await gasGet({ action: 'search', q });
        const rows: GasJob[] = (sr && sr.rows) || [];
        job = rows.find(r =>
          lc(String(r.confirmation || '')) === lc(conf) ||
          (confDigits && d(String(r.confirmation || '')) === confDigits)
        ) || null;
        if (job?.tag) {
          // hydrate via get for full/normalized fields
          const gr = await gasGet({ action: 'get', tag: String(job.tag) });
          if (gr && gr.ok && gr.exists && gr.job) job = gr.job as GasJob;
          break;
        }
      }
    }

    // 2) Fallback: Tag + Last Name
    if (!job && tagStr) {
      const gr = await gasGet({ action: 'get', tag: tagStr });
      if (gr && gr.ok && gr.exists && gr.job) {
        const j: GasJob = gr.job;
        if (!last || lastNameOf(String(j.customer || '')) === last) job = j;
      }
    }

    if (!job) {
      return Response.json({ ok: false, notFound: true, error: 'No match.' }, { status: 404 });
    }

    // Build response expected by the page
    const resp = {
      ok: true,
      tag: job.tag || '',
      confirmation: job.confirmation || '',
      status: job.status || '—',
      // Expose all tracks when non-empty. Map capingStatus -> capeStatus.
      tracks: {
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

