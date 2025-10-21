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
  // NOTE: Tag intentionally blank/disabled in UI. We still keep the key in state.
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
  sex?: '' | 'Buck' | 'Doe'| 'Antlerless';
  howKilled?: '' | 'Gun' | 'Archery' | 'Vehicle';  // NEW
  processType?:
    | ''
    | 'Standard Processing'
    | 'Caped'
    | 'Skull-Cap'
    | 'European'
    | 'Cape & Donate'
    | 'Donate';

  status?: string;            // regular status (hidden in UI)
  capingStatus?: string;      // cape status (hidden in UI)
  webbsStatus?: string;       // webbs status (hidden in UI)

  // Specialty Status (hidden in UI but kept in payload)
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

  // legacy + new paid flags
  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;  // regular processing paid
  paidSpecialty?: boolean;   // specialty paid

  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  price?: number | string;

  // overnight signal for backend
  requiresTag?: boolean;

  // comms prefs + consent
  prefEmail?: boolean;       // maps to "Pref Email"
  prefSMS?: boolean;         // maps to "Pref SMS"
  prefCall?: boolean;        // maps to "Pref Call"
  smsConsent?: boolean;      // maps to "SMS Consent"
  autoCallConsent?: boolean; // maps to "Auto Call Consent"
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

// keep lists for internal coercion only (not rendered)
const STATUS_MAIN  = ['Dropped Off', 'Processing', 'Finished', 'Called', 'Picked Up'] as const;
const STATUS_CAPE  = ['Dropped Off', 'Caped', 'Called', 'Picked Up'] as const;
const STATUS_WEBBS = ['Dropped Off', 'Sent', 'Delivered', 'Called', 'Picked Up'] as const;
const STATUS_SPEC  = ['Dropped Off', 'In Progress', 'Finished', 'Called', 'Picked Up'] as const;

const coerce = (v: string | undefined, list: readonly string[]) =>
  list.includes(String(v)) ? String(v) : list[0];

/* ===== Suspense wrapper ===== */
export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{padding:16}}>Loading…</div></div>}>
      <OvernightIntakePage />
    </Suspense>
  );
}

