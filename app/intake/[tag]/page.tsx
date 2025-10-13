// app/intake/page.tsx — public read-only view (no actions)
import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'crypto';

// ---- Config/env ----
const RAW_GAS_BASE =
  (process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = process.env.GAS_TOKEN || process.env.EMAIL_SIGNING_SECRET || '';

function isHttpUrl(s: string) { try { new URL(s); return true; } catch { return false; } }
function buildGasExecUrl(input: string): string {
  const s = (input || '').trim();
  if (!s) throw new Error('Missing GAS_BASE');
  if (isHttpUrl(s)) return /\/exec(\?|$)/.test(s) ? s : s.replace(/\/dev(\?|$).*/i, '/exec');
  if (/^[A-Za-z0-9_-]+$/.test(s)) return `https://script.google.com/macros/s/${s}/exec`;
  throw new Error('GAS_BASE must be a full https URL (ending with /exec) or a valid script ID');
}
const GAS_EXEC = buildGasExecUrl(RAW_GAS_BASE);

type Job = {
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
  dropoff?: string;
  sex?: string;
  processType?: string;

  status?: string;
  capingStatus?: string;
  webbsStatus?: string;

  specialtyProducts?: boolean;
  specialtyStatus?: string;

  steak?: string;
  steakOther?: string;
  burgerSize?: string;
  steaksPerPackage?: string;
  beefFat?: boolean;

  hindRoastCount?: string;
  frontRoastCount?: string;

  backstrapPrep?: string;
  backstrapThickness?: string;
  backstrapThicknessOther?: string;

  notes?: string;

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;

  price?: number | string;

  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;

  prefEmail?: boolean;
  prefSMS?: boolean;
  prefCall?: boolean;
  smsConsent?: boolean;
  autoCallConsent?: boolean;
};

function digits(s: string) { return (s || '').replace(/\D+/g, ''); }
function lc(s: string) { return (s || '').toLowerCase().trim(); }

async function gasGet(params: Record<string, string>) {
  const url = new URL(GAS_EXEC);
  url.searchParams.set('action', params.action);
  for (const k of Object.keys(params)) {
    if (k !== 'action' && params[k] != null) url.searchParams.set(k, params[k]);
  }
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`GAS ${params.action} ${r.status}`);
  return r.json();
}

