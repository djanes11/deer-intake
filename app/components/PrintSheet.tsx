'use client';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  hasSpecialtySelection,
  specialtyBreakdown,
  specialtyPrice as calcSpecialtyPrice,
  specialtyTotalLbs,
} from '@/lib/specialty';
import {
  hasWebbsOrder,
  normalizeWebbsAllocations,
  normalizeWebbsOrderItems,
  normalizeWebbsOrderStyle,
  webbsOrderStyleLabel,
  webbsPrimarySummary,
  webbsSupportSummary,
  webbsAllocationTotalPercent,
  webbsOrderTotalLbs,
} from '@/lib/webbs';

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
function numOrNull(x: any): number | null {
  if (x === undefined || x === null) return null;
  const s = String(x).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function asPounds(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function money(n: number): string {
  return '$' + (Number.isFinite(n) ? n.toFixed(2) : '0.00');
}

function shortWebbsLabel(label: string): string {
  return label
    .replace(/^Venison\s+/i, 'V. ')
    .replace(/\bwith\b/gi, 'w')
    .replace(/\bCheddar\b/gi, 'Chedd')
    .replace(/\bJalapeno\b/gi, 'Jal.')
    .replace(/\bChipotle\b/gi, 'Chip.')
    .replace(/\bSummer Sausage\b/gi, 'Summer')
    .replace(/\bHot & Spicy\b/gi, 'Hot/Spicy')
    .replace(/\bGreen Pepper Onions\b/gi, 'G. Pepper/Onion')
    .replace(/\bSausage Link\b/gi, 'Link')
    .replace(/\bSnack Links\b/gi, 'Snack Links')
    .replace(/\bSnack Sticks\b/gi, 'Snack Sticks')
    .replace(/\bSkinless Weiners\b/gi, 'Skinless Wieners')
    .replace(/\s+/g, ' ')
    .trim();
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
    p === 'Cape & Donate' ? 20 :
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  const beefAdd  = (typeof beef  === 'boolean' ? beef  : String(beef ).toLowerCase() === 'true') ? 5  : 0;
  const webbsAdd = (typeof webbs === 'boolean' ? webbs : String(webbs).toLowerCase() === 'true') ? 20 : 0;
  return base + beefAdd + webbsAdd;
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

  const specialtyItems = useMemo(() => specialtyBreakdown(job), [
    job?.originalSummerSausageLbs,
    job?.original_summer_sausage_lbs,
    job?.summerSausageLbs,
    job?.summer_sausage_lbs,
    job?.summerSausageCheeseLbs,
    job?.summer_sausage_cheese_lbs,
    job?.jalapenoSummerSausageCheeseLbs,
    job?.jalapeno_summer_sausage_cheese_lbs,
    job?.slicedJerkyLbs,
    job?.sliced_jerky_lbs,
    job?.originalSnackSticksLbs,
    job?.original_snack_sticks_lbs,
    job?.originalSnackSticksCheeseLbs,
    job?.original_snack_sticks_cheese_lbs,
    job?.jalapenoSnackSticksCheeseLbs,
    job?.jalapeno_snack_sticks_cheese_lbs,
  ]);
  const specialtyLbs = useMemo(() => specialtyTotalLbs(job), [specialtyItems]);

  const processingOverride = useMemo(
    () => numOrNull(jpick(job, ['processing_price_override', 'processingPriceOverride'])),
    [job?.processing_price_override, job?.processingPriceOverride]
  );

  const specialtyOverride = useMemo(
    () => numOrNull(jpick(job, ['specialty_price_override', 'specialtyPriceOverride'])),
    [job?.specialty_price_override, job?.specialtyPriceOverride]
  );

  // Stored processing price (historical field) or computed auto price as fallback
  const processingStored = useMemo(() => {
    const v = numOrNull(
      jpick(job, ['Processing Price', 'priceProcessing', 'processing_price', 'price_processing'])
    );
    return v;
  }, [job?.['Processing Price'], job?.priceProcessing, job?.processing_price, job?.price_processing]);

  const processingPrice = processingOverride ?? processingStored ?? proc;

  const specialtyAuto = useMemo(() => calcSpecialtyPrice(job), [specialtyItems]);
  const specialtyPrice = specialtyOverride ?? specialtyAuto;
  const webbsItems = useMemo(() => normalizeWebbsOrderItems(job?.webbsItems), [job?.webbsItems]);
  const webbsAllocations = useMemo(() => normalizeWebbsAllocations(job?.webbsAllocations), [job?.webbsAllocations]);
  const webbsItemTotal = useMemo(() => webbsOrderTotalLbs(job?.webbsItems), [job?.webbsItems]);
  const webbsAllocationTotal = useMemo(() => webbsAllocationTotalPercent(job?.webbsAllocations), [job?.webbsAllocations]);
  const webbsItemLines = useMemo(
    () => webbsItems.map((item) => `${shortWebbsLabel(item.label)} ${item.pounds} lb`),
    [webbsItems]
  );
  const webbsAllocationLines = useMemo(
    () => webbsAllocations.map((item) => `${shortWebbsLabel(item.label)} ${item.percent}%`),
    [webbsAllocations]
  );
  const webbsOrderStyle = useMemo(
    () => normalizeWebbsOrderStyle(textVal('webbsOrderStyle', 'webbs_order_style')),
    [job?.webbsOrderStyle, job?.webbs_order_style]
  );
  const webbsPaperFormCompleted = truthy('webbsPaperFormCompleted', 'webbs_paper_form_completed');
  const hasDenseWebbsList = (webbsOrderStyle === 'whole_deer_percent' ? webbsAllocationLines.length : webbsItemLines.length) > 10;
  const hasSpecialty = truthy('Specialty Products','specialtyProducts','Would like specialty products','specialty_products') || hasSpecialtySelection(job);
  const hasWebbs = hasWebbsOrder(jpick(job, ['Webbs Order', 'webbsOrder', 'webbs_order']));
  const webbsSummaryText = useMemo(
    () =>
      webbsPrimarySummary({
        webbsOrder: hasWebbs,
        webbsOrderStyle,
        webbsFormNumber: textVal('Webbs Order Form Number','webbsOrderFormNumber','webbsFormNumber','Webbs Form Number'),
        webbsPounds: textVal('Webbs Pounds', 'webbsPounds', 'webbsLbs', 'Webbs Pounds (lb)'),
        webbsItems,
        webbsAllocations,
      }),
    [hasWebbs, webbsOrderStyle, job?.webbsOrderFormNumber, job?.webbsFormNumber, job?.['Webbs Form Number'], job?.webbsPounds, job?.webbsLbs, job?.['Webbs Pounds'], webbsItems, webbsAllocations]
  );
  const webbsSupportText = useMemo(
    () => webbsSupportSummary({ webbsPaperFormCompleted }),
    [webbsPaperFormCompleted]
  );
  const notesText = textVal('Notes','notes');
  const hasNotes = !!notesText.trim();
  const paidInFull = truthy('Paid','paid','Paid in Full','Paid In Full');
  const paidProcessing = truthy('Paid Processing','paidProcessing','paid_processing');
  const paidSpecialty = truthy('Paid Specialty','paidSpecialty','paid_specialty');

  const totalPrice = processingPrice + specialtyPrice;

  const copies = 1;

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

// NOW derive flags strictly from booleans; support nested exact keys and aliases. No count-based inference.
const hindSteak = truthy('Hind - Steak','hindSteak', (hindObj as any)['Hind - Steak'], (hindObj as any).steak);
const hindRoast = truthy('Hind - Roast','hindRoast', (hindObj as any)['Hind - Roast'], (hindObj as any).roast);
const hindGrind = truthy('Hind - Grind','hindGrind', (hindObj as any)['Hind - Grind'], (hindObj as any).grind);
const hindNone  = truthy('Hind - None','hindNone',   (hindObj as any)['Hind - None'],  (hindObj as any).none);

const frontRoast = truthy('Front - Roast','frontRoast', (frontObj as any)['Front - Roast'], (frontObj as any).roast);
const frontGrind = truthy('Front - Grind','frontGrind', (frontObj as any)['Front - Grind'], (frontObj as any).grind);
const frontNone  = truthy('Front - None','frontNone',   (frontObj as any)['Front - None'],  (frontObj as any).none);

const hindSelections = [
  hindSteak ? 'Steak' : '',
  hindRoast ? `Roast${hindRoastCnt ? ` (${hindRoastCnt})` : ''}` : '',
  hindGrind ? 'Grind' : '',
  hindNone ? 'None' : '',
].filter(Boolean);

const frontSelections = [
  frontRoast ? `Roast${frontRoastCnt ? ` (${frontRoastCnt})` : ''}` : '',
  frontGrind ? 'Grind' : '',
  frontNone ? 'None' : '',
].filter(Boolean);

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
            JB(el, tagKey, { format: 'CODE128', displayValue: false, height: 22, margin: 0 });
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
  (p as HTMLElement).style.setProperty('--print-scale', '1');
  (p as HTMLElement).dataset.overflow = h > printable ? '1' : '0';
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
    <div key={i} className={`page ${copies === 1 && i === 0 ? "onepage" : ""}`}>
      {!hideHeader && <header className="hdr">Processor Intake Sheet</header>}

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
            <div className="splitPriceRow">
              <div className="lhs">
                Processing{processingOverride !== null ? <span style={{ fontWeight: 800, fontSize: 12 }}> (override)</span> : null}
              </div>
              <div className="money">{money(processingPrice)}</div>
            </div>
            {processingOverride !== null ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Auto</div>
                <div style={{ fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{money(proc)}</div>
              </div>
            ) : null}

            <div className="splitPriceRow">
              <div className="lhs">
                Specialty{specialtyOverride !== null ? <span style={{ fontWeight: 800, fontSize: 12 }}> (override)</span> : null}
              </div>
              <div className="money">{money(specialtyPrice)}</div>
            </div>
            {specialtyOverride !== null ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Auto</div>
                <div style={{ fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{money(specialtyAuto)}</div>
              </div>
            ) : null}
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
      <div className="row grid12 meat-row">
        <div className="col-6 box">
          <div className="label">Hind Quarter</div>
          <div className="val cutSummary">
            {hindSelections.length ? hindSelections.join(' | ') : '—'}
          </div>
        </div>
        <div className="col-6 box">
          <div className="label">Front Shoulder</div>
          <div className="val cutSummary">
            {frontSelections.length ? frontSelections.join(' | ') : '—'}
          </div>
        </div>
      </div>

      {/* Row E */}
      <div className="row grid12 meat-row">
        <div className="col-4 box">
          <div className="label">Steaks per Package</div>
          <div className="val">
            {textVal(
              'Steaks per Package','Steaks Per Package',
              'Steaks/Package','Steaks Per Pkg',
              'steaksPerPackage','steaks_per_package','SteaksPerPackage'
            )}
          </div>
        </div>

        <div className="col-4 box">
          <div className="label">Burger Size</div>
          <div className="val">
            {textVal('Burger Size','burgerSize','burger_size')}
          </div>
        </div>

        <div className="col-4 box">
          <div className="label">Beef Fat</div>
          <div className="val">
            <strong className="check">{truthy('Beef Fat','beefFat','beef_fat') ? CHK : BOX}</strong> Adds $5
          </div>
        </div>
      </div>

      {/* Row: Backstrap */}
      <div className="row grid12 meat-row">
        <div className="col-12 box">
          <div className="label">Backstrap Prep</div>
          <div className="val bs-val">
            {textVal(
              'Backstrap Prep','backstrapPrep','backstrap_prep',
              'Back Strap Prep','back_strap_prep'
            )}
          </div>
        </div>
      </div>

      {/* Row F */}
      <div className="row grid12 meat-row">
        <div className={`col-3 box ${hasSpecialty ? 'attentionBox specialtyFlagBox' : ''}`}>
          <div className="label">Specialty Products</div>
          <div className={`val ${hasSpecialty ? 'attentionValue' : ''}`}>
            <strong className="check">{hasSpecialty ? CHK : BOX}</strong>{' '}
            {hasSpecialty ? 'SPECIALTY ORDER' : 'No specialty products'}
          </div>
        </div>

        <div className={`col-9 box ${hasSpecialty ? 'attentionBox specialtyDetailBox' : ''}`}>
          <div className="label">Specialty Detail (lb)</div>
          <div className={`val ${hasSpecialty ? 'attentionValue' : ''}`}>
            <div className="specRow">
              <div className="specLine">
                {specialtyItems.filter((item) => item.pounds > 0).length > 0 ? (
                  specialtyItems
                    .filter((item) => item.pounds > 0)
                    .map((item, idx) => (
                      <span key={item.key}>
                        {idx > 0 ? ' | ' : ''}
                        <b>{item.shortLabel}:</b> {item.pounds || ''}
                      </span>
                    ))
                ) : (
                  <span>No specialty products selected</span>
                )}
              </div>
              <div className="specTotal"><b>Total lbs:</b> {specialtyLbs || ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row G */}
      <div className="row grid12 meat-row">
        <div className={`col-12 box ${hasNotes ? 'attentionBox notesBox' : ''}`}>
          <div className="label">Notes</div>
          <div className={`val ${hasNotes ? 'attentionValue notesValue' : ''}`}>{notesText || 'No additional notes'}</div>
        </div>
      </div>

      {/* Row H */}
      <div className="row grid12 meat-row">
        <div className={`col-3 box ${hasWebbs ? 'attentionBox webbsFlagBox' : ''}`}>
          <div className="label">Webbs Order</div>
          <div className={`val ${hasWebbs ? 'attentionValue' : ''}`}>
            <strong className="check">{hasWebbs ? CHK : BOX}</strong>{' '}
            {hasWebbs ? 'WEBBS ORDER' : 'No Webbs order'}
          </div>
        </div>
        <div className={`col-9 box ${hasWebbs ? 'attentionBox webbsDetailBox' : ''}`}>
          <div className="label">Webbs Details</div>
          <div className={`val ${hasWebbs ? 'attentionValue' : ''}`}>
            <div className="webbsMetaRow">
              <div><b>Summary:</b> {webbsSummaryText}</div>
              <div><b>Style:</b> {webbsOrderStyleLabel(webbsOrderStyle)}</div>
              {webbsSupportText ? <div><b>Support:</b> {webbsSupportText}</div> : null}
            </div>
            {webbsOrderStyle === 'whole_deer_percent' && webbsAllocationLines.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div><b>Percent Allocation ({webbsAllocationTotal}%):</b></div>
                <div className={`webbsItemsGrid ${hasDenseWebbsList ? 'dense' : ''}`}>
                  {webbsAllocationLines.map((line) => (
                    <div key={line} className="webbsItemLine">{line}</div>
                  ))}
                </div>
              </div>
            )}
            {webbsOrderStyle !== 'whole_deer_percent' && webbsItemLines.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div><b>Detailed Items ({webbsItemTotal} lb):</b></div>
                <div className={`webbsItemsGrid ${hasDenseWebbsList ? 'dense' : ''}`}>
                  {webbsItemLines.map((line) => (
                    <div key={line} className="webbsItemLine">{line}</div>
                  ))}
                </div>
              </div>
            )}
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
            <div><span className="check">{truthy('SMS Consent','smsConsent','consentSMS') ? CHK : BOX}</span> I consent to receive informational SMS</div>
          </div>
        </div>
      </div>

      {/* Row J */}
      <div className="row grid12">
        <div className="col-6 box attentionBox paymentBox">
          <div className="label">Payment Status</div>
          <div className="val attentionValue paymentSummary">
            <div><strong className="check">{paidInFull ? CHK : BOX}</strong> Paid in full</div>
            <div><strong className="check">{paidProcessing ? CHK : BOX}</strong> Processing paid</div>
            {hasSpecialty ? <div><strong className="check">{paidSpecialty ? CHK : BOX}</strong> Specialty paid</div> : null}
          </div>
        </div>
        <div className="col-6 box">
          <div className="label">Signature (on pickup)</div>
          <div className="val signatureLine"></div>
        </div>
      </div>

      <footer className="ftr">Processor intake sheet | Tag {tagKey}</footer>
    </div>
  );

  return (
    <div ref={rootRef} className="printsheet">
      {Array.from({ length: copies }).map((_, i) => renderCopy(i))}
</div>
  );
}
