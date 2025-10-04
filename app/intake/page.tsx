'use client';

import { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { progress, saveJob, getJob } from '@/lib/api';
import PrintSheet from '@/app/components/PrintSheet';

// Opt out of static prerender; this page depends on URL params & client-only hooks
export const dynamic = 'force-dynamic';

/* ---------------- Types ---------------- */
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
  dropoff?: string; // yyyy-mm-dd
  sex?: '' | 'Buck' | 'Doe';
  processType?: '' | 'Standard Processing' | 'Caped' | 'Skull-Cap' | 'European' | 'Caped & Donate' | 'Donate';

  status?: string;            // regular status
  capingStatus?: string;      // only shown if Caped
  webbsStatus?: string;       // only shown if Webbs

  steak?: string;
  steakOther?: string;
  burgerSize?: string;
  steaksPerPackage?: string;
  beefFat?: boolean;

  hindRoastCount?: string;
  frontRoastCount?: string;

  hind?: CutsBlock;
  front?: CutsBlock;

  backstrapPrep?: '' | 'Whole' | 'Sliced' | 'Butterflied';
  backstrapThickness?: '' | '1/2"' | '3/4"' | 'Other';
  backstrapThicknessOther?: string;

  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;
  specialtyPounds?: string;

  notes?: string;

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;

  price?: number | string; // optional override

  // legacy + new paid flags
  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;  // NEW
  paidSpecialty?: boolean;   // NEW
};

/* --------------- Helpers --------------- */
const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const normProc = (s?: string) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
};

const suggestedProcessingPrice = (proc?: string, beef?: boolean, webbs?: boolean) => {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing','Skull-Cap','European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  if (!base) return 0;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
};


// For specialty fields, parse int lbs
const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const asBool = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true','yes','y','1','on','paid','x','✓','✔'].includes(s);
};

type AnyRec = Record<string, any>;
const pickCut = (obj: unknown, key: string): boolean => {
  return asBool(obj && typeof obj === 'object' ? (obj as AnyRec)[key] : undefined);
};

/** Derive "paid in full" from split flags + whether specialty is in play */
const fullPaid = (j: Job): boolean => {
  const proc = !!j.paidProcessing;
  const needsSpec = asBool(j.specialtyProducts);
  const spec = needsSpec ? !!j.paidSpecialty : true;
  return proc && spec;
};

/* ---- Fixed status choices + guards ---- */
const STATUS_MAIN  = ['Dropped Off', 'Processing', 'Finished', 'Called', 'Picked Up'] as const;
const STATUS_CAPE  = ['Dropped Off', 'Caped', 'Called', 'Picked Up'] as const;
const STATUS_WEBBS = ['Dropped Off', 'Sent', 'Delivered', 'Called', 'Picked Up'] as const;

const coerce = (v: string | undefined, list: readonly string[]) =>
  list.includes(String(v)) ? String(v) : list[0];

/* ===== Suspense wrapper to satisfy Next 15 CSR bailout rules ===== */
export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{padding:16}}>Loading…</div></div>}>
      <IntakePage />
    </Suspense>
  );
}