function OvernightIntakePage() {
  const [job, setJob] = useState<Job>({
    tag: '',                  // overnight has no tag at intake time
    dropoff: todayISO(),
    status: 'Dropped Off',
    capingStatus: '',
    webbsStatus: '',
    specialtyStatus: '',
    howKilled: '',   // NEW


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

    requiresTag: true,        // backend allows missing tag

    // sensible defaults for prefs
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

  // status coercion/initialization (hidden UI)
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
    if (!job.howKilled) missing.push('How Killed');   // NEW
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

    // Construct payload exactly as backend expects; requiresTag=true allows no tag
    const payload: Job = {
      ...job,
      tag: '',                 // never send a tag on overnight
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

      howKilled: job.howKilled || '',   // NEW


      priceProcessing: processingPrice,
      priceSpecialty:  specialtyPrice,
      price:           totalPrice,

      // keep Paid flags consistent
      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty:  job.specialtyProducts ? !!job.paidSpecialty : false,

      // sanitize specialty number fields
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
      // Lock and show thank-you; front-of-house will add Tag later.
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

          {/* Trimmed summary: ONLY the total (no status UI at all) */}
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
          <div className="grid">
            <div className="c3">
              <label>Confirmation #</label>
              <input
                value={job.confirmation || ''}
                onChange={(e) => setVal('confirmation', e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="c6">
              <label>Customer Name</label>
              <input
                value={job.customer || ''}
                onChange={(e) => setVal('customer', e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="c3">
              <label>Phone</label>
              <input
                value={job.phone || ''}
                onChange={(e) => setVal('phone', e.target.value)}
                disabled={locked}
              />
            </div>

            <div className="c4">
              <label>Email</label>
              <input
                value={job.email || ''}
                onChange={(e) => setVal('email', e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="c8">
              <label>Address</label>
              <input
                value={job.address || ''}
                onChange={(e) => setVal('address', e.target.value)}
                disabled={locked}
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
              />
            </div>
            <div className="c4">
              <label>Zip</label>
              <input
                value={job.zip || ''}
                onChange={(e) => setVal('zip', e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
        </section>

        <section>
  <h3>Hunt Details</h3>
  <div className="grid">
    <div className="c4">
      <label>County Killed</label>
      <input
        value={job.county || ''}
        onChange={(e) => setVal('county', e.target.value)}
        disabled={locked}
      />
    </div>

    <div className="c4">
      <label>Drop-off Date</label>
      <input
        type="date"
        value={job.dropoff || ''}
        onChange={(e) => setVal('dropoff', e.target.value)}
        disabled={locked}
      />
    </div>

    <div className="c4">
      <label>Deer Sex</label>
      <select
        value={job.sex || ''}
        onChange={(e) => setVal('sex', e.target.value as Job['sex'])}
        disabled={locked}
      >
        <option value="">—</option>
        <option value="Buck">Buck</option>
        <option value="Doe">Doe</option>
        <option value="Antlerless">Antlerless</option>
      </select>
    </div>

    {/* Row 2 */}
{/* How Killed */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <label className="form-label">How Killed</label>
  <select
    className="form-input sm:col-span-2"
    value={job.howKilled || ''}
    onChange={(e) => setJob(j => ({ ...j, howKilled: e.target.value as any }))}
  >
    <option value="">Select</option>
    <option value="Gun">Gun</option>
    <option value="Archery">Archery</option>
    <option value="Vehicle">Vehicle</option>
  </select>
</div>


    <div className="c4">
      <label>Process Type</label>
      <select
        value={job.processType || ''}
        onChange={(e) => setVal('processType', e.target.value as Job['processType'])}
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
          <div className="pkgGrid">
            <div className="pkg steak">
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
            <div className="pkg steakOther">
              <label>Steak Size (Other)</label>
              <input
                value={job.steak === 'Other' ? (job.steakOther || '') : ''}
                onChange={(e) => setVal('steakOther', e.target.value)}
                disabled={job.steak !== 'Other' || locked}
                placeholder='e.g., 5/8"'
              />
            </div>

            <div className="pkg steaksPer">
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

            <div className="pkg burgerSize">
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

            <div className="pkg beefFat">
              <label className="chk tight pkg-beef">
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

        {/* Specialty Products (no Specialty Status UI) */}
        <section>
          <h3>McAfee Specialty Products</h3>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight pkg-beef">
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
                value={job.specialtyProducts ? String(job.summerSausageLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageLbs', e.target.value)}
                disabled={!job.specialtyProducts || locked}
              />
            </div>
            <div className="c3">
              <label>Summer Sausage + Cheese (lb)</label>
              <input
                inputMode="numeric"
                value={job.specialtyProducts ? String(job.summerSausageCheeseLbs ?? '') : ''}
                onChange={(e) => setVal('summerSausageCheeseLbs', e.target.value)}
                disabled={!job.specialtyProducts || locked}
              />
            </div>
            <div className="c3">
              <label>Sliced Jerky (lb)</label>
              <input
                inputMode="numeric"
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
          <textarea
            rows={3}
            value={job.notes || ''}
            onChange={(e) => setVal('notes', e.target.value)}
            disabled={locked}
          />
        </section>

        {/* Webbs */}
        <section>
          <h3>Webbs</h3>
          <div className="grid">
            <div className="c3 rowInline">
              <label className="chk tight pkg-beef">
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
              />
            </div>
            <div className="c3">
              <label>Webbs Pounds (lb)</label>
              <input
                inputMode="numeric"
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
          <div className={`status ${msg.startsWith('Save') ? 'ok' : msg ? 'err' : ''}`}>{msg}</div>
          {/* Overnight = no print button */}
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
        h3 { margin: 16px 0 8px; }

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
        .summary .row.small { margin-top: 6px; grid-template-columns: 1fr; } /* total only */
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


        
        
        /* Packaging layout (grid areas for robustness) */
        .pkgGrid {
          display: grid;
          gap: 16px;
        }
        /* Desktop and large tablets */
        @media (min-width: 960px) {
          .pkgGrid {
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-areas:
              "steak steakOther steaksPer"
              "burger beef beef";
            align-items: end;
          }
        }
        /* Phones / small tablets */
        @media (max-width: 959.98px) {
          .pkgGrid {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "steak steakOther"
              "steaksPer steaksPer"
              "burger burger"
              "beef beef";
            align-items: end;
          }
        }

        .pkgGrid .pkg { min-width: 0; }
        .pkgGrid .steak      { grid-area: steak; }
        .pkgGrid .steakOther { grid-area: steakOther; }
        .pkgGrid .steaksPer  { grid-area: steaksPer; }
        .pkgGrid .burgerSize { grid-area: burger; }
        .pkgGrid .beefFat    { grid-area: beef; display: flex; align-items: center; }
        .pkgGrid .beefFat .chk { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }

        /* Make controls fluid */
        .pkgGrid select, .pkgGrid input { width: 100%; min-width: 0; }

        
        /* Scoped label fix so Beef fat text never stacks vertically */
        .pkgGrid .pkg-beef { white-space: nowrap; }
        .pkgGrid .pkg-beef span { white-space: nowrap; }
        .pkgGrid .beefFat { justify-content: flex-start; }

        /* Specialty layout (unchanged from last patch) */
        .specGrid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 12px;
          align-items: end;
        }
        .specGrid .spec { min-width: 0; }
        .specGrid .full { grid-column: 1 / -1; }
        .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: span 4; }

        @media (max-width: 900px) {
          .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: 1 / -1; }
        }
    
        .specGrid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 12px;
          align-items: end;
        }
        .specGrid .spec { min-width: 0; }
        .specGrid .full { grid-column: 1 / -1; }
        .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: span 4; }

        @media (max-width: 900px) {
          .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: 1 / -1; }
        }

    
        .specGrid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 12px;
          align-items: end;
        }
        .specGrid .spec { min-width: 0; }
        .specGrid .full { grid-column: 1 / -1; }
        .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: span 4; }

        @media (max-width: 900px) {
          .specGrid .ss, .specGrid .ssc, .specGrid .jerky { grid-column: 1 / -1; }
        }

        @media (max-width: 720px) {
          .pkgGrid {
            grid-template-columns: 1fr 1fr;
          }
          .pkgGrid .steak, .pkgGrid .steakOther { grid-column: auto; }
          .pkgGrid .steaksPer, .pkgGrid .burgerSize { grid-column: auto; }
          .pkgGrid .beefFat { grid-column: 1 / -1; }
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
