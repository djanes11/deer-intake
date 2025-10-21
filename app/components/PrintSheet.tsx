'use client';
import React, { useEffect, useMemo, useRef } from 'react';

type AnyRec = Record<string, any>;

export interface PrintSheetProps {
  tag?: string;
  job?: AnyRec | null;
  hideHeader?: boolean;
}

const CHK = '☑';
const BOX = '☐';

/* ---------------- helpers ---------------- */
function jpick<T = any>(obj: AnyRec | null | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined as any;
  for (const k of keys) {
    const v = (obj as AnyRec)[k];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined as any;
}
function jget(job: AnyRec | null | undefined, keys: string[]): string {
  const v = jpick(job, keys);
  return v === undefined ? '' : String(v);
}
function asNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function asPounds(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function money(n: number): string {
  return '$' + (Number.isFinite(n) ? n.toFixed(2) : '0.00');
}

/* ALWAYS treat strings as KEYS when reading */
function truthyFactory(job: AnyRec | null | undefined) {
  return function truthy(...cands: any[]): boolean {
    for (const c of cands) {
      const v = (typeof c === 'string') ? (job as any)?.[c] : c;
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toLowerCase();
      if (['true','1','yes','y','x','t','on','✓','☑'].includes(s)) return true;
      if (!Number.isNaN(Number(s)) && Number(s) > 0) return true;
      return false;
    }
    return false;
  };
}
function textValFactory(job: AnyRec | null | undefined) {
  return function textVal(...cands: any[]): string {
    for (const c of cands) {
      const v = (typeof c === 'string') ? (job as any)?.[c] : c;
      if (v !== undefined && v !== null && String(v) !== '') return String(v);
    }
    return '';
  };
}

/* ---------------- price helpers ---------------- */
function normProc(v: any): string {
  const s = String(v || '').toLowerCase();
  if (!s) return '';
  if (s.includes('cape') && s.includes('donate')) return 'Cape & Donate';
  if (s.includes('cape')) return 'Caped';
  if (s.includes('skull')) return 'Skull-Cap';
  if (s.includes('euro')) return 'European';
  if (s.includes('standard')) return 'Standard Processing';
  if (s.includes('donate')) return 'Donate';
  return '';
}
function suggestedProcessingPrice(proc: any, beef: any, webbs: any): number {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  const beefAdd  = (typeof beef  === 'boolean' ? beef  : String(beef ).toLowerCase() === 'true') ? 5  : 0;
  const webbsAdd = (typeof webbs === 'boolean' ? webbs : String(webbs).toLowerCase() === 'true') ? 20 : 0;
  return base + beefAdd + webbsAdd;
}
function hasSpecialty(job: AnyRec | null | undefined): boolean {
  if (!job) return false;
  const truthy = truthyFactory(job);
  const checkbox = truthy('Specialty Products','specialtyProducts','Would like specialty products','specialty_products');
  const ss  = asPounds(jget(job, ['Summer Sausage (lb)','summerSausageLbs','summer_sausage_lbs']));
  const ssc = asPounds(jget(job, ['Summer Sausage + Cheese (lb)','summerSausageCheeseLbs','summer_sausage_cheese_lbs']));
  const jer = asPounds(jget(job, ['Sliced Jerky (lb)','slicedJerkyLbs','sliced_jerky_lbs']));
  return checkbox || (ss + ssc + jer) > 0;
}

/* ---------------- component ---------------- */
export default function PrintSheet({ tag, job, hideHeader }: PrintSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const truthy = truthyFactory(job);
  const textVal = textValFactory(job);

  const tagKey = useMemo(
    () => String((job && (job['Tag'] ?? job.tag ?? job?.tag_id ?? job?.tagId)) ?? tag ?? ''),
    [job?.['Tag'], job?.tag, job?.tag_id, job?.tagId, tag]
  );

  // Prices (robust reads)
  const proc = useMemo(() => suggestedProcessingPrice(
    jpick(job, ['Process Type','processType','process_type']),
    jpick(job, ['Beef Fat','beefFat','beef_fat']),
    jpick(job, ['Webbs Order','webbsOrder','webbs_order'])
  ), [job?.['Process Type'], job?.processType, job?.process_type, job?.['Beef Fat'], job?.beefFat, job?.beef_fat, job?.['Webbs Order'], job?.webbsOrder, job?.webbs_order]);

  const ssN  = useMemo(() => asPounds(jget(job, ['Summer Sausage (lb)','summerSausageLbs','summer_sausage_lbs'])), [job?.['Summer Sausage (lb)'], job?.summerSausageLbs, job?.summer_sausage_lbs]);
  const sscN = useMemo(() => asPounds(jget(job, ['Summer Sausage + Cheese (lb)','summerSausageCheeseLbs','summer_sausage_cheese_lbs'])), [job?.['Summer Sausage + Cheese (lb)'], job?.summerSausageCheeseLbs, job?.summer_sausage_cheese_lbs]);
  const jerN = useMemo(() => asPounds(jget(job, ['Sliced Jerky (lb)','slicedJerkyLbs','sliced_jerky_lbs'])), [job?.['Sliced Jerky (lb)'], job?.slicedJerkyLbs, job?.sliced_jerky_lbs]);
  const specialtyLbs = ssN + sscN + jerN;

  const processingPrice = useMemo(() => {
    const v = asNum(jpick(job, ['Processing Price','priceProcessing','processing_price']));
    return v > 0 ? v : proc;
  }, [proc, job?.['Processing Price'], job?.priceProcessing, job?.processing_price]);

  const specialtyPrice = useMemo(() => ssN * 4.25 + sscN * 4.60 + jerN * 15.0, [ssN, sscN, jerN]);
  const totalPrice = processingPrice + specialtyPrice;

  const copies = useMemo(
    () => (hasSpecialty(job) ? 2 : 1),
    [job?.['Summer Sausage (lb)'], job?.['Summer Sausage + Cheese (lb)'], job?.['Sliced Jerky (lb)'], job?.['Specialty Products'], job?.summerSausageLbs, job?.summerSausageCheeseLbs, job?.slicedJerkyLbs, job?.specialtyProducts]
  );

// add these right before the hind/front derived flags
const hindObj  = (job && (job as any).hind)  || {};
const frontObj = (job && (job as any).front) || {};

// include nested roastCount fallbacks
const hindRoastCnt = useMemo(
  () => {
    const fromSheet = asPounds(jget(job, ['Hind Roast Count','hindRoastCount']));
    const fromObj   = asPounds((hindObj as any).roastCount);
    return fromSheet || fromObj || 0;
  },
  [job?.['Hind Roast Count'], job?.hindRoastCount, (hindObj as any).roastCount]
);

const frontRoastCnt = useMemo(
  () => {
    const fromSheet = asPounds(jget(job, ['Front Roast Count','frontRoastCount']));
    const fromObj   = asPounds((frontObj as any).roastCount);
    return fromSheet || fromObj || 0;
  },
  [job?.['Front Roast Count'], job?.frontRoastCount, (frontObj as any).roastCount]
);

// NOW derive flags from (sheet boolean) OR (nested boolean) OR (count>0 for roast)
const hindSteak = truthy('Hind - Steak','hindSteak', (hindObj as any).steak);
const hindRoast = truthy('Hind - Roast','hindRoast', (hindObj as any).roast) || hindRoastCnt > 0;
const hindGrind = truthy('Hind - Grind','hindGrind', (hindObj as any).grind);
const hindNone  = truthy('Hind - None','hindNone', (hindObj as any).none);

const frontSteak = truthy('Front - Steak','frontSteak', (frontObj as any).steak);
const frontRoast = truthy('Front - Roast','frontRoast', (frontObj as any).roast) || frontRoastCnt > 0;
const frontGrind = truthy('Front - Grind','frontGrind', (frontObj as any).grind);
const frontNone  = truthy('Front - None','frontNone', (frontObj as any).none);

  /* -------- barcode on every copy -------- */
  useEffect(() => {
    const container = rootRef.current;
    if (!container || !tagKey) return;
    const nodes = Array.from(container.querySelectorAll('svg[data-barcode]')) as SVGSVGElement[];
    if (!nodes.length) return;

    const drawAll = () => {
      try {
        // @ts-ignore
        const JB = (typeof window !== 'undefined' ? (window as any).JsBarcode : null);
        if (!JB) return;
        nodes.forEach((el) => {
          try {
            while (el.firstChild) el.removeChild(el.firstChild);
            // @ts-ignore
            JB(el, tagKey, { format: 'CODE128', displayValue: false, height: 30, margin: 0 });
          } catch {}
        });
      } catch {}
    };

    const ensureLib = () => {
      // @ts-ignore
      if (typeof window !== 'undefined' && (window as any).JsBarcode) { drawAll(); return; }
      if (typeof document !== 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = drawAll;
        document.head.appendChild(s);
      }
    };

    ensureLib();
    const t1 = setTimeout(drawAll, 50);
    const t2 = setTimeout(drawAll, 200);
    const t3 = setTimeout(drawAll, 500);

    const onBeforePrint = () => setTimeout(drawAll, 0);
    const onVis = () => { if (document.visibilityState === 'visible') setTimeout(drawAll, 0); };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', onBeforePrint);
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeprint', onBeforePrint);
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [tagKey, copies]);

  // one-page fit, no phantom last page
  useEffect(() => {
    const adjust = () => {
      const pages = rootRef.current?.querySelectorAll<HTMLElement>('.printsheet .page');
      if (!pages || !pages.length) return;

      const first = pages[0];
      if (first) {
        const h0 = first.scrollHeight;
        let mode: 't0' | 't1' | 't2' = 't0';
        if (h0 > 980) mode = 't2';
        else if (h0 > 940) mode = 't1';
        (document.documentElement as any).dataset.tight = mode;
      }
      const MM_PER_IN = 25.4, DPI = 96, MARGIN_MM = 5;
      const printable = Math.round(11 * DPI - 2 * MARGIN_MM * (DPI / MM_PER_IN));
      pages.forEach(p => {
        const h = p.scrollHeight;
        let sc = 1;
        if (h > printable) sc = Math.max(0.93, (printable - 3) / h);
        (p as HTMLElement).style.setProperty('--print-scale', String(sc));
      });
    };
    adjust();
    const onBeforePrint = () => setTimeout(adjust, 0);
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', onBeforePrint);
      return () => window.removeEventListener('beforeprint', onBeforePrint);
    }
  }, [copies, tagKey]);

  const renderCopy = (i: number) => (
    <div key={i} className="page">
      {!hideHeader && <header className="hdr">McAfee Custom Deer Processing — Palmyra, IN</header>}

      {/* Row A */}
      <div className="row grid12 rowA">
        <div className="col-3 box">
          <div className="label">Tag #</div>
          <div className="val">
            <div data-barcode-wrap><svg data-barcode /></div>
            <div className="tagText">{tagKey}</div>
          </div>
        </div>
        <div className="col-3 box">
          <div className="label">Confirmation #</div>
          <div className="val" id="p_conf">
            {textVal('Confirmation #','Confirmation','Confirmation Number','confirmation','confirmationNumber')}
          </div>
        </div>
        <div className="col-3 box">
          <div className="label">Drop-off Date</div>
          <div className="val" id="p_drop">
            {textVal('Drop-off Date','Drop Off Date','Drop off Date','Date Dropped','Drop Date','dropoff','drop_off_date')}
          </div>
        </div>
        <div className="col-3 box">
          <div className="label">Price</div>
          <div className="val">
            <div className="splitPriceRow"><div className="lhs">Processing</div><div className="money">{money(processingPrice)}</div></div>
            <div className="splitPriceRow"><div className="lhs">Specialty</div><div className="money">{money(specialtyPrice)}</div></div>
            <div className="splitSep" />
            <div className="splitPriceRow"><div className="lhs">Total</div><div className="moneyTotal">{money(totalPrice)}</div></div>
          </div>
        </div>
      </div>

      {/* Row B */}
      <div className="row grid12">
        <div className="col-6 box">
          <div className="label">Customer</div>
          <div className="val">
            <div>{textVal('Customer','Customer Name','customer','name')}</div>
            <div>{textVal('Phone','Phone Number','phone','phoneNumber')}</div>
            <div>{textVal('Email','email')}</div>
          </div>
        </div>
        <div className="col-6 box">
          <div className="label">Address</div>
          <div className="val">
            <div>{textVal('Address','address','street','street1')}</div>
            <div>{[
              textVal('City','city'),
              textVal('State','state'),
              textVal('Zip','Zip Code','zip','postal')
            ].filter(Boolean).join(', ')}</div>
          </div>
        </div>
      </div>

      {/* Row C */}
      <div className="row grid12">
        <div className="col-4 box"><div className="label">County Killed</div><div className="val">{textVal('County Killed','County','county')}</div></div>
        <div className="col-4 box"><div className="label">Sex</div><div className="val">{textVal('Sex','Deer Sex','sex')}</div></div>
        <div className="col-4 box"><div className="label">Process Type</div><div className="val">{textVal('Process Type','processType','process_type')}</div></div>
      </div>

      {/* Row D: Hind | Front (with None, roast derives from count) */}
      <div className="row grid12">
        <div className="col-6 box">
          <div className="label">Hind Quarter</div>
          <div className="val"><strong className="check">{hindSteak ? CHK : BOX}</strong> Steak</div>
          <div className="val">
            <strong className="check">{hindRoast ? CHK : BOX}</strong> Roast
            &nbsp; Count: <span id="ph_rc">{hindRoastCnt || ''}</span>
          </div>
          <div className="val"><strong className="check">{hindGrind ? CHK : BOX}</strong> Grind</div>
          <div className="val"><strong className="check">{hindNone  ? CHK : BOX}</strong> None</div>
        </div>
        <div className="col-6 box">
          <div className="label">Front Shoulder</div>
          <div className="val"><strong className="check">{frontSteak ? CHK : BOX}</strong> Steak</div>
          <div className="val">
            <strong className="check">{frontRoast ? CHK : BOX}</strong> Roast
            &nbsp; Count: <span id="pf_rc">{frontRoastCnt || ''}</span>
          </div>
          <div className="val"><strong className="check">{frontGrind ? CHK : BOX}</strong> Grind</div>
          <div className="val"><strong className="check">{frontNone  ? CHK : BOX}</strong> None</div>
        </div>
      </div>

      {/* Row E */}
      <div className="row grid12">
        <div className="col-3 box">
          <div className="label">Steak Size</div>
          <div className="val">{textVal('Steak','steak','steakSize','Steak Size')}</div>
        </div>
        <div className="col-3 box">
          <div className="label">Steak Size (Other)</div>
          <div className="val">{textVal('Steak Size (Other)','Steak Size Other','steakSizeOther','steakOther','steak_size_other','Steak size other','SteakSizeOther')}</div>
        </div>
        <div className="col-3 box">
          <div className="label">Burger Size</div>
          <div className="val">{textVal('Burger Size','burgerSize','burger_size')}</div>
        </div>
        <div className="col-3 box">
          <div className="label">Beef Fat</div>
          <div className="val"><strong className="check">{truthy('Beef Fat','beefFat','beef_fat') ? CHK : BOX}</strong> Adds $5</div>
        </div>
      </div>

      {/* Row F */}
      <div className="row grid12">
        <div className="col-3 box">
          <div className="label">Specialty Products</div>
          <div className="val">
            <strong className="check">{truthy('Specialty Products','specialtyProducts','Would like specialty products','specialty_products') ? CHK : BOX}</strong> Would like specialty products
          </div>
        </div>
        <div className="col-9 box">
          <div className="label">Specialty Detail (lb)</div>
          <div className="val">
            <div className="specialtyRow">
              <div><b>Summer Sausage:</b> {ssN || ''}</div>
              <div><b>+ Cheese:</b> {sscN || ''}</div>
              <div><b>Sliced Jerky:</b> {jerN || ''}</div>
              <div className="totSpec"><b>Total lbs:</b> {specialtyLbs || ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row G */}
      <div className="row grid12">
        <div className="col-12 box"><div className="label">Notes</div><div className="val">{textVal('Notes','notes')}</div></div>
      </div>

      {/* Row H */}
      <div className="row grid12">
        <div className="col-3 box">
          <div className="label">Webbs Order</div>
          <div className="val"><strong className="check">{truthy('Webbs Order','webbsOrder','webbs_order') ? CHK : BOX}</strong> Webbs order</div>
        </div>
        <div className="col-9 box">
          <div className="label">Webbs Details</div>
          <div className="val">
            <div className="webbsRow">
              <div><b>Form #:</b> {textVal('Webbs Order Form Number','webbsOrderFormNumber','webbsFormNumber','Webbs Form Number')}</div>
              <div><b>Pounds:</b> {textVal('Webbs Pounds','webbsPounds','webbsLbs','Webbs Pounds (lb)')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row I */}
      <div className="row grid12">
        <div className="col-12 box">
          <div className="label">Contact Preference</div>
          <div className="val">
            <span className="check">{truthy('Pref Email','prefEmail') ? CHK : BOX}</span> Email &nbsp;&nbsp;
            <span className="check">{truthy('Pref SMS','prefSMS') ? CHK : BOX}</span> Text (SMS) &nbsp;&nbsp;
            <span className="check">{truthy('Pref Call','prefCall') ? CHK : BOX}</span> Phone Call
          </div>
        </div>
      </div>
      <div className="row grid12">
        <div className="col-12 box">
          <div className="label">Consent</div>
          <div className="val">
            <div><span className="check">{truthy('SMS Consent','smsConsent','consentSMS') ? CHK : BOX}</span> I consent to receive informational/automated SMS</div>
            <div><span className="check">{truthy('Auto Call Consent','autoCallConsent','consentCall','consentAutoCall') ? CHK : BOX}</span> I consent to receive automated phone calls</div>
          </div>
        </div>
      </div>

      {/* Row J */}
      <div className="row grid12">
        <div className="col-3 box">
          <div className="label">Paid</div>
          <div className="val"><strong className="check">{truthy('Paid','paid','Paid in Full','Paid In Full') ? CHK : BOX}</strong> Paid in full</div>
        </div>
        <div className="col-9 box">
          <div className="label">Signature (on pickup)</div>
          <div className="val signatureLine"></div>
        </div>
      </div>

      <footer className="ftr">localhost:3000/intake?tag={tagKey}</footer>
    </div>
  );

  return (
    <div ref={rootRef} className="printsheet">
      {Array.from({ length: copies }).map((_, i) => renderCopy(i))}

      <style jsx global>{`
        .printsheet{
          --ps-bg:#fff; --ps-text:#0d1117;
          --ps-border:#cdd9ee; --ps-val-border:#dfe7f7;
          --ps-radius:12px; --ps-pad-box:4px; --ps-pad-val:4px;
          --ps-fs-h:18px; --ps-fs-base:13.3px; --ps-fs-label:10.4px;
          --ps-gap-row:3px; --ps-gap-col:6px;
          --print-scale:1;
          max-width:800px; margin:0 auto; padding:8px;
          color:var(--ps-text);
        }
        .printsheet .hdr, .printsheet .ftr{ font-size:11px; color:#555; text-align:center; margin:6px 0; }
        .printsheet .page{
          background:var(--ps-bg);
          border-radius:var(--ps-radius);
          padding:10px;
          break-inside: avoid;
          transform-origin: top left;
          transform: scale(var(--print-scale, 1));
        }
        .printsheet .row{ margin-top: var(--ps-gap-row); }
        .printsheet .grid12{ display:grid; grid-template-columns: repeat(12, 1fr); gap: var(--ps-gap-col); }
        .printsheet .col-3{ grid-column: span 3; } .printsheet .col-4{ grid-column: span 4; }
        .printsheet .col-6{ grid-column: span 6; } .printsheet .col-9{ grid-column: span 9; } .printsheet .col-12{ grid-column: 1 / -1; }

        .printsheet .box{ padding:var(--ps-pad-box); border:1px solid var(--ps-border); border-radius:var(--ps-radius); background: #fff; }
        .printsheet .label{ font-size:var(--ps-fs-label); color:#334155; font-weight:700; margin-bottom:2px; }
        .printsheet .val{ padding:var(--ps-pad-val); border:1px solid var(--ps-val-border); border-radius:calc(var(--ps-radius) - 1px); font-size:var(--ps-fs-base); min-height:22px; }
        .printsheet .rowA .box .val{ padding: calc(var(--ps-pad-val) - 1px) calc(var(--ps-pad-val) - 1px); min-height:18px; }
        .printsheet .check{ font-family: monospace; font-weight: 700; }
        .printsheet .money{ font-weight:800; } .printsheet .moneyTotal{ font-weight:900; }
        .printsheet .splitPriceRow{ display:flex; align-items:center; gap:6px; }
        .printsheet .splitPriceRow .lhs{ flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .printsheet .splitSep{ border-top:1px dashed #ccd7ee; margin:3px 0; }
        .printsheet [data-barcode-wrap]{ margin-top:2px; overflow:hidden; }
        .printsheet svg[data-barcode]{ width:100%; height:32px; display:block; max-width:100%; }
        .printsheet .tagText{ font-weight:900; letter-spacing:1.1px; margin-top:2px; }
        .printsheet .specialtyRow, .printsheet .webbsRow { display:flex; gap:8px; flex-wrap:wrap; }
        .printsheet .totSpec { margin-left:auto; }
        .printsheet .signatureLine{ height:26px; }

        @media print{
          .printsheet > .page + .page { break-before: page; page-break-before: always; }
          @page{ size: letter portrait; margin: 5mm; }
          :root[data-tight='t1']{
            --ps-fs-base:12.3px; --ps-fs-h:15.6px; --ps-fs-label:9.8px;
            --ps-pad-box:3px; --ps-pad-val:2px 4px;
            --ps-gap-row:3px; --ps-gap-col:6px;
          }
          :root[data-tight='t2']{
            --ps-fs-base:11.9px; --ps-fs-h:15px; --ps-fs-label:9.4px;
            --ps-pad-box:2px; --ps-pad-val:2px 4px;
            --ps-gap-row:2px; --ps-gap-col:6px;
          }
        }
      `}</style>
    </div>
  );
}