/* --------------- Component -------------- */
function IntakePage() {
  const sp = useSearchParams();
  const tagFromUrl = sp.get('tag') ?? '';

  const [job, setJob] = useState<Job>({
    tag: tagFromUrl || '',
    dropoff: todayISO(),
    status: 'Dropped Off',
    capingStatus: '',
    webbsStatus: '',
    hind: {
      'Hind - Steak': false,
      'Hind - Roast': false,
      'Hind - Grind': false,
      'Hind - None': false,
    },
    front: {
      'Front - Steak': false,
      'Front - Roast': false,
      'Front - Grind': false,
      'Front - None': false,
    },
    beefFat: false,
    webbsOrder: false,
    Paid: false,
    paid: false,
    paidProcessing: false, // NEW
    paidSpecialty: false,  // NEW
    specialtyProducts: false,
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const tagRef = useRef<HTMLInputElement|null>(null);

  // Focus Tag on mount
  useEffect(() => {
    tagRef.current?.focus();
  }, []);

  // Load existing job by tag (if present)
  useEffect(() => {
    (async () => {
      if (!tagFromUrl) return;
      try {
        const res = await getJob(tagFromUrl);
        if (res?.exists && res.job) {
          const j: any = res.job;
          setJob((prev) => {
            const next: Job = {
              ...prev,
              ...j,
              tag: j.tag || tagFromUrl,
              dropoff: j.dropoff || todayISO(),
              status: coerce(j.status || prev.status || 'Dropped Off', STATUS_MAIN),
              capingStatus: coerce(j.capingStatus || (j.processType === 'Caped' ? 'Dropped Off' : ''), STATUS_CAPE),
              webbsStatus: coerce(j.webbsStatus || (j.webbsOrder ? 'Dropped Off' : ''), STATUS_WEBBS),

              hind: {
                'Hind - Steak': pickCut(j?.hind, 'Hind - Steak'),
                'Hind - Roast': pickCut(j?.hind, 'Hind - Roast'),
                'Hind - Grind': pickCut(j?.hind, 'Hind - Grind'),
                'Hind - None' : pickCut(j?.hind, 'Hind - None'),
              },
              front: {
                'Front - Steak': pickCut(j?.front, 'Front - Steak'),
                'Front - Roast': pickCut(j?.front, 'Front - Roast'),
                'Front - Grind': pickCut(j?.front, 'Front - Grind'),
                'Front - None' : pickCut(j?.front, 'Front - None'),
              },

              // Confirmation mapping
              confirmation:
                j.confirmation ??
                j['Confirmation #'] ??
                j['Confirmation'] ??
                prev.confirmation ??
                '',

              // Paid flags: load both split and legacy
              paidProcessing: !!(j.paidProcessing ?? j.PaidProcessing ?? j.Paid_Processing),
              paidSpecialty:  !!(j.paidSpecialty  ?? j.PaidSpecialty  ?? j.Paid_Specialty),
              specialtyProducts: asBool(j.specialtyProducts),
            };
            const fp = fullPaid(next);
            next.Paid = !!(j.Paid ?? j.paid ?? fp);
            next.paid = !!(j.Paid ?? j.paid ?? fp);
            return next;
          });
        }
      } catch (e: any) {
        setMsg(`Load failed: ${e?.message || e}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFromUrl]);

  // Derived UI toggles + pricing
  const processingPrice = useMemo(
    () => suggestedProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder),
    [job.processType, job.beefFat, job.webbsOrder]
  );

  const specialtyPrice = useMemo(() => {
    if (!job.specialtyProducts) return 0;
    const ss  = toInt(job.summerSausageLbs);
    const ssc = toInt(job.summerSausageCheeseLbs);
    const jer = toInt(job.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 15.0;
  }, [job.specialtyProducts, job.summerSausageLbs, job.summerSausageCheeseLbs, job.slicedJerkyLbs]);

  const totalPrice = processingPrice + specialtyPrice;

  const hindRoastOn = !!job.hind?.['Hind - Roast'];
  const frontRoastOn = !!job.front?.['Front - Roast'];
  const isWholeBackstrap = job.backstrapPrep === 'Whole';
  const hasSpecialty = asBool(job.specialtyProducts);

  const needsBackstrapOther = !isWholeBackstrap && job.backstrapThickness === 'Other';
  const needsSteakOther = job.steak === 'Other';
  const capedOn = job.processType === 'Caped';
  const webbsOn = !!job.webbsOrder;

  // Keep conditional statuses defaulted if newly toggled on and empty
  useEffect(() => {
    setJob((p) => {
      const next: Job = { ...p };
      if (capedOn && !next.capingStatus) next.capingStatus = 'Dropped Off';
      if (webbsOn && !next.webbsStatus) next.webbsStatus = 'Dropped Off';
      return next;
    });
  }, [capedOn, webbsOn]);

  // If specialty is turned off, clear its paid flag and recompute full/legacy paid
  useEffect(() => {
    setJob((prev) => {
      if (!asBool(prev.specialtyProducts) && prev.paidSpecialty) {
        const next = { ...prev, paidSpecialty: false };
        const fp = fullPaid(next);
        return { ...next, Paid: fp, paid: fp };
      }
      return prev;
    });
  }, [job.specialtyProducts]);

  /* ---------- Validation ---------- */
  const validate = (): string[] => {
    const missing: string[] = [];
    if (!job.customer) missing.push('Customer Name');
    if (!job.phone) missing.push('Phone');
    if (!job.email) missing.push('Email');
    if (!job.address) missing.push('Address');
    if (!job.city) missing.push('City');
    if (!job.state) missing.push('State');
    if (!job.zip) missing.push('Zip');
    if (!job.county) missing.push('County Killed');
    if (!job.dropoff) missing.push('Drop-off Date');
    if (!job.sex) missing.push('Deer Sex');
    if (!job.processType) missing.push('Process Type');
    return missing;
  };

  /* ---------- Save ---------- */
  const onSave = async () => {
    setMsg('');
    const missing = validate();
    if (missing.length) {
      setMsg(`Missing or invalid: ${missing.join(', ')}`);
      return;
    }
    const payload: Job = {
      ...job,
      status: coerce(job.status, STATUS_MAIN),
      capingStatus: job.processType === 'Caped' ? coerce(job.capingStatus, STATUS_CAPE) : '',
      webbsStatus: job.webbsOrder ? coerce(job.webbsStatus, STATUS_WEBBS) : '',

      // keep legacy 'Paid' in sync, and send split flags
      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty:  job.specialtyProducts ? !!job.paidSpecialty : false,

      // numeric normalizations for specialty lbs
      summerSausageLbs: job.specialtyProducts ? String(toInt(job.summerSausageLbs)) : '',
      summerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
      slicedJerkyLbs: job.specialtyProducts ? String(toInt(job.slicedJerkyLbs)) : '',
    };
    try {
      setBusy(true);
      const res = await saveJob(payload);
      if (!res?.ok) {
        setMsg(res?.error || 'Save failed');
        return;
      }
      setMsg('Saved ✓');
      if (job.tag) {
        const fresh = await getJob(job.tag);
        if (fresh?.exists && fresh.job) {
          const j: any = fresh.job;
          setJob((p) => {
            const merged: Job = {
              ...p,
              ...j,
              confirmation:
                j.confirmation ?? j['Confirmation #'] ?? j['Confirmation'] ?? p.confirmation ?? '',
              paidProcessing: !!(j.paidProcessing ?? j.PaidProcessing ?? j.Paid_Processing),
              paidSpecialty:  !!(j.paidSpecialty  ?? j.PaidSpecialty  ?? j.Paid_Specialty),
            };
            const fp = fullPaid(merged);
            merged.Paid = !!(j.Paid ?? j.paid ?? fp);
            merged.paid = !!(j.Paid ?? j.paid ?? fp);
            return merged;
          });
        }
      }
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 1500);
    }
  };

  /* ---------- Small setters ---------- */
  const setVal = <K extends keyof Job>(k: K, v: Job[K]) =>
    setJob((p) => ({ ...p, [k]: v }));

  const setHind = (k: keyof Required<CutsBlock>) =>
    setJob((p) => ({ ...p, hind: { ...(p.hind || {}), [k]: !(p.hind?.[k]) } }));

  const setFront = (k: keyof Required<CutsBlock>) =>
    setJob((p) => ({ ...p, front: { ...(p.front || {}), [k]: !(p.front?.[k]) } }));

  /* ---------------- UI ---------------- */
  return (
    <div className="form-card">
      {/* ------- SCREEN UI ONLY ------- */}
      <div className="screen-only">
        <h2>Deer Intake</h2>

        {/* Summary bar with split pricing (unchanged look) */}
        <div className="summary">
          <div className="row">
            <div className="col">
              <label>Tag Number</label>
              <input
                ref={tagRef}
                value={job.tag || ''}
                onChange={(e) => setVal('tag', e.target.value)}
                placeholder="e.g. 1234"
              />
              <div className="muted" style={{fontSize:12}}>Deer Tag</div>
            </div>

            <div className="col price">
              <label>Processing Price</label>
              <div className="money">{processingPrice.toFixed(2)}</div>
              <div className="muted" style={{fontSize:12}}>Proc. type + beef fat + Webbs fee</div>
            </div>

            <div className="col price">
              <label>Specialty Price</label>
              <div className="money">{specialtyPrice.toFixed(2)}</div>
              <div className="muted" style={{fontSize:12}}>Sausage/Jerky lbs</div>
            </div>
          </div>

          <div className="row small">
            <div className="col total">
              <label>Total (preview)</label>
              <div className="money total">{totalPrice.toFixed(2)}</div>
            </div>

            <div className="col">
              <label>Status</label>
              <select
                value={coerce(job.status, STATUS_MAIN)}
                onChange={(e) => setVal('status', e.target.value)}
              >
                {STATUS_MAIN.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {job.processType === 'Caped' && (
              <div className="col">
                <label>Caping Status</label>
                <select
                  value={coerce(job.capingStatus, STATUS_CAPE)}
                  onChange={(e) => setVal('capingStatus', e.target.value)}
                >
                  {STATUS_CAPE.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {job.webbsOrder && (
              <div className="col">
                <label>Webbs Status</label>
                <select
                  value={coerce(job.webbsStatus, STATUS_WEBBS)}
                  onChange={(e) => setVal('webbsStatus', e.target.value)}
                >
                  {STATUS_WEBBS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="col">
              <label>Paid</label>
              <div className="pillrow">
                {/* Processing pill */}
                <label className={`pill ${job.paidProcessing ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!job.paidProcessing}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setJob((prev) => {
                        const next = { ...prev, paidProcessing: v };
                        const fp = fullPaid(next);
                        return { ...next, Paid: fp, paid: fp };
                      });
                    }}
                  />
                </label>
                <span className="badge">{job.paidProcessing ? 'Processing Paid' : 'Processing Unpaid'}</span>

                {/* Specialty pill (only if specialty is enabled) */}
                {asBool(job.specialtyProducts) && (
                  <>
                    <label className={`pill ${job.paidSpecialty ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!!job.paidSpecialty}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setJob((prev) => {
                            const next = { ...prev, paidSpecialty: v };
                            const fp = fullPaid(next);
                            return { ...next, Paid: fp, paid: fp };
                          });
                        }}
                      />
                    </label>
                    <span className="badge">{job.paidSpecialty ? 'Specialty Paid' : 'Specialty Unpaid'}</span>
                  </>
                )}

                {/* Overall pill */}
                <label className={`pill ${fullPaid(job) ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={fullPaid(job)}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setJob((prev) => {
                        const next: Job = {
                          ...prev,
                          paidProcessing: v ? true : false,
                          paidSpecialty: asBool(prev.specialtyProducts) ? (v ? true : false) : false,
                        };
                        const fp = fullPaid(next);
                        return { ...next, Paid: fp, paid: fp };
                      });
                    }}
                  />
                </label>
                <span className="badge">{fullPaid(job) ? 'Paid in Full' : 'Unpaid'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer */}
        <section>
          <h3>Customer</h3>
          <div className="grid">
            <div className="c3">
              <label>Confirmation #</label>
              <input
                value={job.confirmation || ''}
                onChange={(e) => setVal('confirmation', e.target.value)}
              />
            </div>
            <div className="c6">
              <label>Customer Name</label>
              <input
                value={job.customer || ''}
                onChange={(e) => setVal('customer', e.target.value)}
              />
            </div>
            <div className="c3">
              <label>Phone</label>
              <input
                value={job.phone || ''}
                onChange={(e) => setVal('phone', e.target.value)}
              />
            </div>

            <div className="c4">
              <label>Email</label>
              <input
                value={job.email || ''}
                onChange={(e) => setVal('email', e.target.value)}
              />
            </div>
            <div className="c8">
              <label>Address</label>
              <input
                value={job.address || ''}
                onChange={(e) => setVal('address', e.target.value)}
              />
            </div>
            <div className="c4">
              <label>City</label>
              <input
                value={job.city || ''}
                onChange={(e) => setVal('city', e.target.value)}
              />
            </div>
            <div className="c4">
              <label>State</label>
              <input
                value={job.state || ''}
                onChange={(e) => setVal('state', e.target.value)}
                placeholder="IN / KY / …"
              />
            </div>
            <div className="c4">
              <label>Zip</label>
              <input
                value={job.zip || ''}
                onChange={(e) => setVal('zip', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Hunt Details */}
        <section>
          <h3>Hunt Details</h3>
          <div className="grid">
            <div className="c4">
              <label>County Killed</label>
              <input
                value={job.county || ''}
                onChange={(e) => setVal('county', e.target.value)}
              />
            </div>
            <div className="c3">
              <label>Drop-off Date</label>
              <input
                type="date"
                value={job.dropoff || ''}
                onChange={(e) => setVal('dropoff', e.target.value)}
              />
            </div>
            <div className="c2">
              <label>Deer Sex</label>
              <select
                value={job.sex || ''}
                onChange={(e) => setVal('sex', e.target.value as Job['sex'])}
              >
                <option value="">—</option>
                <option value="Buck">Buck</option>
                <option value="Doe">Doe</option>
              </select>
            </div>
            <div className="c3">
              <label>Process Type</label>
              <select
                value={job.processType || ''}
                onChange={(e) =>
                  setVal('processType', e.target.value as Job['processType'])
                }
              >
                <option value="">—</option>
                <option>Standard Processing</option>
                <option>Caped</option>
                <option>Skull-Cap</option>
                <option>European</option>
              </select>
            </div>
          </div>
        </section>

        {/* Cuts */}
        <section>
          <h3>Cuts</h3>
          <div className="grid">
            <div className="c6">
              <label>Hind Quarter</label>
              <div className="checks">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Steak']}
                    onChange={() => setHind('Hind - Steak')}
                  />
                  <span>Steak</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Roast']}
                    onChange={() => setHind('Hind - Roast')}
                  />
                  <span>Roast</span>
                </label>
                <span className="count">
                  <span className="muted">Count</span>
                  <input
                    className="countInp"
                    value={hindRoastOn ? (job.hindRoastCount || '') : ''}
                    onChange={(e) => setVal('hindRoastCount', e.target.value)}
                    disabled={!hindRoastOn}
                    inputMode="numeric"
                  />
                </span>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Grind']}
                    onChange={() => setHind('Hind - Grind')}
                  />
                  <span>Grind</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - None']}
                    onChange={() => setHind('Hind - None')}
                  />
                  <span>None</span>
                </label>
              </div>
            </div>

            <div className="c6">
              <label>Front Shoulder</label>
              <div className="checks">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - Steak']}
                    onChange={() => setFront('Front - Steak')}
                  />
                  <span>Steak</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - Roast']}
                    onChange={() => setFront('Front - Roast')}
                  />
                  <span>Roast</span>
                </label>
                <span className="count">
                  <span className="muted">Count</span>
                  <input
                    className="countInp"
                    value={frontRoastOn ? (job.frontRoastCount || '') : ''}
                    onChange={(e) => setVal('frontRoastCount', e.target.value)}
                    disabled={!frontRoastOn}
                    inputMode="numeric"
                  />
                </span>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - Grind']}
                    onChange={() => setFront('Front - Grind')}
                  />
                  <span>Grind</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - None']}
                    onChange={() => setFront('Front - None')}
                  />
                  <span>None</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Packaging & Add-ons */}
        <section>
          <h3>Packaging & Add-ons</h3>
          <div className="grid">
            <div className="c3">
              <label>Steak Size</label>
              <select
                value={job.steak || ''}
                onChange={(e) => setVal('steak', e.target.value)}
              >
                <option value="">—</option>
                <option>1/2"</option>
                <option>3/4"</option>
                <option>Other</option>
              </select>
            </div>
            <div className="c3">
              <label>Steaks per Package</label>
              <select
                value={job.steaksPerPackage || ''}
                onChange={(e) => setVal('steaksPerPackage', e.target.value)}
              >
                <option value="">—</option>
                <option>4</option>
                <option>6</option>
                <option>8</option>
              </select>
            </div>
            <div className="c3">
              <label>Burger Size</label>
              <select
                value={job.burgerSize || ''}
                onChange={(e) => setVal('burgerSize', e.target.value)}
              >
                <option value="">—</option>
                <option>1 lb</option>
                <option>2 lb</option>
              </select>
            </div>
            <div className="c3 rowInline">
              <label className="chk tight">
                <input
                  type="checkbox"
                  checked={!!job.beefFat}
                  onChange={(e) => setVal('beefFat', e.target.checked)}
                />
                <span>Beef fat</span>
                <span className="muted"> (+$5)</span>
              </label>
            </div>

            <div className="c3">
              <label>Steak Size (Other)</label>
              <input
                value={needsSteakOther ? (job.steakOther || '') : ''}
                onChange={(e) => setVal('steakOther', e.target.value)}
                disabled={!needsSteakOther}
                placeholder='e.g., 5/8"'
              />
            </div>
          </div>
        </section>

        {/* Backstrap */}
        <section>
          <h3>Backstrap</h3>
          <div className="grid">
            <div className="c4">
              <label>Prep</label>
              <select
                value={job.backstrapPrep || ''}
                onChange={(e) =>
                  setVal('backstrapPrep', e.target.value as Job['backstrapPrep'])
                }
              >
                <option value="">—</option>
                <option>Whole</option>
                <option>Sliced</option>
                <option>Butterflied</option>
              </select>
            </div>
            <div className="c4">
              <label>Thickness</label>
              <select
                value={isWholeBackstrap ? '' : (job.backstrapThickness || '')}
                onChange={(e) =>
                  setVal('backstrapThickness', e.target.value as Job['backstrapThickness'])
                }
                disabled={isWholeBackstrap}
              >
                <option value="">—</option>
                <option>1/2"</option>
                <option>3/4"</option>
                <option>Other</option>
              </select>
            </div>
            <div className="c4">
              <label>Thickness (Other)</label>
              <input
                value={needsBackstrapOther ? (job.backstrapThicknessOther || '') : ''}
                onChange={(e) => setVal('backstrapThicknessOther', e.target.value)}
                disabled={!needsBackstrapOther}
              />
            </div>
          </div>
        </section>

        {/* Specialty Products */}
        <section>
          <h3>McAfee Specialty Products</h3>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight">
                <input
                  type="checkbox"
                  checked={!!job.specialtyProducts}
                  onChange={(e) => setVal('specialtyProducts', e.target.checked)}
                />
                <span><strong>Would like specialty products</strong></span>
              </label>
            </div>
            <div className="c3">
              <label>Summer Sausage (lb)</label>
              <input
                inputMode="numeric"
                value={job.specialtyProducts ? String(job.summerSausageLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageLbs', e.target.value)}
                disabled={!job.specialtyProducts}
              />
            </div>
            <div className="c3">
              <label>Summer Sausage + Cheese (lb)</label>
              <input
                inputMode="numeric"
                value={job.specialtyProducts ? String(job.summerSausageCheeseLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageCheeseLbs', e.target.value)}
                disabled={!job.specialtyProducts}
              />
            </div>
            <div className="c3">
              <label>Sliced Jerky (lb)</label>
              <input
                inputMode="numeric"
                value={job.specialtyProducts ? String(job.slicedJerkyLbs ?? '') : ''}
                onChange={(e) => setVal('slicedJerkyLbs', e.target.value)}
                disabled={!job.specialtyProducts}
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <h3>Notes</h3>
          <textarea
            rows={3}
            value={job.notes || ''}
            onChange={(e) => setVal('notes', e.target.value)}
          />
        </section>

        {/* Webbs */}
        <section>
          <h3>Webbs</h3>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight">
                <input
                  type="checkbox"
                  checked={!!job.webbsOrder}
                  onChange={(e) => setVal('webbsOrder', e.target.checked)}
                />
                <span><strong>Webbs Order</strong></span>
                <span className="muted"> (+$20 fee)</span>
              </label>
            </div>
            <div className="c4">
              <label>Webbs Order Form Number</label>
              <input
                value={job.webbsFormNumber || ''}
                onChange={(e) => setVal('webbsFormNumber', e.target.value)}
              />
            </div>
            <div className="c3">
              <label>Webbs Pounds (lb)</label>
              <input
                inputMode="numeric"
                value={job.webbsPounds || ''}
                onChange={(e) => setVal('webbsPounds', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="actions">
          <div className={`status ${msg.startsWith('Save') ? 'ok' : msg ? 'err' : ''}`}>{msg}</div>

          <button
            className="btn"
            type="button"
            onClick={() => window.print()}
            disabled={busy}
          >
            Print
          </button>

          <button className="btn" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ------- PRINT ONLY (no overlay on screen) ------- */}
      <div className="print-only">
        <PrintSheet job={job} />
      </div>

      {/* Styles */}
      <style jsx>{`
        .wrap { max-width: 980px; margin: 16px auto 60px; padding: 12px; font-family: Arial, sans-serif; }
        h2 { margin: 8px 0; }
        h3 { margin: 16px 0 8px; }

        label { font-size: 12px; font-weight: 700; color: #0b0f12; display: block; margin-bottom: 4px; }
        input, select, textarea {
          width: 100%; padding: 6px 8px; border: 1px solid #d8e3f5; border-radius: 8px; background: #fbfdff; box-sizing: border-box;
        }
        textarea { resize: vertical; }

        .grid { display: grid; gap: 8px; grid-template-columns: repeat(12, 1fr); }
        .c3{grid-column: span 3} .c4{grid-column: span 4} .c6{grid-column: span 6} .c8{grid-column: span 8}

        .rowInline { display: flex; align-items: center; padding-top: 22px; gap: 8px; }
        .checks { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .chk { display: inline-flex; align-items: center; gap: 6px; }
        .muted { color: #6b7280; font-size: 12px; }

        .summary { position: sticky; top: 0; background: #f5f8ff; border: 1px solid #d8e3f5; border-radius: 10px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.06); z-index:5; }
        .summary .row { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); align-items: end; }
        .summary .row.small { margin-top: 6px; grid-template-columns: repeat(4, 1fr); }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #d8e3f5; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }

        /* Paid pills row */
        .summary .pillrow {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: nowrap;
        }
        .summary .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 10px;
          border: 2px solid #eab308;
          background: #fff7db;
          border-radius: 999px;
          white-space: nowrap;
          max-width: 100%;
          overflow: visible;
          cursor: pointer; /* label is clickable */
          user-select: none;
        }
        .summary .pill.on {
          border-color: #10b981;
          background: #ecfdf5;
        }
        .summary .pill > input[type="checkbox"] {
          position: static;
          inset: auto;
          transform: none;
          width: 18px;
          height: 18px;
          margin: 0;
          flex: 0 0 auto;
          appearance: auto;
        }
        .summary .badge {
          display: inline-block;
          font-weight: 800;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid currentColor;
          line-height: 1.1;
        }

        .count { display: inline-flex; align-items: center; gap: 6px; }
        .countInp { width: 70px; text-align: center; }

        .actions { position: sticky; bottom: 0; background:#fff; padding: 10px 0; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; border-top:1px solid #eef2f7; }
        .btn { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #155acb; color: #fff; font-weight: 800; cursor: pointer; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .status { min-height: 20px; font-size: 12px; color: #334155; margin-right:auto; }
        .status.ok { color: #065f46; }
        .status.err { color: #b91c1c; }

        .print-only { display: none; }
        @media print {
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
        }

        @media (max-width: 900px) {
          .summary .row.small { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .grid { grid-template-columns: 1fr; }
          .summary .row { grid-template-columns: 1fr; }
          .summary .row.small { grid-template-columns: 1fr; }
          .rowInline { padding-top: 0; }
          .summary .pillrow { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

