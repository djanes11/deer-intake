// app/(public)/overnight/page.tsx
'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { saveJob } from '@/lib/api';
import PrintSheet from '@/app/components/PrintSheet';

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
  processType?:
    | ''
    | 'Standard Processing'
    | 'Caped'
    | 'Skull-Cap'
    | 'European'
    | 'Cape & Donate'
    | 'Donate';

  status?: string;
  capingStatus?: string;
  webbsStatus?: string;

  specialtyStatus?: '' | 'Dropped Off' | 'In Progress' | 'Finished' | 'Called' | 'Picked Up';

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
  backstrapThickness?: '' | '1/2\"' | '3/4\"' | 'Other';
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

  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;

  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  price?: number | string;

  requiresTag?: boolean;

  prefEmail?: boolean;
  prefSMS?: boolean;
  prefCall?: boolean;
  smsConsent?: boolean;
  autoCallConsent?: boolean;
};

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

const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const asBool = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true','yes','y','1','on','paid','x','✓','✔'].includes(s);
};

const fullPaid = (j: Job): boolean => {
  const proc = !!j.paidProcessing;
  const needsSpec = asBool(j.specialtyProducts);
  const spec = needsSpec ? !!j.paidSpecialty : true;
  return proc && spec;
};

const coerce = (v: string | undefined, list: readonly string[]) =>
  list.includes(String(v)) ? String(v) : list[0];

export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{padding:16}}>Loading…</div></div>}>
      <OvernightIntakePage />
    </Suspense>
  );
}

