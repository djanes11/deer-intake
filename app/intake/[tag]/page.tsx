// app/intake/[tag]/page.tsx — public read-only view by tag (Server Component, deploy-safe)
import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// ---- Types ----
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

  summerSausageLbs?: string;
  summerSausageCheeseLbs?: string;
  slicedJerkyLbs?: string;
};

// ---- Helpers ----
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
  const ss  = toInt(job.summerSausageLbs);
  const ssc = toInt(job.summerSausageCheeseLbs);
  const jer = toInt(job.slicedJerkyLbs);
  return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}

// Shared inline style objects (no styled-jsx)
const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0b0f12', display: 'block', marginBottom: 4 };
const Pill: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: '6px 8px' };
const PillMoney: React.CSSProperties = { ...Pill, fontWeight: 800, textAlign: 'right' };
const Grid2: React.CSSProperties = { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, 1fr)' };

// ---- Page (Server Component) ----
// IMPORTANT: no explicit prop types — avoids Next 15 PageProps mismatch.
export default async function ReadOnlyByTagPage({ params, searchParams }: any) {
  try {
    const p = await params; // handles both plain object and Promise in Next 15
    const tag = String(p?.tag || '').trim();
    if (!tag) throw new Error('Missing tag parameter.');

    const conf = String(searchParams?.conf || '').trim();

    // 1) Load by tag
    let job: Job | null = null;
    const gr = await gasGet({ action: 'get', tag });
    if (gr?.ok && gr.exists && gr.job) job = gr.job as Job;

    // 2) Optional sanity: if conf present but doesn't match, cross-check by confirmation
    if (conf && job && digits(String(job.confirmation || '')) !== digits(conf)) {
      const sr = await gasGet({ action: 'search', q: conf });
      const rows: Job[] = (sr && sr.rows) || [];
      const found = rows.find(r => digits(String(r.confirmation || '')) === digits(conf));
      if (found?.tag && found.tag !== tag) {
        const gr2 = await gasGet({ action: 'get', tag: String(found.tag) });
        if (gr2?.ok && gr2.exists && gr2.job) job = gr2.job as Job;
      }
    }

    if (!job) throw new Error('No matching intake found for this tag.');

    const proc = normalizeProc(job.processType);
    const priceProc = suggestedProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder);
    const priceSpec = specialtyPrice(job);
    const totalPrice = (priceProc + priceSpec);

    return (
      <main style={{ maxWidth: 980, margin: '24px auto', padding: '12px', color: '#0b0f12' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h1 style={{ margin: 0, color: '#0b0f12' }}>McAfee Deer Intake (Read Only)</h1>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Tag: <b>{job.tag || '—'}</b> &nbsp;|&nbsp; Confirmation: <b>{job.confirmation || '—'}</b>
          </div>
        </header>

        {/* Summary Row 1: pricing */}
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 8 }}>
          <div>
            <label style={L}>Processing Price</label>
            <div style={PillMoney}>{money(priceProc)}</div>
          </div>
          <div>
            <label style={L}>Specialty Price</label>
            <div style={PillMoney}>{money(priceSpec)}</div>
          </div>
          <div>
            <label style={L}>Total</label>
            <div style={{ ...PillMoney, fontWeight: 900 }}>{money(totalPrice)}</div>
          </div>
        </div>

        {/* Summary Row 2: statuses (includes Specialty Status) */}
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(5, 1fr)', marginTop: 8, marginBottom: 8 }}>
          <div>
            <label style={L}>Status</label>
            <div style={Pill}>{job.status || ''}</div>
          </div>

          {(proc === 'Caped' || proc === 'Cape & Donate') && (
            <div>
              <label style={L}>Caping Status</label>
              <div style={Pill}>{job.capingStatus || ''}</div>
            </div>
          )}

          {job.webbsOrder && (
            <div>
              <label style={L}>Webbs Status</label>
              <div style={Pill}>{job.webbsStatus || ''}</div>
            </div>
          )}

          {(job.specialtyProducts || (job.specialtyStatus && String(job.specialtyStatus).trim())) && (
            <div>
              <label style={L}>Specialty Status</label>
              <div style={Pill}>{job.specialtyStatus || ''}</div>
            </div>
          )}

          {/* filler to keep grid neat */}
          <div aria-hidden style={{ visibility: 'hidden' }} />
        </div>

        {/* Identity */}
        <section style={Grid2}>
          <div>
            <label style={L}>Customer</label>
            <div style={Pill}>{job.customer || ''}</div>
          </div>
          <div>
            <label style={L}>Phone</label>
            <div style={Pill}>{job.phone || ''}</div>
          </div>
          <div>
            <label style={L}>Email</label>
            <div style={Pill}>{job.email || ''}</div>
          </div>
          <div>
            <label style={L}>Address</label>
            <div style={Pill}>{[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}</div>
          </div>
        </section>

        {/* Hunt */}
        <section style={Grid2}>
          <div>
            <label style={L}>County Killed</label>
            <div style={Pill}>{job.county || ''}</div>
          </div>
          <div>
            <label style={L}>Drop-off Date</label>
            <div style={Pill}>{job.dropoff || ''}</div>
          </div>
          <div>
            <label style={L}>Deer Sex</label>
            <div style={Pill}>{job.sex || ''}</div>
          </div>
          <div>
            <label style={L}>Process Type</label>
            <div style={Pill}>{job.processType || ''}</div>
          </div>
        </section>

        {/* Cuts */}
        <section>
          <h3 style={{ margin: '10px 0 6px' }}>Cuts</h3>
          <div style={Grid2}>
            <div>
              <label style={L}>Hind Roast Count</label>
              <div style={Pill}>{job.hindRoastCount || ''}</div>
            </div>
            <div>
              <label style={L}>Front Roast Count</label>
              <div style={Pill}>{job.frontRoastCount || ''}</div>
            </div>
          </div>
        </section>

        {/* Backstrap */}
        <section>
          <h3 style={{ margin: '10px 0 6px' }}>Backstrap</h3>
          <div style={Grid2}>
            <div>
              <label style={L}>Prep</label>
              <div style={Pill}>{job.backstrapPrep || ''}</div>
            </div>
            <div>
              <label style={L}>Thickness</label>
              <div style={Pill}>
                {job.backstrapThickness === 'Other'
                  ? (job.backstrapThicknessOther || '')
                  : (job.backstrapThickness || '')}
              </div>
            </div>
          </div>
        </section>

        {/* Specialty */}
        <section>
          <h3 style={{ margin: '10px 0 6px' }}>Specialty Products</h3>
          <div style={Grid2}>
            <div>
              <label style={L}>Would like specialty products</label>
              <div style={Pill}>{job.specialtyProducts ? 'Yes' : 'No'}</div>
            </div>
            {job.specialtyProducts && (
              <>
                <div>
                  <label style={L}>Summer Sausage (lb)</label>
                  <div style={Pill}>{job.summerSausageLbs || ''}</div>
                </div>
                <div>
                  <label style={L}>Summer Sausage + Cheese (lb)</label>
                  <div style={Pill}>{job.summerSausageCheeseLbs || ''}</div>
                </div>
                <div>
                  <label style={L}>Sliced Jerky (lb)</label>
                  <div style={Pill}>{job.slicedJerkyLbs || ''}</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Webbs */}
        <section>
          <h3 style={{ margin: '10px 0 6px' }}>Webbs</h3>
          <div style={Grid2}>
            <div>
              <label style={L}>Webbs Order</label>
              <div style={Pill}>{job.webbsOrder ? 'Yes' : 'No'}</div>
            </div>
            {job.webbsOrder && (
              <>
                <div>
                  <label style={L}>Order Form Number</label>
                  <div style={Pill}>{job.webbsFormNumber || ''}</div>
                </div>
                <div>
                  <label style={L}>Webbs Pounds</label>
                  <div style={Pill}>{job.webbsPounds || ''}</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Notes */}
        <section>
          <h3 style={{ margin: '10px 0 6px' }}>Notes</h3>
          <div style={Pill}>{job.notes || ''}</div>
        </section>
      </main>
    );
  } catch (err: any) {
    return (
      <div style={{ maxWidth: 760, margin: '24px auto', padding: '16px', color: '#0b0f12' }}>
        <h1 style={{ color: '#0b0f12' }}>Unable to load form</h1>
        <p style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{String(err?.message || err)}</p>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          Tip: ensure <code>NEXT_PUBLIC_GAS_BASE</code> is your Apps Script <code>/exec</code> URL.
        </div>
      </div>
    );
  }
}
