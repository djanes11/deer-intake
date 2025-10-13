// app/components/PrintSheet.tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';

type CutsBlock = {
  'Hind - Steak'?: boolean;
  'Hind - Roast'?: boolean;
  'Hind - Grind'?: boolean;
  'Hind - None'?: boolean;
  'Front - Steak'?: boolean;
  'Front - Roast'?: boolean;
  'Front - Grind'?: boolean;
  'Front - None'?: boolean;
};

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

  steak?: string;
  steakOther?: string;
  burgerSize?: string;
  steaksPerPackage?: string;
  beefFat?: boolean;

  hindRoastCount?: string;
  frontRoastCount?: string;

  hind?: CutsBlock;
  front?: CutsBlock;

  backstrapPrep?: string;
  backstrapThickness?: string;
  backstrapThicknessOther?: string;

  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;

  notes?: string;

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;

  // NEW (show-only)
  prefEmail?: boolean;
  prefSMS?: boolean;
  prefCall?: boolean;
  smsConsent?: boolean;
  autoCallConsent?: boolean;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function normProc(s?: string) {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}
function suggestedProcessingPrice(proc?: string, beef?: boolean, webbs?: boolean) {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing','Skull-Cap','European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}
const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function PrintSheet({ job }: { job: Job }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const processingPrice = useMemo(
    () => suggestedProcessingPrice(job?.processType, !!job?.beefFat, !!job?.webbsOrder),
    [job?.processType, job?.beefFat, job?.webbsOrder]
  );
  const specialtyPrice = useMemo(() => {
    if (!job?.specialtyProducts) return 0;
    const ss  = toInt(job?.summerSausageLbs);
    const ssc = toInt(job?.summerSausageCheeseLbs);
    const jer = toInt(job?.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 15.0;
  }, [job?.specialtyProducts, job?.summerSausageLbs, job?.summerSausageCheeseLbs, job?.slicedJerkyLbs]);
  const totalPrice = processingPrice + specialtyPrice;

  // Lazy-load JsBarcode and draw the barcode. Emit a ready signal for the caller.
  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    // reset flag before attempting to draw
    root.removeAttribute('data-barcode-ready');

    const tag = String(job?.tag || '').trim();
    const showWraps = (on: boolean) => {
      const wraps = root.querySelectorAll<HTMLElement>('[data-barcode-wrap]');
      wraps.forEach((el) => (el.style.display = on ? '' : 'none'));
    };

    const draw = () => {
      if (!('JsBarcode' in (window as any))) return;
      try {
        const JsBarcode: any = (window as any).JsBarcode;
        svg.innerHTML = '';
        JsBarcode(svg, tag || '—', {
          format: 'CODE128',
          displayValue: true,
          fontSize: 14,
          margin: 0,
          height: 44,
          width: 2,
          text: tag || '—',
        });

        // show wraps and signal readiness
        showWraps(true);
        root.setAttribute('data-barcode-ready', '1');
        document.dispatchEvent(new Event('barcode:ready'));
      } catch {
        // hide on error
        showWraps(false);
        root.removeAttribute('data-barcode-ready');
      }
    };

    // hide until drawn
    showWraps(false);

    if ((window as any).JsBarcode) {
      draw();
      return;
    }
    // load from CDN once
    const existing = document.querySelector<HTMLScriptElement>('script[data-jsbarcode]');
    if (existing) {
      existing.addEventListener('load', draw, { once: true });
      existing.addEventListener('error', () => showWraps(false), { once: true });
      return () => {
        existing.removeEventListener('load', draw);
      };
    }

    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-jsbarcode', '1');
    s.onload = draw;
    s.onerror = () => showWraps(false);
    document.head.appendChild(s);

    return () => {
      s.onload = null;
      s.onerror = null;
    };
  }, [job?.tag]);

  return (
    <div ref={rootRef} id="print-sheet" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>McAfee Custom Deer Processing</div>
          <div style={{ fontSize:12, color:'#374151' }}>Intake Print Sheet</div>
        </div>
        <div data-barcode-wrap>
          <svg ref={svgRef} data-tag-barcode role="img" aria-label="Tag barcode" />
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(3,1fr)', marginBottom:10 }}>
        <div>
          <label style={lbl}>Tag Number</label>
          <div style={box}>{job?.tag || ''}</div>
          <div style={muted}>Deer Tag</div>
        </div>
        <div>
          <label style={lbl}>Processing Price</label>
          <div style={{...box, fontWeight:800, textAlign:'right'}}>{money(processingPrice)}</div>
          <div style={muted}>Proc. type + beef fat + Webbs fee</div>
        </div>
        <div>
          <label style={lbl}>Specialty Price</label>
          <div style={{...box, fontWeight:800, textAlign:'right'}}>{money(job?.specialtyProducts ? specialtyPrice : 0)}</div>
          <div style={muted}>Sausage/Jerky lbs</div>
        </div>
      </div>

      {/* Totals + statuses */}
      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(4,1fr)', marginBottom:12 }}>
        <div>
          <label style={lbl}>Total (preview)</label>
          <div style={{...box, fontWeight:900, textAlign:'right'}}>{money(totalPrice)}</div>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <div style={box}>{job?.status || ''}</div>
        </div>
        {job?.processType === 'Caped' && (
          <div>
            <label style={lbl}>Caping Status</label>
            <div style={box}>{job?.capingStatus || ''}</div>
          </div>
        )}
        {!!job?.webbsOrder && (
          <div>
            <label style={lbl}>Webbs Status</label>
            <div style={box}>{job?.webbsStatus || ''}</div>
          </div>
        )}
      </div>

      {/* Customer */}
      <section style={{ marginTop:8 }}>
        <h3 style={h3}>Customer</h3>
        <div style={grid12}>
          <div style={c3}><LabelVal label="Confirmation #" value={job?.confirmation} /></div>
          <div style={c6}><LabelVal label="Customer Name" value={job?.customer} /></div>
          <div style={c3}><LabelVal label="Phone" value={job?.phone} /></div>
          <div style={c4}><LabelVal label="Email" value={job?.email} /></div>
          <div style={c8}><LabelVal label="Address" value={job?.address} /></div>
          <div style={c4}><LabelVal label="City" value={job?.city} /></div>
          <div style={c4}><LabelVal label="State" value={job?.state} /></div>
          <div style={c4}><LabelVal label="Zip" value={job?.zip} /></div>
        </div>
      </section>

      {/* Hunt */}
      <section>
        <h3 style={h3}>Hunt Details</h3>
        <div style={grid12}>
          <div style={c4}><LabelVal label="County Killed" value={job?.county} /></div>
          <div style={c3}><LabelVal label="Drop-off Date" value={job?.dropoff} /></div>
          <div style={c2}><LabelVal label="Deer Sex" value={job?.sex} /></div>
          <div style={c3}><LabelVal label="Process Type" value={job?.processType} /></div>
        </div>
      </section>

      {/* Cuts */}
      <section>
        <h3 style={h3}>Cuts</h3>
        <div style={grid12}>
          <div style={c6}>
            <label style={lbl}>Hind Quarter</label>
            <div style={checks}>
              <Check on={!!job?.hind?.['Hind - Steak']} text="Steak" />
              <Check on={!!job?.hind?.['Hind - Roast']} text={`Roast (Count: ${job?.hindRoastCount || ''})`} />
              <Check on={!!job?.hind?.['Hind - Grind']} text="Grind" />
              <Check on={!!job?.hind?.['Hind - None']} text="None" />
            </div>
          </div>
          <div style={c6}>
            <label style={lbl}>Front Shoulder</label>
            <div style={checks}>
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
        <h3 style={h3}>Packaging & Add-ons</h3>
        <div style={grid12}>
          <div style={c3}><LabelVal label="Steak Size" value={job?.steak} /></div>
          <div style={c3}><LabelVal label="Steaks per Package" value={job?.steaksPerPackage} /></div>
          <div style={c3}><LabelVal label="Burger Size" value={job?.burgerSize} /></div>
          <div style={c3}>
            <label style={lbl}>Beef Fat</label>
            <Check on={!!job?.beefFat} text="Add (+$5)" />
          </div>
          {String(job?.steak).toLowerCase() === 'other' && job?.steakOther && (
            <div style={c3}><LabelVal label="Steak Size (Other)" value={job?.steakOther} /></div>
          )}
        </div>
      </section>

      {/* Backstrap */}
      <section>
        <h3 style={h3}>Backstrap</h3>
        <div style={grid12}>
          <div style={c4}><LabelVal label="Prep" value={job?.backstrapPrep} /></div>
          <div style={c4}><LabelVal label="Thickness" value={job?.backstrapPrep === 'Whole' ? '' : (job?.backstrapThickness || '')} /></div>
          <div style={c4}><LabelVal label="Thickness (Other)" value={job?.backstrapPrep === 'Whole' || job?.backstrapThickness !== 'Other' ? '' : (job?.backstrapThicknessOther || '')} /></div>
        </div>
      </section>

      {/* Specialty */}
      {job?.specialtyProducts && (
        <section>
          <h3 style={h3}>McAfee Specialty Products</h3>
          <div style={grid12}>
            <div style={c4}><LabelVal label="Summer Sausage (lb)" value={String(job?.summerSausageLbs ?? '')} /></div>
            <div style={c4}><LabelVal label="Summer Sausage + Cheese (lb)" value={String(job?.summerSausageCheeseLbs ?? '')} /></div>
            <div style={c4}><LabelVal label="Sliced Jerky (lb)" value={String(job?.slicedJerkyLbs ?? '')} /></div>
          </div>
        </section>
      )}

      {/* Webbs */}
      {job?.webbsOrder && (
        <section>
          <h3 style={h3}>Webbs</h3>
          <div style={grid12}>
            <div style={c12}><Check on text="Webbs Order (+$20 fee)" /></div>
            <div style={c6}><LabelVal label="Webbs Order Form Number" value={job?.webbsFormNumber} /></div>
            <div style={c6}><LabelVal label="Webbs Pounds (lb)" value={job?.webbsPounds} /></div>
          </div>
        </section>
      )}

      {/* Notes */}
      <section>
        <h3 style={h3}>Notes</h3>
        <div style={{...box, whiteSpace:'pre-wrap'}}>{job?.notes || ''}</div>
      </section>

      {/* Communication & Consent */}
      <section>
        <h3 style={h3}>Communication & Consent</h3>
        <div style={grid12}>
          <div style={c6}>
            <label style={lbl}>Communication Preference</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <Check on={!!job?.prefEmail} text="Email" />
              <Check on={!!job?.prefSMS} text="Text (SMS)" />
              <Check on={!!job?.prefCall} text="Phone Call" />
            </div>
          </div>
          <div style={c6}>
            <label style={lbl}>Consent</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <Check on={!!job?.smsConsent} text="I consent to receive informational/automated SMS" />
              <Check on={!!job?.autoCallConsent} text="I consent to receive automated phone calls" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LabelVal({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={box}>{value || ''}</div>
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

const lbl: React.CSSProperties = { fontSize:12, fontWeight:700, color:'#0b0f12', display:'block', marginBottom:4 };
const box: React.CSSProperties = { background:'#fff', border:'1px solid #cbd5e1', borderRadius:10, padding:'6px 8px', minWidth:0, overflowWrap:'anywhere' };
const muted: React.CSSProperties = { fontSize:12, color:'#6b7280' };
const h3: React.CSSProperties = { margin:'12px 0 6px' };

const grid12: React.CSSProperties = { display:'grid', gap:8, gridTemplateColumns:'repeat(12,1fr)' };
const c12 = { gridColumn:'span 12' } as React.CSSProperties;
const c8  = { gridColumn:'span 8' } as React.CSSProperties;   // <-- added
const c6  = { gridColumn:'span 6' } as React.CSSProperties;
const c4  = { gridColumn:'span 4' } as React.CSSProperties;
const c3  = { gridColumn:'span 3' } as React.CSSProperties;
const c2  = { gridColumn:'span 2' } as React.CSSProperties;
const checks: React.CSSProperties = { display:'flex', flexWrap:'wrap', gap:10 };
