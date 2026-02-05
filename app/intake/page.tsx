'use client';

import { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveJob, getJob } from '@/lib/api';
import PrintSheet from '@/app/components/PrintSheet';
import { lookupUniqueZipByCity } from '@/app/lib/cityZip';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

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
  sex?: '' | 'Buck' | 'Doe' | 'Antlerless';
  processType?:
    | ''
    | 'Standard Processing'
    | 'Caped'
    | 'Skull-Cap'
    | 'European'
    | 'Cape & Donate'
    | 'Donate';

  status?: string; // regular status
  capingStatus?: string; // only shown if Caped / Cape & Donate
  webbsStatus?: string; // only shown if Webbs (and not Donate)

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
  backstrapThickness?: '' | '1/2"' | '3/4"' | 'Other';
  backstrapThicknessOther?: string;

  specialtyProducts?: boolean;
  summerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  slicedJerkyLbs?: string | number;
  specialtyPounds?: string;

  notes?: string;

  howKilled?: '' | 'Gun' | 'Archery' | 'Vehicle';

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;

  price?: number | string; // optional override

  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;

  prefEmail?: boolean;
  prefSMS?: boolean;
  prefCall?: boolean;
  smsConsent?: boolean;
  autoCallConsent?: boolean;
};


type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const normalize = (v: any): Json => {
    if (v === undefined) return null;
    if (v === null) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v as any;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === 'object') {
      if (seen.has(v)) return null; // should never happen here, but safe
      seen.add(v);
      const out: Record<string, Json> = {};
      Object.keys(v).sort().forEach((k) => {
        out[k] = normalize(v[k]);
      });
      return out;
    }
    return String(v);
  };
  return JSON.stringify(normalize(obj));
}

function snapshotJob(j: Job) {
  // Force a consistent shape + defaults so the dirty check is reliable.
  return {
    tag: j.tag ?? '',
    confirmation: j.confirmation ?? '',
    customer: j.customer ?? '',
    phone: j.phone ?? '',
    email: j.email ?? '',
    address: j.address ?? '',
    city: j.city ?? '',
    state: j.state ?? '',
    zip: j.zip ?? '',
    county: j.county ?? '',
    dropoff: j.dropoff ?? '',
    sex: j.sex ?? '',
    howKilled: j.howKilled ?? '',
    processType: j.processType ?? '',

    status: j.status ?? '',
    capingStatus: j.capingStatus ?? '',
    webbsStatus: j.webbsStatus ?? '',
    specialtyStatus: j.specialtyStatus ?? '',

    steak: j.steak ?? '',
    steakOther: j.steakOther ?? '',
    burgerSize: j.burgerSize ?? '',
    steaksPerPackage: j.steaksPerPackage ?? '',
    beefFat: !!j.beefFat,

    hindRoastCount: j.hindRoastCount ?? '',
    frontRoastCount: j.frontRoastCount ?? '',

    hind: {
      'Hind - Steak': !!j.hind?.['Hind - Steak'],
      'Hind - Roast': !!j.hind?.['Hind - Roast'],
      'Hind - Grind': !!j.hind?.['Hind - Grind'],
      'Hind - None': !!j.hind?.['Hind - None'],
    },
    front: {
      'Front - Steak': !!j.front?.['Front - Steak'],
      'Front - Roast': !!j.front?.['Front - Roast'],
      'Front - Grind': !!j.front?.['Front - Grind'],
      'Front - None': !!j.front?.['Front - None'],
    },

    backstrapPrep: j.backstrapPrep ?? '',
    backstrapThickness: j.backstrapThickness ?? '',
    backstrapThicknessOther: j.backstrapThicknessOther ?? '',

    specialtyProducts: !!j.specialtyProducts,
    summerSausageLbs: String(j.summerSausageLbs ?? ''),
    summerSausageCheeseLbs: String(j.summerSausageCheeseLbs ?? ''),
    slicedJerkyLbs: String(j.slicedJerkyLbs ?? ''),
    specialtyPounds: j.specialtyPounds ?? '',

    notes: j.notes ?? '',

    webbsOrder: !!j.webbsOrder,
    webbsFormNumber: j.webbsFormNumber ?? '',
    webbsPounds: j.webbsPounds ?? '',

    paidProcessing: !!j.paidProcessing,
    paidSpecialty: !!j.paidSpecialty,
    Paid: !!j.Paid,
    paid: !!j.paid,

    prefEmail: !!j.prefEmail,
    prefSMS: !!j.prefSMS,
    prefCall: !!j.prefCall,
    smsConsent: !!j.smsConsent,
    autoCallConsent: !!j.autoCallConsent,
  };
}

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
    p === 'Cape & Donate' ? 20 :
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 :
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
  return ['true', 'yes', 'y', '1', 'on', 'paid', 'x', '✓', '✔'].includes(s);
};