function OvernightIntakePage() {
  const [job, setJob] = useState<Job>({
    tag: '',
    dropoff: todayISO(),
    status: 'Dropped Off',
    capingStatus: '',
    webbsStatus: '',
    specialtyStatus: '',

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
    paidProcessing: false,
    paidSpecialty: false,
    specialtyProducts: false,

    requiresTag: true,

    prefEmail: true,
    prefSMS: false,
    prefCall: false,
    smsConsent: false,
    autoCallConsent: false,
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [locked, setLocked] = useState<boolean>(false);
  const [showThanks, setShowThanks] = useState<boolean>(false);

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

  const procNorm = normProc(job.processType);
  const capingFlow = procNorm === 'Caped' || procNorm === 'Cape & Donate';
  const webbsOn = !!job.webbsOrder;

  useEffect(() => {
    setJob((prev) => {
      const next = { ...prev };
      const p = normProc(next.processType);
      if (p === 'Donate') {
        next.status = '';
        next.capingStatus = '';
        if (next.webbsStatus) next.webbsStatus = '';
      } else if (p === 'Cape & Donate') {
        next.status = '';
        if (!next.capingStatus) next.capingStatus = 'Dropped Off';
      } else if (p === 'Caped') {
        if (!next.status) next.status = 'Dropped Off';
        if (!next.capingStatus) next.capingStatus = 'Dropped Off';
      } else {
        if (!next.status) next.status = 'Dropped Off';
      }
      return next;
    });
  }, [job.processType]);

  useEffect(() => {
    setJob((p) => {
      const next: Job = { ...p };
      if (capingFlow && !next.capingStatus) next.capingStatus = 'Dropped Off';
      if (webbsOn && procNorm !== 'Donate' && !next.webbsStatus) next.webbsStatus = 'Dropped Off';
      if (next.specialtyProducts && !next.specialtyStatus) next.specialtyStatus = 'Dropped Off';
      if (!next.specialtyProducts) next.specialtyStatus = '';
      return next;
    });
  }, [capingFlow, webbsOn, procNorm, job.specialtyProducts]);

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

  const confirmationLast5 = (job.confirmation || '').replace(/\D/g, '').slice(-5);

  const onSave = async () => {
    if (locked) return;
    setMsg('');
    const missing = validate();
    if (missing.length) {
      setMsg(`Missing or invalid: ${missing.join(', ')}`);
      return;
    }

    const pnorm = normProc(job.processType);

    const payload: Job = {
      ...job,
      tag: '',
      requiresTag: true,

      status:
        pnorm === 'Cape & Donate' || pnorm === 'Donate'
          ? ''
          : (job.status || 'Dropped Off'),

      capingStatus:
        (pnorm === 'Caped' || pnorm === 'Cape & Donate')
          ? (job.capingStatus || 'Dropped Off')
          : '',

      webbsStatus:
        (job.webbsOrder && pnorm !== 'Donate')
          ? (job.webbsStatus || 'Dropped Off')
          : '',

      specialtyStatus: job.specialtyProducts ? (job.specialtyStatus || 'Dropped Off') : '',

      priceProcessing: processingPrice,
      priceSpecialty:  specialtyPrice,
      price:           totalPrice,

      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty:  job.specialtyProducts ? !!job.paidSpecialty : false,

      summerSausageLbs:          job.specialtyProducts ? String(toInt(job.summerSausageLbs)) : '',
      summerSausageCheeseLbs:    job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
      slicedJerkyLbs:            job.specialtyProducts ? String(toInt(job.slicedJerkyLbs)) : '',
    };

    try {
      setBusy(true);
      const res = await saveJob(payload);
      if (!res?.ok) {
        setMsg(res?.error || 'Save failed');
        return;
      }
      setLocked(true);
      setShowThanks(true);
      setMsg('Saved ✓');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 1500);
    }
  };

  const setVal = <K extends keyof Job>(k: K, v: Job[K]) =>
    !locked && setJob((p) => ({ ...p, [k]: v }));

  const setHind = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => ({ ...p, hind: { ...(p.hind || {}), [k]: !(p.hind?.[k]) } }));

  const setFront = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => ({ ...p, front: { ...(p.front || {}), [k]: !(p.front?.[k]) } }));

  // Helper to render bulletized validation errors
  const renderStatus = (message: string) => {
    if (!message) return <div className="status" />;
    const isOk = /^save/i.test(message);
    const isAggregate = /Missing or invalid:/i.test(message) && message.includes(', ');
    if (isAggregate) {
      const items = message.replace(/Missing or invalid:\s*/i, '').split(/,\s*/g).filter(Boolean);
      return (
        <div className="status err">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Missing or invalid</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>{items.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      );
    }
    return <div className={`status ${isOk ? 'ok' : 'err'}`}>{message}</div>;
  };

  return (
    <div className={`form-card ${locked ? 'locked' : ''}`}>
      <div className="screen-only">
        <h2>Deer Intake (Overnight)</h2>

        <div className="summary">
          <div className="row">
            <div className="col">
              <label>Tag Number</label>
              <input
                value={''}
                onChange={() => {}}
                placeholder="Assigned by staff"
                disabled
              />
              <div className="muted" style={{fontSize:12}}>Front desk will assign your tag in the morning.</div>
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
          </div>
        </div>

        {/* Customer */}
        <section>
          <h3>Customer</h3>
          <p className="muted small">We’ll use this to contact you about your order.</p>
          <div className="grid">
            <div className="c3">
              <label>Confirmation #</label>
              <input
                value={job.confirmation || ''}
                onChange={(e) => setVal('confirmation', e.target.value)}
                disabled={locked}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="9 digits from GoOutdoorsIN"
              />
            </div>
            <div className="c6">
              <label>Customer Name</label>
              <input
                value={job.customer || ''}
                onChange={(e) => setVal('customer', e.target.value)}
                disabled={locked}
                placeholder="First & Last"
              />
            </div>
            <div className="c3">
              <label>Phone</label>
              <input
                value={job.phone || ''}
                onChange={(e) => setVal('phone', e.target.value)}
                disabled={locked}
                inputMode="tel"
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="c4">
              <label>Email</label>
              <input
                value={job.email || ''}
                onChange={(e) => setVal('email', e.target.value)}
                disabled={locked}
                type="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="c8">
              <label>Address</label>
              <input
                value={job.address || ''}
                onChange={(e) => setVal('address', e.target.value)}
                disabled={locked}
                placeholder="Street address"
              />
            </div>
            <div className="c4">
              <label>City</label>
              <input
                value={job.city || ''}
                onChange={(e) => setVal('city', e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="c4">
              <label>State</label>
              <input
                value={job.state || ''}
                onChange={(e) => setVal('state', e.target.value)}
                placeholder="IN / KY / …"
                disabled={locked}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="c4">
              <label>Zip</label>
              <input
                value={job.zip || ''}
                onChange={(e) => setVal('zip', e.target.value)}
                disabled={locked}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="#####"
              />
            </div>
          </div>
        </section>

        {/* Hunt Details */}
        <section>
          <h3>Hunt Details</h3>
          <p className="muted small">Basic info from your GoOutdoorsIN check-in — we match your deer using this.</p>
          <div className="grid">
            <div className="c4">
              <label>County Killed</label>
              <input
                value={job.county || ''}
                onChange={(e) => setVal('county', e.target.value)}
                disabled={locked}
                placeholder="County"
              />
            </div>
            <div className="c3">
              <label>Drop-off Date</label>
              <input
                type="date"
                value={job.dropoff || ''}
                onChange={(e) => setVal('dropoff', e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="c2">
              <label>Deer Sex <span className="muted">(buck = male, doe = female)</span></label>
              <select
                value={job.sex || ''}
                onChange={(e) => setVal('sex', e.target.value as Job['sex'])}
                disabled={locked}
              >
                <option value="">—</option>
                <option value="Buck">Buck</option>
                <option value="Doe">Doe</option>
              </select>
            </div>
            <div className="c3">
              <label>Process Type <span className="muted">(choose “Caped” if you kept the hide)</span></label>
              <select
                value={job.processType || ''}
                onChange={(e) =>
                  setVal('processType', e.target.value as Job['processType'])
                }
                disabled={locked}
              >
                <option value="">—</option>
                <option>Standard Processing</option>
                <option>Caped</option>
                <option>Skull-Cap</option>
                <option>European</option>
                <option>Cape & Donate</option>
                <option>Donate</option>
              </select>
            </div>
          </div>
        </section>

        {/* Cuts */}
        <section>
          <h3>Cuts</h3>
          <p className="muted small">Pick how you’d like your meat from each section.</p>
          <div className="grid">
            <div className="c6">
              <label>Hind Quarter</label>
              <div className="checks">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Steak']}
                    onChange={() => setHind('Hind - Steak')}
                    disabled={locked}
                  />
                  <span>Steak</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Roast']}
                    onChange={() => setHind('Hind - Roast')}
                    disabled={locked}
                  />
                  <span>Roast</span>
                </label>
                <span className="count">
                  <span className="muted">Count</span>
                  <input
                    className="countInp"
                    value={!!job.hind?.['Hind - Roast'] ? (job.hindRoastCount || '') : ''}
                    onChange={(e) => setVal('hindRoastCount', e.target.value)}
                    disabled={!job.hind?.['Hind - Roast'] || locked}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </span>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - Grind']}
                    onChange={() => setHind('Hind - Grind')}
                    disabled={locked}
                  />
                  <span>Grind</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.hind?.['Hind - None']}
                    onChange={() => setHind('Hind - None')}
                    disabled={locked}
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
                    disabled={locked}
                  />
                  <span>Steak</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - Roast']}
                    onChange={() => setFront('Front - Roast')}
                    disabled={locked}
                  />
                  <span>Roast</span>
                </label>
                <span className="count">
                  <span className="muted">Count</span>
                  <input
                    className="countInp"
                    value={!!job.front?.['Front - Roast'] ? (job.frontRoastCount || '') : ''}
                    onChange={(e) => setVal('frontRoastCount', e.target.value)}
                    disabled={!job.front?.['Front - Roast'] || locked}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </span>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - Grind']}
                    onChange={() => setFront('Front - Grind')}
                    disabled={locked}
                  />
                  <span>Grind</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.front?.['Front - None']}
                    onChange={() => setFront('Front - None')}
                    disabled={locked}
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
          <p className="muted small">Choose steak cut, burger pack size, and if you want beef fat added.</p>
          <div className="grid">
            <div className="c3">
              <label>Steak Size</label>
              <select
                value={job.steak || ''}
                onChange={(e) => setVal('steak', e.target.value)}
                disabled={locked}
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
                disabled={locked}
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
                disabled={locked}
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
                  disabled={locked}
                />
                <span>Beef fat</span>
                <span className="muted"> (+$5)</span>
              </label>
            </div>

            <div className="c3">
              <label>Steak Size (Other)</label>
              <input
                value={job.steak === 'Other' ? (job.steakOther || '') : ''}
                onChange={(e) => setVal('steakOther', e.target.value)}
                disabled={job.steak !== 'Other' || locked}
                placeholder='e.g., 5/8"'
              />
            </div>
          </div>
        </section>

        {/* Backstrap */}
        <section>
          <h3>Backstrap</h3>
          <p className="muted small">Optional: how you’d like your backstrap prepared.</p>
          <div className="grid">
            <div className="c4">
              <label>Prep</label>
              <select
                value={job.backstrapPrep || ''}
                onChange={(e) =>
                  setVal('backstrapPrep', e.target.value as Job['backstrapPrep'])
                }
                disabled={locked}
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
                value={job.backstrapPrep === 'Whole' ? '' : (job.backstrapThickness || '')}
                onChange={(e) =>
                  setVal('backstrapThickness', e.target.value as Job['backstrapThickness'])
                }
                disabled={job.backstrapPrep === 'Whole' || locked}
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
                value={job.backstrapPrep !== 'Whole' && job.backstrapThickness === 'Other' ? (job.backstrapThicknessOther || '') : ''}
                onChange={(e) => setVal('backstrapThicknessOther', e.target.value)}
                disabled={!(job.backstrapPrep !== 'Whole' && job.backstrapThickness === 'Other') || locked}
              />
            </div>
          </div>
        </section>

        {/* Specialty Products */}
        <section>
          <h3>McAfee Specialty Products</h3>
          <p className="muted small">Optional sausage and jerky add-ons.</p>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight">
                <input
                  type="checkbox"
                  checked={!!job.specialtyProducts}
                  onChange={(e) => setVal('specialtyProducts', e.target.checked)}
                  disabled={locked}
                />
                <span><strong>Would like specialty products</strong></span>
              </label>
            </div>
            <div className="c3">
              <label>Summer Sausage (lb)</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={job.specialtyProducts ? String(job.summerSausageLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageLbs', e.target.value)}
                disabled={!job.specialtyProducts || locked}
              />
            </div>
            <div className="c3">
              <label>Summer Sausage + Cheese (lb)</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={job.specialtyProducts ? String(job.summerSausageCheeseLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageCheeseLbs', e.target.value)}
                disabled={!job.specialtyProducts || locked}
              />
            </div>
            <div className="c3">
              <label>Sliced Jerky (lb)</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={job.specialtyProducts ? String(job.slicedJerkyLbs ?? '') : ''}
                onChange={(e) => setVal('slicedJerkyLbs', e.target.value)}
                disabled={!job.specialtyProducts || locked}
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <h3>Notes</h3>
          <p className="muted small">Anything else we should know.</p>
          <textarea
            rows={3}
            value={job.notes || ''}
            onChange={(e) => setVal('notes', e.target.value)}
            disabled={locked}
          />
        </section>

        {/* Webbs */}
        <section>
          <h3>Webbs (optional)</h3>
          <p className="muted small">Only fill this out if you’re sending meat to Webbs.</p>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight">
                <input
                  type="checkbox"
                  checked={!!job.webbsOrder}
                  onChange={(e) => setVal('webbsOrder', e.target.checked)}
                  disabled={locked}
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
                disabled={locked}
                placeholder="From your Webbs sheet"
              />
            </div>
            <div className="c3">
              <label>Webbs Pounds (lb)</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={job.webbsPounds || ''}
                onChange={(e) => setVal('webbsPounds', e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
        </section>

        {/* Communication & Consent */}
        <section>
          <h3>Communication Preference & Consent</h3>
          <p className="muted small">Tell us how you want to be contacted about updates.</p>
          <div className="grid">
            <div className="c6">
              <label>Preferred Contact Methods</label>
              <div className="checks">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.prefEmail}
                    onChange={(e) => setVal('prefEmail', e.target.checked)}
                    disabled={locked}
                  />
                  <span>Email</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.prefSMS}
                    onChange={(e) => setVal('prefSMS', e.target.checked)}
                    disabled={locked}
                  />
                  <span>Text (SMS)</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.prefCall}
                    onChange={(e) => setVal('prefCall', e.target.checked)}
                    disabled={locked}
                  />
                  <span>Phone Call</span>
                </label>
              </div>
            </div>
            <div className="c6">
              <label>Legal Consent</label>
              <div className="checks">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.smsConsent}
                    onChange={(e) => setVal('smsConsent', e.target.checked)}
                    disabled={locked}
                  />
                  <span>I consent to receive informational/automated SMS</span>
                </label>
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.autoCallConsent}
                    onChange={(e) => setVal('autoCallConsent', e.target.checked)}
                    disabled={locked}
                  />
                  <span>I consent to receive automated phone calls</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="actions">
          {renderStatus(msg)}
          <button className="btn" onClick={onSave} disabled={busy || locked}>
            {busy ? 'Saving…' : locked ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="print-only">
        <PrintSheet job={job} />
      </div>

      {/* Thank-you modal */}
      {showThanks && (
        <div className="modal">
          <div className="modal-card">
            <h3>Thank you!</h3>
            <p style={{marginTop:8}}>
              Please leave a note with the <b>last 5 digits</b> of your confirmation number
              {confirmationLast5 ? <> (<code>{confirmationLast5}</code>)</> : null}
              {' '}with your deer.
            </p>
            <p className="muted" style={{marginTop:8}}>
              Your form has been submitted and locked. Our front desk will assign your tag.
            </p>
            <button
              className="btn wide"
              onClick={() => {
                if (window.history.length > 1) window.location.replace('/');
                else window.close();
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        h2 { margin: 8px 0; }
        h3 { margin: 16px 0 4px; }
        .small { font-size: 12px; }

        label { font-size: 12px; font-weight: 700; color: #0b0f12; display: block; margin-bottom: 4px; }
        input, select, textarea {
          width: 100%; padding: 6px 8px; border: 1px solid #d8e3f5; border-radius: 8px; background: #fbfdff; box-sizing: border-box;
        }
        textarea { resize: vertical; }

        input:disabled, select:disabled, textarea:disabled { background: #f3f4f6; color: #6b7280; }

        .grid { display: grid; gap: 8px; grid-template-columns: repeat(12, 1fr); }
        .c3{grid-column: span 3} .c4{grid-column: span 4} .c6{grid-column: span 6} .c8{grid-column: span 8}

        .rowInline { display: flex; align-items: center; padding-top: 22px; gap: 8px; }
        .checks { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .chk { display: inline-flex; align-items: center; gap: 6px; }
        .muted { color: #6b7280; font-size: 12px; }

        .summary { position: sticky; top: 0; background: #f5f8ff; border: 1px solid #d8e3f5; border-radius: 10px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.06); z-index:5; }
        .summary .row { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); align-items: end; }
        .summary .row.small { margin-top: 6px; grid-template-columns: 1fr; }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #d8e3f5; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }

        .actions { position: sticky; bottom: 0; background:#fff; padding: 10px 0; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; border-top:1px solid #eef2f7; }
        .btn { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #155acb; color: #fff; font-weight: 800; cursor: pointer; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .status { min-height: 20px; font-size: 12px; color: #334155; margin-right:auto; }
        .status.ok { color: #065f46; }
        .status.err { color: #b91c1c; }

        .print-only { display: none; }
        @media print { .screen-only { display: none !important; } .print-only { display: block !important; } }
        @media (max-width: 900px) {
          .summary .row { grid-template-columns: 1fr; }
          .summary .row.small { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .grid { grid-template-columns: 1fr; }
          .rowInline { padding-top: 0; }
          .summary .checks { gap: 8px; }
        }

        /* Modal */
        .modal {
          position: fixed; inset: 0; background: rgba(11, 15, 18, 0.6);
          display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 9999;
        }
        .modal-card {
          width: 100%; max-width: 520px; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 12px 30px rgba(0,0,0,.25);
        }
        .modal-card h3 { margin: 4px 0 0; }
        .modal-card code { background: #f3f4f6; padding: 0 6px; border-radius: 4px; }
        .btn.wide { width: 100%; margin-top: 12px; }
      `}</style>
    </div>
  );
}