function money(n: number | string | undefined) {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  if (!isFinite(v as number)) return '$0.00';
  return (v as number).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function normalizeProc(proc?: string) {
  const s = lc(proc || '');
  if (s.includes('donate') && s.includes('cape')) return 'Cape & Donate';
  if (s.includes('donate')) return 'Donate';
  if (s.includes('cape') && !s.includes('skull')) return 'Caped';
  if (s.includes('skull')) return 'Skull-Cap';
  if (s.includes('euro'))  return 'European';
  if (s.includes('standard')) return 'Standard Processing';
  return '';
}

function suggestedProcessingPrice(proc?: string, beef?: boolean, webbs?: boolean) {
  const p = normalizeProc(proc);
  let base =
    (p === 'Caped') ? 150 :
    (p === 'Cape & Donate') ? 50 :
    (['Standard Processing','Skull-Cap','European'].includes(p) ? 130 : 0);
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}

function specialtyPrice(job: Job) {
  const toInt = (v?: string) => {
    const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  if (!job.specialtyProducts) return 0;
  const ss  = toInt(job.summerSausageLbs as any);
  const ssc = toInt(job.summerSausageCheeseLbs as any);
  const jer = toInt(job.slicedJerkyLbs as any);
  return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}

// @ts-ignore: these may exist on Job in your project typing
declare global {
  interface Job {
    summerSausageLbs?: string;
    summerSausageCheeseLbs?: string;
    slicedJerkyLbs?: string;
  }
}

// ---- Server component ----
export default async function ReadOnlyIntakePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  try {
    const t = String(searchParams?.t || '').trim();    // public token
    const tag = String(searchParams?.tag || searchParams?.id || '').trim(); // allow tag override
    const conf = String(searchParams?.conf || '').trim();

    let job: Job | null = null;

    // 1) If tag present, get exact
    if (tag) {
      const gr = await gasGet({ action: 'get', tag });
      if (gr?.ok && gr.exists && gr.job) job = gr.job as Job;
    }

    // 2) Else by confirmation (full or digits-only)
    if (!job && conf) {
      for (const q of [conf, digits(conf)].filter(Boolean)) {
        const sr = await gasGet({ action: 'search', q });
        const rows: Job[] = (sr && sr.rows) || [];
        const found = rows.find(r =>
          lc(String(r.confirmation || '')) === lc(conf) ||
          (digits(String(r.confirmation || '')) === digits(conf))
        );
        if (found?.tag) {
          const gr = await gasGet({ action: 'get', tag: String(found.tag) });
          if (gr?.ok && gr.exists && gr.job) { job = gr.job as Job; break; }
        }
      }
    }

    if (!job) throw new Error('No matching intake found for this link.');

    const proc = normalizeProc(job.processType);
    const priceProc = suggestedProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder);
    const priceSpec = specialtyPrice(job);
    const totalPrice = (priceProc + priceSpec);

    return (
      <main className="light-page" style={{maxWidth: 980, margin: '24px auto', padding: '12px'}}>
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
          <h1 style={{margin:0, color:'#0b0f12'}}>McAfee Deer Intake (Read Only)</h1>
          <div style={{fontSize:12, color:'#6b7280'}}>Confirmation: <b>{job.confirmation || '—'}</b></div>
        </header>

        {/* Summary Row 1: pricing */}
        <div className="summary wrap" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(3, 1fr)'}}>
          <div className="card">
            <label>Processing Price</label>
            <div className="pill money">{money(priceProc)}</div>
          </div>
          <div className="card">
            <label>Specialty Price</label>
            <div className="pill money">{money(priceSpec)}</div>
          </div>
          <div className="card">
            <label>Total</label>
            <div className="pill money strong">{money(totalPrice)}</div>
          </div>
        </div>

        {/* Summary Row 2: statuses — includes Specialty Status now */}
        <div className="summary wrap" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(5, 1fr)', marginTop:8}}>
          <div className="card">
            <label>Status</label>
            <div className="pill">{job.status || ''}</div>
          </div>

          {(proc === 'Caped' || proc === 'Cape & Donate') && (
            <div className="card">
              <label>Caping Status</label>
              <div className="pill">{job.capingStatus || ''}</div>
            </div>
          )}

          {job.webbsOrder && (
            <div className="card">
              <label>Webbs Status</label>
              <div className="pill">{job.webbsStatus || ''}</div>
            </div>
          )}

          {(job.specialtyProducts || (job.specialtyStatus && String(job.specialtyStatus).trim())) && (
            <div className="card">
              <label>Specialty Status</label>
              <div className="pill">{job.specialtyStatus || ''}</div>
            </div>
          )}

          {/* Filler to keep grid neat if fewer cards render */}
          <div className="card" style={{visibility:'hidden'}} aria-hidden />
        </div>

        {/* Identity */}
        <section className="grid2" style={{marginTop:16}}>
          <div>
            <label>Customer</label>
            <div className="pill">{job.customer || ''}</div>
          </div>
          <div>
            <label>Phone</label>
            <div className="pill">{job.phone || ''}</div>
          </div>
          <div>
            <label>Email</label>
            <div className="pill">{job.email || ''}</div>
          </div>
          <div>
            <label>Address</label>
            <div className="pill">{[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}</div>
          </div>
        </section>

        {/* Hunt */}
        <section className="grid2">
          <div>
            <label>County Killed</label>
            <div className="pill">{job.county || ''}</div>
          </div>
          <div>
            <label>Drop-off Date</label>
            <div className="pill">{job.dropoff || ''}</div>
          </div>
          <div>
            <label>Deer Sex</label>
            <div className="pill">{job.sex || ''}</div>
          </div>
          <div>
            <label>Process Type</label>
            <div className="pill">{job.processType || ''}</div>
          </div>
        </section>

        {/* Cuts */}
        <section>
          <h3 style={{margin:'10px 0 6px'}}>Cuts</h3>
          <div className="grid2">
            <div>
              <label>Hind Roast Count</label>
              <div className="pill">{job.hindRoastCount || ''}</div>
            </div>
            <div>
              <label>Front Roast Count</label>
              <div className="pill">{job.frontRoastCount || ''}</div>
            </div>
          </div>
        </section>

        {/* Backstrap */}
        <section>
          <h3 style={{margin:'10px 0 6px'}}>Backstrap</h3>
          <div className="grid2">
            <div>
              <label>Prep</label>
              <div className="pill">{job.backstrapPrep || ''}</div>
            </div>
            <div>
              <label>Thickness</label>
              <div className="pill">
                {job.backstrapThickness === 'Other'
                  ? (job.backstrapThicknessOther || '')
                  : (job.backstrapThickness || '')}
              </div>
            </div>
          </div>
        </section>

        {/* Specialty */}
        <section>
          <h3 style={{margin:'10px 0 6px'}}>Specialty Products</h3>
          <div className="grid2">
            <div>
              <label>Would like specialty products</label>
              <div className="pill">{job.specialtyProducts ? 'Yes' : 'No'}</div>
            </div>
            {job.specialtyProducts && (
              <>
                <div>
                  <label>Summer Sausage (lb)</label>
                  <div className="pill">{(job as any).summerSausageLbs || ''}</div>
                </div>
                <div>
                  <label>Summer Sausage + Cheese (lb)</label>
                  <div className="pill">{(job as any).summerSausageCheeseLbs || ''}</div>
                </div>
                <div>
                  <label>Sliced Jerky (lb)</label>
                  <div className="pill">{(job as any).slicedJerkyLbs || ''}</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Webbs */}
        <section>
          <h3 style={{margin:'10px 0 6px'}}>Webbs</h3>
          <div className="grid2">
            <div>
              <label>Webbs Order</label>
              <div className="pill">{job.webbsOrder ? 'Yes' : 'No'}</div>
            </div>
            {job.webbsOrder && (
              <>
                <div>
                  <label>Order Form Number</label>
                  <div className="pill">{job.webbsFormNumber || ''}</div>
                </div>
                <div>
                  <label>Webbs Pounds</label>
                  <div className="pill">{job.webbsPounds || ''}</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Notes */}
        <section>
          <h3 style={{margin:'10px 0 6px'}}>Notes</h3>
          <div className="pill">{job.notes || ''}</div>
        </section>

        <style jsx>{`
          .light-page { color:#0b0f12; }
          h1 { font-size: 22px; }

          label { font-size:12px; font-weight:700; color:#0b0f12; display:block; margin-bottom:4px; }
          .pill {
            background: #fff;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 6px 8px;
          }
          .money { font-weight: 800; text-align: right; }
          .money.strong { font-weight: 900; }

          .summary.wrap { margin-bottom: 8px; }
          .card { min-width: 0; }

          .grid2 { display:grid; gap:8px; grid-template-columns: repeat(2, 1fr); }
          @media (max-width:720px){
            .grid2, .summary.wrap { grid-template-columns: 1fr; }
          }
        `}</style>
      </main>
    );
  } catch (err:any) {
    return (
      <div className="light-page" style={{maxWidth:760, margin:'24px auto', padding:'16px'}}>
        <h1 style={{color:'#0b0f12'}}>Unable to load form</h1>
        <p style={{whiteSpace:'pre-wrap', color:'#374151'}}>{String(err?.message || err)}</p>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
  Tip: ensure <code>NEXT_PUBLIC_GAS_BASE</code> is your Apps Script <code>/exec</code> URL.
</div>
      </div>
    );
  }
}
