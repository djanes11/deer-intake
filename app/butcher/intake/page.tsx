'use client';
import { Suspense } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useScanner } from '@/lib/useScanner';
import { progress, getJob } from '@/lib/api';
import { specialtyBreakdown, specialtyPrice as calcSpecialtyPrice, specialtyTotalLbs } from '@/lib/specialty';

// Ensure this page never gets statically prerendered (depends on URL params & client hooks)
export const dynamic = 'force-dynamic';

type CutsBlock = {
  'Hind - Steak'?: boolean; 'Hind - Roast'?: boolean; 'Hind - Grind'?: boolean; 'Hind - None'?: boolean;
  'Front - Steak'?: boolean; 'Front - Roast'?: boolean; 'Front - Grind'?: boolean; 'Front - None'?: boolean;
};
type Job = {
  tag?: string | null; status?: string; Paid?: boolean; paid?: boolean; paidProcessing?: boolean; paidSpecialty?: boolean; processType?: string; sex?: string;
  hind?: CutsBlock; front?: CutsBlock; hindRoastCount?: string; frontRoastCount?: string;
  steak?: string; steaksPerPackage?: string; burgerSize?: string; beefFat?: boolean;
  backstrapPrep?: string; backstrapThickness?: string;
  specialtyProducts?: boolean; originalSummerSausageLbs?: string|number; summerSausageCheeseLbs?: string|number; jalapenoSummerSausageCheeseLbs?: string|number; originalSnackSticksLbs?: string|number; originalSnackSticksCheeseLbs?: string|number; jalapenoSnackSticksCheeseLbs?: string|number;
  webbsOrder?: boolean; webbsFormNumber?: string; webbsPounds?: string;
  notes?: string; price?: number|string; priceProcessing?: number|string; priceSpecialty?: number|string; priceTotal?: number|string; amountPaidProcessing?: number|string; amountPaidSpecialty?: number|string; customer?: string;
  specialtyItems?: Array<Record<string, any>>;
};

const moneyNumber = (v: any) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function truthy(v: any) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'paid', 'x', 'on'].includes(s);
}

