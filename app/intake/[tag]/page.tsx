// app/intake/[tag]/page.tsx — public read-only view of the exact intake form (no nav, no actions)
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

// ---- Helpers ----
function assertValidGasBase() {
  if (!RAW_GAS_BASE) {
    throw new Error('NEXT_PUBLIC_GAS_BASE is not set.');
  }
  new URL(RAW_GAS_BASE); // throws if invalid
}

function hmac16(tag: string) {
  if (!GAS_TOKEN) return '';
  return crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0, 16);
}
function verifyToken(tag: string, token?: string | null) {
  if (!GAS_TOKEN) return true; // if no secret configured, allow
  return token === hmac16(tag);
}

async function getJob(tag: string) {
  assertValidGasBase();
  const url = new URL(RAW_GAS_BASE);
  url.searchParams.set('action', 'get');
  url.searchParams.set('tag', tag);
  if (process.env.GAS_TOKEN) url.searchParams.set('token', process.env.GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`GAS get failed: HTTP ${r.status}`);
  const data = await r.json();
  if (!data?.job) throw new Error('Form not found for that tag.');
  return data.job as Record<string, any>;
}

// ---- Simple pricing helpers to show the summary numbers like the intake page ----
const normProc = (s?: string) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
};
const suggestedProcessingPrice = (proc?: string, beef?: boolean, webbs?: boolean) => {
  const p = normProc(proc);
  const base = p === 'Caped' ? 150 : (['Standard Processing','Skull-Cap','European'].includes(p) ? 130 : 0);
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
};
const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label>{label}</label>
      <div
        className="value"
        style={{
          background:'#fff',
          border:'1px solid #cbd5e1',
          borderRadius:10,
          padding:'6px 8px',
          wordBreak:'break-word',
          overflowWrap:'anywhere',
          whiteSpace:'pre-wrap',
        }}
      >
        {value || ''}
      </div>
    </div>
  );
}
function Check({ on, text }: { on?: boolean; text: string }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <input type="checkbox" checked={!!on} readOnly />
      <span>{text}</span>
    </div>
  );
}

