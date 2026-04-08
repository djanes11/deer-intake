// app/intake/[tag]/page.tsx — public read-only view (no actions)
import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'crypto';
import { getJobByTag } from '@/lib/jobsSupabase';
import { specialtyBreakdown, specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';
import {
  hasWebbsOrder,
  normalizeWebbsOrderStyle,
  webbsOrderStyleLabel,
  webbsPrimarySummary,
  webbsSupportSummary,
  webbsAllocationSummary,
  webbsAllocationTotalPercent,
  webbsOrderSummary,
  webbsOrderTotalLbs,
} from '@/lib/webbs';
import { calcCatalogProcessingPrice, deriveSelectedAddOnItems, filterVisibleAddOnItems } from '@/lib/processorCatalog';
import { getPublicSiteSettings } from '@/lib/siteSettings';

// ---- Config/env ----
// Keep legacy compatibility: old links used GAS_TOKEN-derived HMAC.
// Long-term: set EMAIL_SIGNING_SECRET and stop using GAS_TOKEN entirely.
const SIGNING_SECRET =
  (process.env.EMAIL_SIGNING_SECRET || process.env.GAS_TOKEN || '').trim();

// ---- Helpers ----
function hmac16(tag: string) {
  if (!SIGNING_SECRET) return '';
  return crypto.createHmac('sha256', SIGNING_SECRET).update(tag).digest('hex').slice(0, 16);
}
function verifyToken(tag: string, token: string | undefined, jobPublicToken: string | undefined) {
  const t = String(token || '').trim();
  const pub = String(jobPublicToken || '').trim();

  // Prefer new public token
  if (pub && t && t === pub) return true;

  // Allow legacy HMAC links
  if (SIGNING_SECRET) {
    const legacy = hmac16(tag);
    if (legacy && t && t === legacy) return true;
  }

  // If neither is configured, allow (dev only)
  if (!SIGNING_SECRET && !pub) return true;

  return false;
}

async function getJob(tag: string) {
  // Supabase-backed lookup (server-side)
  const res = await getJobByTag(tag);
  if (!res?.exists || !res?.job) throw new Error('Form not found for that tag.');
  // jobsSupabase already maps DB → frontend Job shape
  return res.job as Record<string, any>;
}

// ---- Simple pricing helpers to show the summary numbers like the intake page ----
// Handle numbers coming back as number/null, or as strings (just in case)
const toNumOrNull = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ---- tiny UI bits ----
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label>{label}</label>
      <div
        className="value wrap-any"
        style={{
          background:'#fff',
          border:'1px solid #cbd5e1',
          borderRadius:10,
          padding:'6px 8px',
          wordBreak:'break-word',
          overflowWrap:'anywhere',
          whiteSpace:'pre-wrap',
          minWidth: 0,
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
function asBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1','true','yes','y','on','checked','✓','✔','x'].includes(s);
}
function pick(job: Record<string, any> | undefined, keys: string[]) {
  if (!job) return undefined;
  for (const k of keys) if (job[k] !== undefined && job[k] !== null) return job[k];
  return undefined;
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
    const settings = await getPublicSiteSettings();
    const webbsEnabled = settings.features.webbsEnabled !== false;
    // Promise props (Next 15)
    const { tag } = await params;
    const sp = (await (searchParams ?? Promise.resolve({}))) as SP;

    const tagDec = decodeURIComponent(tag);
    const t = typeof sp.t === 'string' ? sp.t : Array.isArray(sp.t) ? sp.t[0] : undefined;
    const job = await getJob(tagDec);
    const jobPublicToken = String((job as any)?.publicToken || (job as any)?.public_token || '').trim();
    if (!verifyToken(tagDec, t, jobPublicToken)) {
      return (
        <div className="light-page" style={{maxWidth:760, margin:'24px auto', padding:'16px'}}>
          <h1 className="text-lg font-bold mb-2" style={{color:'#0b0f12'}}>Access denied</h1>
          <p style={{color:'#374151'}}>Invalid or missing token.</p>
        </div>
      );
    }

    // --- Pricing (auto vs override) ---
    const selectedAddOnItems = deriveSelectedAddOnItems(
      {
        addOnItems: (job as any)?.addOnItems,
        beefFat: !!job?.beefFat,
        webbsOrder: !!job?.webbsOrder,
      },
      settings.addOnCatalog,
    );
    const visibleAddOnItems = filterVisibleAddOnItems(selectedAddOnItems, webbsEnabled);
    const processingAuto = calcCatalogProcessingPrice(
      {
        processType: job?.processType,
        addOnItems: selectedAddOnItems,
        beefFat: !!job?.beefFat,
        webbsOrder: !!job?.webbsOrder,
      },
      settings.processCatalog,
      settings.addOnCatalog,
    );

    const specialtyAuto = job?.specialtyProducts ? calcSpecialtyPrice(job, settings.pricing, settings.specialtyCatalog) : 0;
    const specialtyItems = specialtyBreakdown(job, settings.pricing, settings.specialtyCatalog).filter((item) => item.pounds > 0);
    const webbsItems = webbsOrderSummary(job?.webbsItems);
    const webbsItemTotal = webbsOrderTotalLbs(job?.webbsItems);
    const webbsAllocations = webbsAllocationSummary(job?.webbsAllocations);
    const webbsAllocationTotal = webbsAllocationTotalPercent(job?.webbsAllocations);
    const webbsOrderStyle = normalizeWebbsOrderStyle(job?.webbsOrderStyle || job?.webbs_order_style);
    const hasWebbs = hasWebbsOrder(job?.webbsOrder ?? job?.webbs_order);
    const webbsSummaryText = webbsPrimarySummary({
      webbsOrder: hasWebbs,
      webbsOrderStyle,
      webbsFormNumber: job?.webbsFormNumber || job?.webbsOrderFormNumber || '',
      webbsPounds: job?.webbsPounds || job?.webbs_pounds || '',
      webbsItems: job?.webbsItems,
      webbsAllocations: job?.webbsAllocations,
    });
    const webbsSupportText = webbsSupportSummary({
      webbsPaperFormCompleted: (job as any)?.webbsPaperFormCompleted ?? (job as any)?.webbs_paper_form_completed,
    });

    const processingOverride = toNumOrNull(
      (job as any)?.processing_price_override ?? (job as any)?.processingPriceOverride
    );
    const specialtyOverride = toNumOrNull(
      (job as any)?.specialty_price_override ?? (job as any)?.specialtyPriceOverride
    );

    const processingUsed = (processingOverride ?? processingAuto);
    const specialtyUsed = (specialtyOverride ?? specialtyAuto);

    const totalUsed = processingUsed + specialtyUsed;

    // --- Communication Preference + Consent ---
    const prefEmail        = asBool(pick(job, ['Pref Email','prefEmail']));
    const prefSMS          = asBool(pick(job, ['Pref SMS','prefSMS']));
    const prefCall         = asBool(pick(job, ['Pref Call','prefCall']));
    const smsConsent       = asBool(pick(job, ['SMS Consent','smsConsent']));

    // Pull specialty status for summary bar
    const specialtyStatus =
      String(pick(job, ['Specialty Status', 'specialtyStatus']) ?? '').trim();

    const showSpecialtyStatus =
      !!job?.specialtyProducts || specialtyStatus.length > 0;

    return (
      <main className="ro" style={{maxWidth:1040, margin:'18px auto', padding:'0 14px 40px'}}>
        <div className="form-card" style={{maxWidth:980, margin:'16px auto', padding:14}}>
          <h2 style={{margin:'6px 0 10px'}}>Deer Intake (Read-only)</h2>

          {/* Summary bar */}
          <div className="summary" style={{position:'relative', background:'#f8fafc', border:'1px solid #e6e9ec', borderRadius:10, padding:8, marginBottom:10}}>
            <div className="row grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(3, 1fr)'}}>
              <div className="col" style={{minWidth:0}}>
                <label>Tag Number</label>
                <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0 }}>{job?.tag || ''}</div>
                <div className="muted" style={{fontSize:12}}>Deer Tag</div>
              </div>

              <div className="col" style={{minWidth:0}}>
                <label>Processing Price</label>
                <div className="money" style={{ fontWeight:800, textAlign:'right', background:'#fff', border:'1px solid #d8e3f5', borderRadius:8, padding:'6px 8px', minWidth:0 }}>
                  {`$${processingUsed.toFixed(2)}`}
                  {processingOverride !== null ? ' (override)' : ''}
                </div>
                <div className="muted" style={{fontSize:12}}>
                  {processingOverride !== null
                    ? `Auto would be: $${processingAuto.toFixed(2)}`
                    : 'Base process type + selected add-ons'}
                </div>
              </div>

              <div className="col" style={{minWidth:0}}>
                <label>Specialty Price</label>
                <div className="money" style={{ fontWeight:800, textAlign:'right', background:'#fff', border:'1px solid #d8e3f5', borderRadius:8, padding:'6px 8px', minWidth:0 }}>
                  {`$${specialtyUsed.toFixed(2)}`}
                  {specialtyOverride !== null ? ' (override)' : ''}
                </div>
                <div className="muted" style={{fontSize:12}}>
                  {specialtyOverride !== null
                    ? `Auto would be: $${specialtyAuto.toFixed(2)}`
                    : 'Specialty product selections'}
                </div>
              </div>
            </div>

            <div
              className="row grid small"
              style={{
                display:'grid',
                gap:8,
                gridTemplateColumns:'repeat(5, 1fr)',
                marginTop:6
              }}
            >
              <div className="col total" style={{minWidth:0}}>
                <label>Total (preview)</label>
                <div className="money total" style={{ fontWeight:900, minWidth:0 }}>{`$${totalUsed.toFixed(2)}`}</div>
              </div>
              <div className="col" style={{minWidth:0}}>
                <label>Status</label>
                <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0 }}>{job?.status || ''}</div>
              </div>
              {job?.processType === 'Caped' && (
                <div className="col" style={{minWidth:0}}>
                  <label>Caping Status</label>
                  <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0 }}>{job?.capingStatus || ''}</div>
                </div>
              )}
              {webbsEnabled && job?.webbsOrder && (
                <div className="col" style={{minWidth:0}}>
                  <label>Webbs Status</label>
                  <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0 }}>{job?.webbsStatus || ''}</div>
                </div>
              )}
              {showSpecialtyStatus && (
                <div className="col" style={{minWidth:0}}>
                  <label>Specialty Status</label>
                  <div style={{ background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0 }}>
                    {specialtyStatus}
                  </div>
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
              <div className="c3" style={{gridColumn:'span 3'}}><label>Phone</label><div className="value wrap-any">{job?.phone || ''}</div></div>
              <div className="c8" style={{gridColumn:'span 8'}}>
                <label>Email</label>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <div
                    className="value wrap-any"
                    style={{
                      background:'#fff',
                      border:'1px solid #cbd5e1',
                      borderRadius:10,
                      padding:'6px 8px',
                      wordBreak:'break-word',
                      overflowWrap:'anywhere',
                      whiteSpace:'pre-wrap',
                      flex:'1 1 auto',
                      minWidth:0
                    }}
                  >{job?.email || ''}</div>
                </div>
              </div>
              <div className="c4" style={{gridColumn:'span 4'}}><Field label="Address" value={job?.address || ''} /></div>
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
              <div className="c3" style={{gridColumn:'span 3'}}><Field label="Steaks per Package" value={job?.steaksPerPackage || ''} /></div>
              <div className="c3" style={{gridColumn:'span 3'}}><Field label="Burger Size" value={job?.burgerSize || ''} /></div>
              <div className="c6" style={{gridColumn:'span 6'}}>
                <Field
                  label="Selected Add-Ons"
                  value={
                    visibleAddOnItems.length
                      ? visibleAddOnItems.map((item) => `${item.name}${item.price ? ` (+$${Number(item.price).toFixed(2)})` : ''}`).join('\n')
                      : 'No add-ons selected'
                  }
                />
              </div>
            </div>
          </section>

          {/* Backstrap */}
          <section>
            <h3>Backstrap</h3>
            <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
              <div className="c4" style={{gridColumn:'span 4'}}><Field label="Prep" value={job?.backstrapPrep || ''} /></div>
            </div>
          </section>

          {/* Specialty */}
          <section>
            <h3>Specialty Products</h3>
            <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
              <div className="c12" style={{gridColumn:'span 12'}}>
                <Check on={!!job?.specialtyProducts} text="Would like specialty products" />
              </div>
              {job?.specialtyProducts && (
                <>
                  {specialtyItems.map((item) => (
                    <div className="c4" style={{gridColumn:'span 4'}} key={item.key}>
                      <Field label={item.label} value={`${item.pounds} lb`} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Webbs */}
          {webbsEnabled && hasWebbs && (
            <section>
              <h3>Webbs</h3>
              <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
                <div className="c12" style={{gridColumn:'span 12'}}>
                  <Check on={true} text="Webbs Order (+$20 fee)" />
                </div>
                <div className="c12" style={{gridColumn:'span 12'}}>
                  <Field label="Webbs Summary" value={webbsSummaryText} />
                </div>
                {webbsSupportText ? (
                  <div className="c6" style={{gridColumn:'span 6'}}><Field label="Support Note" value={webbsSupportText} /></div>
                ) : null}
                <div className="c12" style={{gridColumn:'span 12'}}>
                  <Field
                    label="Webbs Order Style"
                    value={webbsOrderStyleLabel(webbsOrderStyle)}
                  />
                </div>
                {webbsOrderStyle === 'whole_deer_percent' && webbsAllocations.length > 0 && (
                  <div className="c12" style={{gridColumn:'span 12'}}>
                    <Field
                      label={`Webbs Percent Allocation (${webbsAllocationTotal}%)`}
                      value={webbsAllocations.join('\n')}
                    />
                  </div>
                )}
                {webbsOrderStyle !== 'whole_deer_percent' && webbsItems.length > 0 && (
                  <div className="c12" style={{gridColumn:'span 12'}}>
                    <Field
                      label={`Webbs Items (${webbsItemTotal} lb total)`}
                      value={webbsItems.join('\n')}
                    />
                  </div>
                )}
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

          {/* Communication & Consent */}
          <section>
            <h3>Communication & Consent</h3>
            <div className="grid" style={{display:'grid', gap:8, gridTemplateColumns:'repeat(12, 1fr)'}}>
              <div className="c6" style={{gridColumn:'span 6'}}>
                <label>Communication Preference</label>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <Check on={prefEmail} text="Email" />
                  <Check on={prefSMS} text="Text (SMS)" />
                  <Check on={prefCall} text="Phone Call" />
                </div>
              </div>
              <div className="c6" style={{gridColumn:'span 6'}}>
                <label>Consent</label>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <Check on={smsConsent} text="I consent to receive informational SMS" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  } catch (err:any) {
    return (
      <div className="light-page" style={{maxWidth:760, margin:'24px auto', padding:'16px'}}>
        <h1 style={{color:'#0b0f12'}}>Unable to load form</h1>
        <p style={{whiteSpace:'pre-wrap', color:'#374151'}}>{String(err?.message || err)}</p>
        <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>
          Tip: if this is a public link, make sure the tag exists in the database and the token is valid.
        </div>
      </div>
    );
  }
}