function firstMoney(...values: any[]) {
  for (const value of values) {
    const parsed = moneyNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function priceSummary(job: Job) {
  const processing = firstMoney(job.priceProcessing, (job as any).price_processing, (job as any).processingPrice) ?? 0;
  const computedSpecialty = calcSpecialtyPrice(job as any);
  const specialty = firstMoney(job.priceSpecialty, (job as any).price_specialty, (job as any).specialtyPrice) ?? computedSpecialty;
  const total = firstMoney(job.price, job.priceTotal, (job as any).price_total) ?? (processing + specialty);
  return { processing, specialty, total: Math.max(total, processing + specialty) };
}

function paymentSummary(job: Job, prices: ReturnType<typeof priceSummary>) {
  const paidOverall = truthy(job.paid ?? job.Paid);
  const paidProcessing = paidOverall || truthy(job.paidProcessing);
  const paidSpecialty = paidOverall || truthy(job.paidSpecialty);
  const amountPaidProcessing = Math.min(firstMoney(job.amountPaidProcessing, (job as any).amount_paid_processing) ?? 0, prices.processing);
  const amountPaidSpecialty = Math.min(firstMoney(job.amountPaidSpecialty, (job as any).amount_paid_specialty) ?? 0, prices.specialty);
  const processingDue = paidProcessing ? 0 : Math.max(0, prices.processing - amountPaidProcessing);
  const specialtyDue = paidSpecialty ? 0 : Math.max(0, prices.specialty - amountPaidSpecialty);
  return {
    paidOverall: paidOverall || (prices.total > 0 && processingDue + specialtyDue <= 0),
    amountPaid: amountPaidProcessing + amountPaidSpecialty,
    processingDue,
    specialtyDue,
    totalDue: processingDue + specialtyDue,
  };
}

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

// Outer page component wrapped in Suspense so useSearchParams is legal
export default function Page() {
  return (
    <Suspense fallback={<main className="page-wrap butcher-mode"><div style={{ padding: 16 }}>Loading...</div></main>}>
      <ButcherIntakeInner />
    </Suspense>
  );
}

function ButcherIntakeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tag = sp.get('tag') || '';
  const [job, setJob] = useState<Job>({ tag, status: 'Processing' });
  const [msg, setMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prices = useMemo(() => priceSummary(job), [job]);
  const payment = useMemo(() => paymentSummary(job, prices), [job, prices]);
  const price = prices.total;
  const notesText = String(job.notes || '').trim();
  const watchFor = useMemo(() => {
    const items: string[] = [];
    if (job.beefFat) items.push('Add-on: Beef Fat');
    if (job.webbsOrder) items.push(`Webbs: ${job.webbsPounds ? `${job.webbsPounds} lb entered` : 'Order on file'}`);
    const specialtyLines = specialtyBreakdown(job as any)
      .filter((item) => Number(item.pounds || 0) > 0)
      .map((item) => `${item.shortLabel || item.label}: ${Number(item.pounds || 0)} lb`);
    const specTotal = specialtyTotalLbs(job as any);
    if (specialtyLines.length) items.push(`Specialty: ${specialtyLines.join(', ')}`);
    else if (job.specialtyProducts || specTotal > 0) items.push(`Specialty total: ${specTotal} lb`);
    if (payment.amountPaid > 0 && payment.totalDue > 0) items.push(`Paid so far: ${money(payment.amountPaid)}`);
    if (payment.totalDue > 0) {
      const parts = [
        payment.processingDue > 0 ? `processing ${money(payment.processingDue)}` : '',
        payment.specialtyDue > 0 ? `specialty ${money(payment.specialtyDue)}` : '',
      ].filter(Boolean);
      items.push(`Balance due: ${money(payment.totalDue)}${parts.length ? ` (${parts.join(' + ')})` : ''}`);
    } else {
      items.push('Paid in full');
    }
    return items;
  }, [job, payment]);

  // Load job
  useEffect(() => {
    (async () => {
      if (!tag) return;
      try{
        const res = await getJob(tag);
        if (res?.exists && res.job) setJob(res.job);
        else setMsg('We could not find that tag. Go back to Search or Scan and try the deer again.');
      }catch(e:any){ setMsg(`Could not load this butcher view. ${e?.message || 'Try Search or Scan again.'}`); }
    })();
    // Fullscreen + wake lock
    (async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch {}
      // @ts-ignore
      try { if (navigator.wakeLock?.request) { /* @ts-ignore */ await navigator.wakeLock.request('screen'); } } catch {}
    })();
  }, [tag]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setMsg('Use the browser full-screen control or F11 if the browser blocks this button.');
      setTimeout(() => setMsg(''), 2400);
    }
  };

  // Listen for second scan to finish
  useScanner(async (scanned) => {
    if (scanned !== tag) return;
    try {
      const res = await progress(scanned); // accepts string or { tag }
      if (res?.ok && res.nextStatus === 'Finished') {
        setMsg('Finished');
        setTimeout(()=> router.replace('/scan'), 800);
      } else {
        setMsg(res?.error || 'Could not finish this deer from the scan page. Try scanning again or open the intake to update it manually.');
        setTimeout(()=> setMsg(''), 1200);
      }
    } catch (e:any) {
      setMsg(`Could not finish this deer from the scan page. ${e?.message || 'Try scanning again or open the intake to update it manually.'}`);
      setTimeout(()=> setMsg(''), 1200);
    }
  });

  // Auto-fit to viewport (no scroll)
  const rootRef = useRef<HTMLDivElement|null>(null);
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current; if (!el) return;
      el.style.transform = 'scale(1)';
      el.style.transformOrigin = 'top left';
      const rect = el.getBoundingClientRect();
      const scale = Math.min(window.innerWidth / rect.width, (window.innerHeight - 12) / rect.height, 1);
      el.style.transform = `scale(${scale})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [job, watchFor.length]);

  // Barcode render (compact)
  useEffect(() => {
    const render = () => {
      try {
        const code = job?.tag || '';
        const wraps = document.querySelectorAll<HTMLElement>('#barcodeWrap');
        if (!code) { wraps.forEach(w => w.style.display='none'); return; }
        // @ts-ignore
        const JsBarcode = (window as any).JsBarcode;
        if (!JsBarcode) return;
        document.querySelectorAll<SVGSVGElement>('svg#tagBarcode').forEach(svg => {
          JsBarcode(svg, code, {
            format:'CODE128', lineColor:'#111', width:2.2, height:70, displayValue:true,
            font:'monospace', fontSize:24, textMargin:4, margin:0
          });
        });
      } catch (e) {
        console.error('Barcode render error', e);
        document.querySelectorAll<HTMLElement>('#barcodeWrap').forEach(w => (w.style.display='none'));
      }
    };
    // lazy load if needed
    // @ts-ignore
    if ((window as any).JsBarcode) render();
    else {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      s.onload = render;
      s.onerror = () => document.querySelectorAll<HTMLElement>('#barcodeWrap').forEach(w => (w.style.display='none'));
      document.head.appendChild(s);
    }
  }, [job?.tag]);

  return (
    <main className="page-wrap butcher-mode" style={{ minHeight: '100vh', padding: 'clamp(8px, 1vh, 18px)', background: '#061015' }}>
      <div className="butcher-root" ref={rootRef}>
        <div style={{ marginBottom: 'clamp(10px, 1.1vh, 22px)', display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', color: '#f3f4f6', fontWeight: 900, lineHeight: 1.18, fontSize: 'clamp(24px, 1.65vw, 46px)' }}>
          <div>Next: review the deer, watch the highlighted callouts, then scan the same tag again when the work is done.</div>
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              flex: '0 0 auto',
              border: '1px solid rgba(255,255,255,.22)',
              background: 'rgba(255,255,255,.08)',
              color: '#f8fafc',
              borderRadius: 10,
              padding: 'clamp(10px, .9vw, 22px) clamp(14px, 1.2vw, 32px)',
              fontSize: 'clamp(20px, 1.35vw, 36px)',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
        <div className="toprow">
          <div className="tagbox">
            <div className="tag">{job.tag || '-'}</div>
            <div id="barcodeWrap"><svg id="tagBarcode" role="img" aria-label="Tag barcode"></svg></div>
          </div>
          <div className="statusbox">
            <div className="row"><span className="label">Status</span><span className="badge">{job.status || '-'}</span></div>
            <div className="row"><span className="label">Payment</span><span className={'pill ' + (payment.totalDue <= 0 ? 'on' : '')}>{payment.totalDue <= 0 ? 'PAID' : `${money(payment.totalDue)} DUE`}</span></div>
            <div className="row price"><span className="label">Total</span><span className="money">{money(price)}</span></div>
          </div>
          <div className="who">
            <div className="name">{job.customer || '-'}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            border: notesText ? '1px solid rgba(245, 215, 72, .46)' : '1px solid rgba(148,163,184,.28)',
            background: notesText ? 'rgba(113,63,18,.32)' : 'rgba(15,23,42,.34)',
            color: notesText ? '#fff7cc' : '#cbd5e1',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 'clamp(24px, 1.45vw, 40px)', fontWeight: 900, letterSpacing: 0, textTransform: 'uppercase' }}>Notes</div>
          <div style={{ fontSize: notesText.length > 120 ? 'clamp(42px, 3.2vw, 86px)' : 'clamp(54px, 4.2vw, 112px)', fontWeight: 950, lineHeight: 1.06, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {notesText || 'No notes on this deer.'}
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 'clamp(18px, 1.6vw, 42px)', borderRadius: 16, border: '1px solid rgba(250,204,21,.34)', background: 'rgba(120,53,15,.18)', color: '#fef3c7', display: 'grid', gap: 'clamp(10px, .9vw, 24px)' }}>
          <div style={{ fontSize: 'clamp(26px, 1.6vw, 44px)', fontWeight: 900, letterSpacing: 0, textTransform: 'uppercase' }}>Watch For</div>
          <div style={{ display: 'grid', gap: 'clamp(8px, .7vw, 18px)' }}>
            {watchFor.map((item) => (
              <div key={item} style={{ fontSize: 'clamp(38px, 3vw, 84px)', fontWeight: 950, lineHeight: 1.08 }}>{item}</div>
            ))}
          </div>
        </div>

        {/* ...rest of your UI/cards/actions remain unchanged... */}

      </div>
      <style jsx>{`
        .butcher-root {
          width: calc(100vw - clamp(16px, 2vh, 36px));
          min-height: calc(100vh - clamp(16px, 2vh, 36px));
          margin: 0 auto;
          padding: clamp(18px, 2vw, 46px);
          box-sizing: border-box;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 18px;
          background: linear-gradient(180deg, #0b1117, #061015);
          box-shadow: 0 24px 80px rgba(0,0,0,.38);
          color: #f8fafc;
          overflow: hidden;
        }

        .toprow {
          display: grid;
          grid-template-columns: minmax(420px, .95fr) minmax(360px, .75fr) minmax(520px, 1.3fr);
          gap: clamp(14px, 1.4vw, 34px);
          align-items: stretch;
        }

        .tagbox,
        .statusbox,
        .who {
          border: 1px solid rgba(148, 163, 184, .25);
          border-radius: 16px;
          background: rgba(15, 23, 42, .72);
          padding: clamp(18px, 1.7vw, 42px);
          min-width: 0;
        }

        .tagbox {
          display: grid;
          gap: 10px;
          align-content: center;
        }

        .tag {
          font-size: clamp(96px, 9vw, 230px);
          line-height: .86;
          font-weight: 950;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        #barcodeWrap {
          min-height: clamp(60px, 5vh, 110px);
          border-radius: 10px;
          background: #ffffff;
          padding: clamp(8px, .7vw, 18px) clamp(10px, 1vw, 24px);
          overflow: hidden;
        }

        #tagBarcode {
          display: block;
          width: 100%;
          height: clamp(52px, 4.6vh, 96px);
        }

        .statusbox {
          display: grid;
          gap: clamp(12px, 1vw, 26px);
        }

        .row {
          display: grid;
          grid-template-columns: clamp(110px, 7vw, 190px) minmax(0, 1fr);
          gap: clamp(10px, 1vw, 26px);
          align-items: center;
          border-bottom: 1px solid rgba(148, 163, 184, .16);
          padding-bottom: clamp(12px, 1vw, 24px);
        }

        .row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .label {
          color: #a8b6c1;
          font-size: clamp(20px, 1.25vw, 36px);
          font-weight: 900;
          text-transform: uppercase;
        }

        .badge,
        .pill,
        .money {
          font-size: clamp(48px, 4.1vw, 108px);
          line-height: 1;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #7c2d12;
          color: #ffedd5;
          padding: clamp(10px, .8vw, 22px) clamp(12px, 1vw, 26px);
          text-align: center;
        }

        .pill.on {
          background: #14532d;
          color: #dcfce7;
        }

        .who {
          display: grid;
          align-content: center;
        }

        .name {
          font-size: clamp(88px, 7.6vw, 190px);
          line-height: .9;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        @media (max-width: 1180px) {
          .toprow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
