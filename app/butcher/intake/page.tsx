'use client';
import { Suspense } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useScanner } from '@/lib/useScanner';
import { progress, saveJob, getJob } from '@/lib/api';
import { specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';

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
  notes?: string; price?: number|string; customer?: string;
};

const moneyNumber = (v:any)=> {
  if (typeof v === 'string') { const n = Number(v.replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:NaN; }
  const n = Number(v); return Number.isFinite(n)?n:NaN;
};
const normProc = (s?:string) => {
  const v = String(s||'').toLowerCase();
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
};
const suggestedPrice = (proc?:string, beef?:boolean, webbs?:boolean) => {
  const p = normProc(proc);
  const base = p==='Caped' ? 150 : (['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 : 0);
  return base ? base + (beef?5:0) + (webbs?20:0) : 0;
};

const specialtyPrice = (job: Job) => {
  return calcSpecialtyPrice(job as any);
};
const calcTotal = (job: Job) => suggestedPrice(job.processType, !!job.beefFat, !!job.webbsOrder) + specialtyPrice(job);

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const price = useMemo(() => calcTotal(job), [job]);
  const watchFor = useMemo(() => {
    const items: string[] = [];
    if (String(job.notes || '').trim()) items.push(`Notes: ${String(job.notes || '').trim()}`);
    if (job.beefFat) items.push('Add-on: Beef Fat');
    if (job.webbsOrder) items.push(`Webbs: ${job.webbsPounds ? `${job.webbsPounds} lb entered` : 'Order on file'}`);
    const specTotal = Number(job.originalSummerSausageLbs || 0)
      + Number(job.summerSausageCheeseLbs || 0)
      + Number(job.jalapenoSummerSausageCheeseLbs || 0)
      + Number(job.originalSnackSticksLbs || 0)
      + Number(job.originalSnackSticksCheeseLbs || 0)
      + Number(job.jalapenoSnackSticksCheeseLbs || 0);
    if (specTotal > 0) items.push(`Specialty total: ${specTotal} lb`);
    const totalDue = Math.max(0, price - (job.Paid ? price : 0));
    items.push(totalDue > 0 ? `Payment due: $${totalDue.toFixed(2)}` : 'Paid in full');
    return items;
  }, [job, price]);

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

  // Small setters
  const setVal = (k: keyof Job, v:any) => setJob(p=>({ ...p, [k]: v }));
  const toggle = (path: string) => {
    setJob(p => {
      const next = { ...p } as Job;
      if (path.startsWith('hind.') || path.startsWith('front.')) {
        const [block, key] = path.split('.') as ['hind'|'front', keyof NonNullable<CutsBlock>];
        next[block] = { ...(p[block]||{}), [key]: !p[block]?.[key] };
      } else if (path in p) {
        // @ts-ignore
        next[path] = !p[path];
        if (path === 'Paid') {
          next.paid = !!next.Paid;
          next.paidProcessing = !!next.Paid;
          next.paidSpecialty = next.specialtyProducts ? !!next.Paid : false;
        }
      }
      return next;
    });
  };

  const doSave = async () => {
    try{
      setBusy(true); setMsg('');
      const res = await saveJob(job);
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      setMsg('Saved. Scan the same tag again when the work is done, or return to Search for the next deer.');
      setTimeout(()=> setMsg(''), 1000);
    }catch(e:any){ setMsg(`Could not save these butcher changes. ${e?.message || 'Try again, or open the intake form if this keeps happening.'}`); }
    finally{ setBusy(false); }
  };

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
  }, []);

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
            format:'CODE128', lineColor:'#111', width:1.25, height:18, displayValue:true,
            font:'monospace', fontSize:10, textMargin:2, margin:0
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
    <main className="page-wrap butcher-mode">
      <div className="butcher-root" ref={rootRef}>
        <div style={{ marginBottom: 12, color: '#f3f4f6', fontWeight: 800, lineHeight: 1.45 }}>
          Next: review the deer, watch the highlighted callouts, then scan the same tag again when the work is done.
        </div>
        <div className="toprow">
          <div className="tagbox">
            <div className="tag">{job.tag || '-'}</div>
            <div id="barcodeWrap"><svg id="tagBarcode" role="img" aria-label="Tag barcode"></svg></div>
          </div>
          <div className="statusbox">
            <div className="row"><span className="label">Status</span><span className="badge">{job.status || '-'}</span></div>
            <div className="row"><span className="label">Paid</span><button className={'pill ' + (job.Paid?'on':'')} onClick={()=>toggle('Paid')}>{job.Paid ? 'PAID' : 'UNPAID'}</button></div>
            <div className="row"><span className="label">Process</span><span className="val">{job.processType || '-'}</span></div>
            <div className="row price"><span className="label">Price</span><span className="money">${ (suggestedPrice(job.processType, !!job.beefFat, !!job.webbsOrder) + specialtyPrice(job)).toFixed(2) }</span></div>
          </div>
          <div className="who">
            <div className="name">{job.customer || '-'}</div>
            <div className="notes" title={job.notes||''}>{(job.notes||'').slice(0,140)}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 14, borderRadius: 16, border: '1px solid rgba(250,204,21,.34)', background: 'rgba(120,53,15,.18)', color: '#fef3c7', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Watch For</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {watchFor.map((item) => (
              <div key={item} style={{ fontWeight: 800, lineHeight: 1.4 }}>{item}</div>
            ))}
          </div>
        </div>

        {/* ...rest of your UI/cards/actions remain unchanged... */}

      </div>
    </main>
  );
}