type SP = Record<string, string | string[] | undefined>;
export default async function IntakeView({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams?: Promise<SP>;
}) {
  try {
    const { tag } = await params;
    const sp = (await (searchParams ?? Promise.resolve({}))) as SP;
    const tagDec = decodeURIComponent(tag);
    const t = typeof sp.t === 'string' ? sp.t : Array.isArray(sp.t) ? sp.t[0] : undefined;
    if (!verifyToken(tagDec, t)) {
      return (
        <div className="light-page" style={{maxWidth:760, margin:'24px auto', padding:'16px'}}>
          <h1 className="text-lg font-bold mb-2" style={{color:'#0b0f12'}}>Access denied</h1>
          <p style={{color:'#374151'}}>Invalid or missing token.</p>
        </div>
      );
    }

    const job = await getJob(tagDec);

    const processingPrice = suggestedProcessingPrice(job?.processType, !!job?.beefFat, !!job?.webbsOrder);
    const specialtyPrice =
      (toInt(job?.summerSausageLbs) * 4.25) +
      (toInt(job?.summerSausageCheeseLbs) * 4.60) +
      (toInt(job?.slicedJerkyLbs) * 15.0);
    const totalPrice = processingPrice + (job?.specialtyProducts ? specialtyPrice : 0);

    return (
      <html>
        <head>
          <meta name="robots" content="noindex, nofollow, noarchive" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Intake — {tagDec}</title>
        </head>
        {/* No site chrome; white card; exact form look, but read-only */}
        <body className="light-page" style={{background:'#f1f5f9', margin:0}}>
          <main style={{maxWidth:1040, margin:'18px auto', padding:'0 14px 40px'}}>
            <div className="form-card" style={{maxWidth:980, margin:'16px auto', padding:14}}>
              <h2 style={{margin:'6px 0 10px'}}>Deer Intake (Read‑only)</h2>

              {/* Summary bar */}
              <div className="summary" style={{position:'relative', background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:10, padding:8, marginBottom:10}}>
                <div className="row" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(3, 1fr)'}}>
                  <div className="col">
                    <label>Tag Number</label>
                    <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px' }}>{job?.tag || ''}</div>
                    <div className="muted" style={{fontSize:12}}>Deer Tag</div>
                  </div>
                  <div className="col">
                    <label>Processing Price</label>
                    <div className="money" style={{ fontWeight:800, textAlign:'right', background:'#fff', border:'1px solid #d8e3f5', borderRadius:8, padding:'6px 8px' }}>{processingPrice.toFixed(2)}</div>
                    <div className="muted" style={{fontSize:12}}>Proc. type + beef fat + Webbs fee</div>
                  </div>
                  <div className="col">
                    <label>Specialty Price</label>
                    <div className="money" style={{ fontWeight:800, textAlign:'right', background:'#fff', border:'1px solid #d8e3f5', borderRadius:8, padding:'6px 8px' }}>{(job?.specialtyProducts ? specialtyPrice : 0).toFixed(2)}</div>
                    <div className="muted" style={{fontSize:12}}>Sausage/Jerky lbs</div>
                  </div>
                </div>

                <div className="row small" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(4, 1fr)', marginTop:6}}>
                  <div className="col total">
                    <label>Total (preview)</label>
                    <div className="money total" style={{ fontWeight:900 }}>{totalPrice.toFixed(2)}</div>
                  </div>
                  <div className="col">
                    <label>Status</label>
                    <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px' }}>{job?.status || ''}</div>
                  </div>
                  {job?.processType === 'Caped' && (
                    <div className="col">
                      <label>Caping Status</label>
                      <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px' }}>{job?.capingStatus || ''}</div>
                    </div>
                  )}
                  {job?.webbsOrder && (
                    <div className="col">
                      <label>Webbs Status</label>
                      <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px' }}>{job?.webbsStatus || ''}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer */}
              <section>
                <h3>Customer</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Confirmation #" value={job?.confirmation || ''} /></div>
                  <div className="c6" style={{gridColumn:'span 6'}}><Field label="Customer Name" value={job?.customer || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Phone" value={job?.phone || ''} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="Email" value={job?.email || ''} /></div>
                  <div className="c8" style={{gridColumn:'span 8'}}><Field label="Address" value={job?.address || ''} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="City" value={job?.city || ''} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="State" value={job?.state || ''} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="Zip" value={job?.zip || ''} /></div>
                </div>
              </section>

              {/* Hunt */}
              <section>
                <h3>Hunt Details</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="County Killed" value={job?.county || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Drop-off Date" value={job?.dropoff || ''} /></div>
                  <div className="c2" style={{gridColumn:'span 2'}}><Field label="Deer Sex" value={job?.sex || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Process Type" value={job?.processType || ''} /></div>
                </div>
              </section>

              {/* Cuts */}
              <section>
                <h3>Cuts</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c6" style={{gridColumn:'span 6'}}>
                    <label>Hind Quarter</label>
                    <div className="checks" style={{display:'flex', flexWrap:'wrap', gap:10}}>
                      <Check on={!!job?.hind?.['Hind - Steak']} text="Steak" />
                      <Check on={!!job?.hind?.['Hind - Roast']} text={`Roast (Count: ${job?.hindRoastCount || ''})`} />
                      <Check on={!!job?.hind?.['Hind - Grind']} text="Grind" />
                      <Check on={!!job?.hind?.['Hind - None']} text="None" />
                    </div>
                  </div>
                  <div className="c6" style={{gridColumn:'span 6'}}>
                    <label>Front Shoulder</label>
                    <div className="checks" style={{display:'flex', flexWrap:'wrap', gap:10}}>
                      <Check on={!!job?.front?.['Front - Steak']} text="Steak" />
                      <Check on={!!job?.front?.['Front - Roast']} text={`Roast (Count: ${job?.frontRoastCount || ''})`} />
                      <Check on={!!job?.front?.['Front - Grind']} text="Grind" />
                      <Check on={!!job?.front?.['Front - None']} text="None" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Packaging & Add-ons */}
              <section>
                <h3>Packaging & Add-ons</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Steak Size" value={job?.steak || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Steaks per Package" value={job?.steaksPerPackage || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}><Field label="Burger Size" value={job?.burgerSize || ''} /></div>
                  <div className="c3" style={{gridColumn:'span 3'}}>
                    <label style={{ fontSize:12, fontWeight:700, color:'#0b0f12', display:'block', marginBottom:4 }}>Beef Fat</label>
                    <Check on={!!job?.beefFat} text="Add (+$5)" />
                  </div>
                  {String(job?.steak).toLowerCase() === 'other' && job?.steakOther && (
                    <div className="c3" style={{gridColumn:'span 3'}}><Field label="Steak Size (Other)" value={job?.steakOther || ''} /></div>
                  )}
                </div>
              </section>

              {/* Backstrap */}
              <section>
                <h3>Backstrap</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="Prep" value={job?.backstrapPrep || ''} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="Thickness" value={job?.backstrapPrep === 'Whole' ? '' : (job?.backstrapThickness || '')} /></div>
                  <div className="c4" style={{gridColumn:'span 4'}}><Field label="Thickness (Other)" value={job?.backstrapPrep === 'Whole' || job?.backstrapThickness !== 'Other' ? '' : (job?.backstrapThicknessOther || '')} /></div>
                </div>
              </section>

              {/* Specialty */}
              <section>
                <h3>McAfee Specialty Products</h3>
                <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                  <div className="c12" style={{gridColumn:'span 12'}}>
                    <Check on={!!job?.specialtyProducts} text="Would like specialty products" />
                  </div>
                  {job?.specialtyProducts && (
                    <>
                      <div className="c4" style={{gridColumn:'span 4'}}><Field label="Summer Sausage (lb)" value={String(job?.summerSausageLbs ?? '')} /></div>
                      <div className="c4" style={{gridColumn:'span 4'}}><Field label="Summer Sausage + Cheese (lb)" value={String(job?.summerSausageCheeseLbs ?? '')} /></div>
                      <div className="c4" style={{gridColumn:'span 4'}}><Field label="Sliced Jerky (lb)" value={String(job?.slicedJerkyLbs ?? '')} /></div>
                    </>
                  )}
                </div>
              </section>

              {/* Webbs */}
              {job?.webbsOrder && (
                <section>
                  <h3>Webbs</h3>
                  <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                    <div className="c12" style={{gridColumn:'span 12'}}>
                      <Check on={true} text="Webbs Order (+$20 fee)" />
                    </div>
                    <div className="c6" style={{gridColumn:'span 6'}}><Field label="Webbs Order Form Number" value={job?.webbsFormNumber || ''} /></div>
                    <div className="c6" style={{gridColumn:'span 6'}}><Field label="Webbs Pounds (lb)" value={job?.webbsPounds || ''} /></div>
                  </div>
                </section>
              )}

              {/* Notes */}
              <section>
                <h3>Notes</h3>
                <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', whiteSpace:'pre-wrap' }}>
                  {job?.notes || ''}
                </div>
              </section>
            </div>
          </main>
        </body>
      </html>
    );
  } catch (err:any) {
    return (
      <html><body className="light-page">
        <div style={{maxWidth:760, margin:'24px auto', padding:'16px'}}>
          <h1 style={{color:'#0b0f12'}}>Unable to load form</h1>
          <p style={{whiteSpace:'pre-wrap', color:'#374151'}}>{String(err?.message || err)}</p>
          <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Tip: ensure NEXT_PUBLIC_GAS_BASE is your Apps Script /exec URL.</div>
        </div>
      </body></html>
    );
  }
}