type AnyRec = Record<string, any>;
const pickCut = (obj: unknown, key: string): boolean => {
  return asBool(obj && typeof obj === 'object' ? (obj as AnyRec)[key] : undefined);
};

const fullPaid = (j: Job): boolean => {
  const proc = !!j.paidProcessing;
  const needsSpec = asBool(j.specialtyProducts);
  const spec = needsSpec ? !!j.paidSpecialty : true;
  return proc && spec;
};

const STATUS_MAIN = ['Dropped Off', 'Processing', 'Finished', 'Called', 'Picked Up'] as const;
const STATUS_CAPE = ['Dropped Off', 'Caped', 'Called', 'Picked Up'] as const;
const STATUS_WEBBS = ['Dropped Off', 'Sent', 'Delivered', 'Called', 'Picked Up'] as const;
const STATUS_SPECIALTY = ['Dropped Off', 'In Progress', 'Finished', 'Called', 'Picked Up'] as const;

const coerce = <T extends readonly string[]>(v: string | undefined, list: T): T[number] =>
  (list.includes(String(v)) ? String(v) : list[0]) as T[number];

/* ===== Suspense wrapper ===== */
export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{ padding: 16 }}>Loading…</div></div>}>
      <IntakePage />
    </Suspense>
  );
}

function IntakePage() {
  const sp = useSearchParams();
  const tagFromUrl = sp.get('tag') ?? '';

  const [job, setJob] = useState<Job>({
    tag: tagFromUrl || '',
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

    howKilled: '',

    prefEmail: true,
    prefSMS: false,
    prefCall: false,
    smsConsent: false,
    autoCallConsent: false,
  });

  const [zipDirty, setZipDirty] = useState(false);

  useEffect(() => {
    if (!zipDirty && (job.city || job.state)) {
      const z = lookupUniqueZipByCity(job.state, job.city);
      if (z && (!job.zip || job.zip.trim() === '' || job.zip === z)) {
        setJob((p) => ({ ...p, zip: z }));
      }
    }
  }, [job.city, job.state, zipDirty]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const tagRef = useRef<HTMLInputElement | null>(null);

  // ---- UNSAVED CHANGES GUARD ----
  const [lastSavedJson, setLastSavedJson] = useState<string>('');
  const currentJson = useMemo(() => stableStringify(snapshotJob(job)), [job]);
  const dirty = useMemo(() => {
    if (!lastSavedJson) return false; // no baseline yet
    return currentJson !== lastSavedJson;
  }, [currentJson, lastSavedJson]);

  useUnsavedChanges({
    when: dirty && !busy,
    message: 'You have NOT saved this intake. Leave without saving?',
  });

  useEffect(() => {
    tagRef.current?.focus();
  }, []);

  // Establish baseline for a brand new job (or when tag query changes)
useEffect(() => {
  setLastSavedJson(
    stableStringify(
      snapshotJob({
        ...job,
        tag: tagFromUrl || job.tag || '',
      } as Job)
    )
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tagFromUrl]);


  // Load existing job by tag (if present)
  useEffect(() => {
    (async () => {
      if (!tagFromUrl) return;
      try {
        const res = await getJob(tagFromUrl);
        if (res?.exists && res.job) {
          const j: any = res.job;

          const base: Job = {
            tag: tagFromUrl || '',
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
            howKilled: '',
            prefEmail: true,
            prefSMS: false,
            prefCall: false,
            smsConsent: false,
            autoCallConsent: false,
          };

          const pnorm = normProc(j.processType);
          const next: Job = {
            ...base,
            ...j,
            tag: j.tag || tagFromUrl,
            dropoff: j.dropoff || todayISO(),

            status:
              pnorm === 'Cape & Donate' || pnorm === 'Donate'
                ? ''
                : coerce(j.status || base.status || 'Dropped Off', STATUS_MAIN),

            capingStatus:
              (pnorm === 'Caped' || pnorm === 'Cape & Donate')
                ? coerce(j.capingStatus || 'Dropped Off', STATUS_CAPE)
                : '',

            webbsStatus:
              (asBool(j.webbsOrder) && pnorm !== 'Donate')
                ? coerce(j.webbsStatus || 'Dropped Off', STATUS_WEBBS)
                : '',

            specialtyStatus: asBool(j.specialtyProducts)
              ? coerce(j.specialtyStatus || 'Dropped Off', STATUS_SPECIALTY)
              : '',

            hind: {
              'Hind - Steak': pickCut(j?.hind, 'Hind - Steak'),
              'Hind - Roast': pickCut(j?.hind, 'Hind - Roast'),
              'Hind - Grind': pickCut(j?.hind, 'Hind - Grind'),
              'Hind - None': pickCut(j?.hind, 'Hind - None'),
            },
            front: {
              'Front - Steak': pickCut(j?.front, 'Front - Steak'),
              'Front - Roast': pickCut(j?.front, 'Front - Roast'),
              'Front - Grind': pickCut(j?.front, 'Front - Grind'),
              'Front - None': pickCut(j?.front, 'Front - None'),
            },

            confirmation:
              j.confirmation ??
              j['Confirmation #'] ??
              j['Confirmation'] ??
              '',

            paidProcessing: !!(j.paidProcessing ?? j.PaidProcessing ?? j.Paid_Processing),
            paidSpecialty: !!(j.paidSpecialty ?? j.PaidSpecialty ?? j.Paid_Specialty),
            specialtyProducts: asBool(j.specialtyProducts),

            howKilled: j.howKilled || j['How Killed'] || '',

            prefEmail: asBool(j.prefEmail),
            prefSMS: asBool(j.prefSMS),
            prefCall: asBool(j.prefCall),
            smsConsent: asBool(j.smsConsent),
            autoCallConsent: asBool(j.autoCallConsent),
          };

          const fp = fullPaid(next);
          next.Paid = !!(j.Paid ?? j.paid ?? fp);
          next.paid = !!(j.Paid ?? j.paid ?? fp);

          setJob(next);
          setLastSavedJson(stableStringify(snapshotJob(next))); // baseline after load
        }
      } catch (e: any) {
        setMsg(`Load failed: ${e?.message || e}`);
      }
    })();
  }, [tagFromUrl]);

  const processingPrice = useMemo(
    () => suggestedProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder),
    [job.processType, job.beefFat, job.webbsOrder]
  );

  const specialtyPrice = useMemo(() => {
    if (!job.specialtyProducts) return 0;
    const ss = toInt(job.summerSausageLbs);
    const ssc = toInt(job.summerSausageCheeseLbs);
    const jer = toInt(job.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 4.60;
  }, [job.specialtyProducts, job.summerSausageLbs, job.summerSausageCheeseLbs, job.slicedJerkyLbs]);

  const totalPrice = processingPrice + specialtyPrice;

  const hindRoastOn = !!job.hind?.['Hind - Roast'];
  const frontRoastOn = !!job.front?.['Front - Roast'];
  const isWholeBackstrap = job.backstrapPrep === 'Whole';
  const needsBackstrapOther = !isWholeBackstrap && job.backstrapThickness === 'Other';
  const needsSteakOther = job.steak === 'Other';
  const procNorm = normProc(job.processType);
  const capingFlow = procNorm === 'Caped' || procNorm === 'Cape & Donate';
  const webbsOn = !!job.webbsOrder;

  const showMainStatus = procNorm !== 'Cape & Donate' && procNorm !== 'Donate';
  const showCapingStatus = capingFlow;
  const showWebbsStatus = webbsOn && procNorm !== 'Donate';
  const showSpecialtyStatus = !!job.specialtyProducts;

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
      return next;
    });
  }, [capingFlow, webbsOn, procNorm]);

  useEffect(() => {
    setJob((prev) => {
      if (!asBool(prev.specialtyProducts)) {
        const next: Job = { ...prev, paidSpecialty: false, specialtyStatus: '' };
        const fp = fullPaid(next);
        return { ...next, Paid: fp, paid: fp };
      } else if (!prev.specialtyStatus) {
        return { ...prev, specialtyStatus: 'Dropped Off' };
      }
      return prev;
    });
  }, [job.specialtyProducts]);

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

  const onSave = async (): Promise<boolean> => {
    setMsg('');
    const missing = validate();
    if (missing.length) {
      setMsg(`Missing or invalid: ${missing.join(', ')}`);
      return false;
    }

    const pnorm = normProc(job.processType);

    const payload: Job = {
      ...job,
      status:
        pnorm === 'Cape & Donate' || pnorm === 'Donate'
          ? ''
          : coerce(job.status, STATUS_MAIN),

      capingStatus:
        (pnorm === 'Caped' || pnorm === 'Cape & Donate')
          ? coerce(job.capingStatus, STATUS_CAPE)
          : '',

      webbsStatus:
        (job.webbsOrder && pnorm !== 'Donate')
          ? coerce(job.webbsStatus, STATUS_WEBBS)
          : '',

      specialtyStatus: job.specialtyProducts
        ? coerce(job.specialtyStatus, STATUS_SPECIALTY)
        : '',

      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty: job.specialtyProducts ? !!job.paidSpecialty : false,
      howKilled: job.howKilled || '',

      summerSausageLbs: job.specialtyProducts ? String(toInt(job.summerSausageLbs)) : '',
      summerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
      slicedJerkyLbs: job.specialtyProducts ? String(toInt(job.slicedJerkyLbs)) : '',
    };

    try {
      setBusy(true);
      const res = await saveJob(payload);
      if (!res?.ok) {
        setMsg(res?.error || 'Save failed');
        return false;
      }

      setMsg('Saved ✓');
      setLastSavedJson(stableStringify(snapshotJob({ ...job, ...payload }))); // baseline immediately

      if (job.tag) {
        const fresh = await getJob(job.tag);
if (fresh?.exists && fresh.job) {
  const j: any = fresh.job;

  const merged: Job = {
    ...job,
    ...j,
    confirmation:
      j.confirmation ?? j['Confirmation #'] ?? j['Confirmation'] ?? job.confirmation ?? '',
    paidProcessing: !!(j.paidProcessing ?? j.PaidProcessing ?? j.Paid_Processing),
    paidSpecialty:  !!(j.paidSpecialty  ?? j.PaidSpecialty  ?? j.Paid_Specialty),

    prefEmail:  asBool(j.prefEmail),
    prefSMS:    asBool(j.prefSMS),
    prefCall:   asBool(j.prefCall),
    smsConsent: asBool(j.smsConsent),
    autoCallConsent: asBool(j.autoCallConsent),
  };

  const fp = fullPaid(merged);
  merged.Paid = !!(j.Paid ?? j.paid ?? fp);
  merged.paid = !!(j.Paid ?? j.paid ?? fp);

  setJob(merged);
  setLastSavedJson(stableStringify(snapshotJob(merged)));
}

      }

      return true;
    } catch (e: any) {
      setMsg(e?.message || String(e));
      return false;
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 1500);
    }
  };

  const setVal = <K extends keyof Job>(k: K, v: Job[K]) => setJob((p) => ({ ...p, [k]: v }));

  const setHind = (k: keyof Required<CutsBlock>) =>
    setJob((p) => ({ ...p, hind: { ...(p.hind || {}), [k]: !(p.hind?.[k]) } }));

  const setFront = (k: keyof Required<CutsBlock>) =>
    setJob((p) => ({ ...p, front: { ...(p.front || {}), [k]: !(p.front?.[k]) } }));

  return (
    <div className="form-card">
      <div className="screen-only">
        <h2>Deer Intake</h2>

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
              <div className="muted" style={{ fontSize: 12 }}>Deer Tag</div>
            </div>

            <div className="col price">
              <label>Processing Price</label>
              <div className="money">{processingPrice.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Proc. type + beef fat + Webbs fee</div>
            </div>

            <div className="col price">
              <label>Specialty Price</label>
              <div className="money">{specialtyPrice.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Based On Summer Sausage lbs</div>
            </div>
          </div>

          <div className="row small">
            <div className="col total">
              <label>Total (preview)</label>
              <div className="money total">{totalPrice.toFixed(2)}</div>
            </div>

            {showMainStatus && (
              <div className="col">
                <label>Status</label>
                <select
                  value={coerce(job.status, STATUS_MAIN)}
                  onChange={(e) => setVal('status', e.target.value)}
                >
                  {STATUS_MAIN.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {showCapingStatus && (
              <div className="col">
                <label>Caping Status</label>
                <select
                  value={coerce(job.capingStatus, STATUS_CAPE)}
                  onChange={(e) => setVal('capingStatus', e.target.value)}
                >
                  {STATUS_CAPE.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {showWebbsStatus && (
              <div className="col">
                <label>Webbs Status</label>
                <select
                  value={coerce(job.webbsStatus, STATUS_WEBBS)}
                  onChange={(e) => setVal('webbsStatus', e.target.value)}
                >
                  {STATUS_WEBBS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {showSpecialtyStatus && (
              <div className="col">
                <label>Specialty Status</label>
                <select
                  value={coerce(job.specialtyStatus, STATUS_SPECIALTY)}
                  onChange={(e) => setVal('specialtyStatus', e.target.value as Job['specialtyStatus'])}
                >
                  {STATUS_SPECIALTY.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col">
              <label>Paid</label>
              <div className="pillrow">
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
                onChange={(e) => { setZipDirty(false); setVal('city', e.target.value); }}
              />
            </div>

            <div className="c4">
              <label>State</label>
              <select
                value={job.state || ''}
                onChange={(e) => { setZipDirty(false); setVal('state', e.target.value as 'IN' | 'KY' | ''); }}
              >
                <option value="">—</option>
                <option value="IN">IN</option>
                <option value="KY">KY</option>
                <option value="--">--</option>
                <option value="AL">AL</option>
                <option value="AK">AK</option>
                <option value="AZ">AZ</option>
                <option value="AR">AR</option>
                <option value="CA">CA</option>
                <option value="CO">CO</option>
                <option value="CT">CT</option>
                <option value="DE">DE</option>
                <option value="FL">FL</option>
                <option value="GA">GA</option>
                <option value="HI">HI</option>
                <option value="ID">ID</option>
                <option value="IL">IL</option>
                <option value="IA">IA</option>
                <option value="KS">KS</option>
                <option value="LA">LA</option>
                <option value="ME">ME</option>
                <option value="MD">MD</option>
                <option value="MA">MA</option>
                <option value="MI">MI</option>
                <option value="MN">MN</option>
                <option value="MS">MS</option>
                <option value="MO">MO</option>
                <option value="MT">MT</option>
                <option value="NE">NE</option>
                <option value="NV">NV</option>
                <option value="NH">NH</option>
                <option value="NJ">NJ</option>
                <option value="NM">NM</option>
                <option value="NY">NY</option>
                <option value="NC">NC</option>
                <option value="ND">ND</option>
                <option value="OH">OH</option>
                <option value="OK">OK</option>
                <option value="OR">OR</option>
                <option value="PA">PA</option>
                <option value="RI">RI</option>
                <option value="SC">SC</option>
                <option value="SD">SD</option>
                <option value="TN">TN</option>
                <option value="TX">TX</option>
                <option value="UT">UT</option>
                <option value="VT">VT</option>
                <option value="VA">VA</option>
                <option value="WA">WA</option>
                <option value="WV">WV</option>
                <option value="WI">WI</option>
                <option value="WY">WY</option>
              </select>
            </div>

            <div className="c4">
              <label>Zip</label>
              <input
                value={job.zip || ''}
                onChange={(e) => { setZipDirty(true); setVal('zip', e.target.value); }}
              />
            </div>
          </div>
        </section>

        <section>
          <h3>Hunt Details</h3>
          <div className="grid">
            <div className="c3">
              <label className="text-sm font-medium whitespace-nowrap mb-1">County Killed</label>
              <input
                value={job.county || ''}
                onChange={(e) => setVal('county', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="c3">
              <label className="text-sm font-medium whitespace-nowrap mb-1">Drop-off Date</label>
              <input
                type="date"
                value={job.dropoff || ''}
                onChange={(e) => setVal('dropoff', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="c2">
              <label className="text-sm font-medium whitespace-nowrap mb-1">Deer Sex</label>
              <select
                value={job.sex || ''}
                onChange={(e) => setVal('sex', e.target.value as Job['sex'])}
                className="w-full min-w-[10rem]"
              >
                <option value="">—</option>
                <option value="Buck">Buck</option>
                <option value="Doe">Doe</option>
                <option value="Antlerless">Antlerless</option>
              </select>
            </div>

            <div className="c2">
              <label className="text-sm font-medium whitespace-nowrap mb-1">How Killed</label>
              <select
                value={job.howKilled || ''}
                onChange={(e) => setVal('howKilled', e.target.value as Job['howKilled'])}
                className="w-full min-w-[10rem]"
              >
                <option value="">—</option>
                <option value="Gun">Gun</option>
                <option value="Archery">Archery</option>
                <option value="Vehicle">Vehicle</option>
              </select>
            </div>

            <div className="c2">
              <label className="text-sm font-medium whitespace-nowrap mb-1">Process Type</label>
              <select
                value={job.processType || ''}
                onChange={(e) => setVal('processType', e.target.value as Job['processType'])}
                className="w-full min-w-[10rem]"
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
                onChange={(e) => setVal('backstrapPrep', e.target.value as Job['backstrapPrep'])}
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
                onChange={(e) => setVal('backstrapThickness', e.target.value as Job['backstrapThickness'])}
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

            {job.specialtyProducts && (
              <>
                <div className="c4">
                  <label>Summer Sausage (lb)</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(job.summerSausageLbs ?? '')}
                    onChange={(e) => setVal('summerSausageLbs', e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>

                <div className="c4">
                  <label>Plain Summer Sausage + Cheddar (lb)</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(job.summerSausageCheeseLbs ?? '')}
                    onChange={(e) => setVal('summerSausageCheeseLbs', e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>

                <div className="c4">
                  <label>Jalapeno Summer Sausage + Cheddar (lb)</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(job.slicedJerkyLbs ?? '')}
                    onChange={(e) => setVal('slicedJerkyLbs', e.target.value)}
                    placeholder="e.g., 3"
                  />
                </div>
              </>
            )}
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

        {/* Communication & Consent */}
        <section>
          <h3>Communication & Consent</h3>
          <div className="grid">
            <div className="c4">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={!!job.prefEmail}
                  onChange={(e) => setVal('prefEmail', e.target.checked)}
                />
                <span>Prefer Email</span>
              </label>
            </div>
            <div className="c4">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={!!job.prefSMS}
                  onChange={(e) => setVal('prefSMS', e.target.checked)}
                />
                <span>Prefer Text (SMS)</span>
              </label>
            </div>
            <div className="c4">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={!!job.prefCall}
                  onChange={(e) => setVal('prefCall', e.target.checked)}
                />
                <span>Prefer Phone Call</span>
              </label>
            </div>

            <div className="c6">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={!!job.smsConsent}
                  onChange={(e) => setVal('smsConsent', e.target.checked)}
                />
                <span>Consent to receive SMS texts</span>
              </label>
            </div>
            <div className="c6">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={!!job.autoCallConsent}
                  onChange={(e) => setVal('autoCallConsent', e.target.checked)}
                />
                <span>Consent to receive automated calls</span>
              </label>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="actions">
          <div className={`status ${msg.startsWith('Save') ? 'ok' : msg ? 'err' : ''}`}>
            {msg || (dirty ? 'Unsaved changes' : '')}
          </div>

          <button
            className="btn"
            type="button"
            onClick={async () => {
              // Auto-save before printing to prevent lost intakes
              if (dirty) {
                const ok = await onSave();
                if (!ok) return;
              }
              window.print();
            }}
            disabled={busy}
          >
            Print
          </button>

          <button className="btn" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="print-only">
        <PrintSheet job={job} />
      </div>

      <style jsx>{`
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
        .summary .row.small { margin-top: 6px; grid-template-columns: repeat(5, 1fr); }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #d8e3f5; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }

        .summary .pillrow { display: flex; gap: 10px; align-items: center; flex-wrap: nowrap; }
        .summary .pill { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 10px; border: 2px solid #eab308; background: #fff7db; border-radius: 999px; white-space: nowrap; cursor: pointer; user-select: none; }
        .summary .pill.on { border-color: #10b981; background: #ecfdf5; }
        .summary .pill > input[type="checkbox"] { width: 18px; height: 18px; margin: 0; appearance: auto; }
        .summary .badge { display: inline-block; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; line-height: 1.1; }

        .count { display: inline-flex; align-items: center; gap: 6px; }
        .countInp { width: 70px; text-align: center; }

        .actions { position: sticky; bottom: 0; background:#fff; padding: 10px 0; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; border-top:1px solid #eef2f7; }
        .btn { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #155acb; color: #fff; font-weight: 800; cursor: pointer; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .status { min-height: 20px; font-size: 12px; color: #334155; margin-right:auto; }
        .status.ok { color: #065f46; }
        .status.err { color: #b91c1c; }

        .print-only { display: none; }
        @media print { .screen-only { display: none !important; } .print-only { display: block !important; } }
        @media (max-width: 900px) { .summary .row.small { grid-template-columns: 1fr 1fr; } }
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
