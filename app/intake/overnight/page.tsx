// app/(public)/overnight/page.tsx
'use client';

import { Fragment, useEffect, useMemo, useState, Suspense } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { Hint } from '@/app/intake/overnight/_ux_upgrades';
import { lookupUniqueZipByCity } from '@/app/lib/cityZip';
import { SPECIALTY_ITEMS, specialtyBreakdown, specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';
import { calcProcessingPrice, DEFAULT_SITE_PRICING, normalizePricing, normProc } from '@/lib/pricing';
import {
  WEBBS_GROUPS,
  type WebbsOrderItem,
  normalizeWebbsOrderItems,
  webbsOrderSummary,
  webbsOrderTotalLbs,
} from '@/lib/webbs';

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
  // Overnight/public does NOT have a tag at intake time.
  // Keep it in state for typing parity, but we will send an empty string to the backend.
  tag?: string | null;
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
  howKilled?: '' | 'Gun' | 'Archery' | 'Vehicle';
  processType?:
    | ''
    | 'Standard Processing'
    | 'Caped'
    | 'Skull-Cap'
    | 'European'
    | 'Cape & Donate'
    | 'Donate';

  status?: string;       // hidden in UI
  capingStatus?: string; // hidden in UI
  webbsStatus?: string;  // hidden in UI

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
  originalSummerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  jalapenoSummerSausageCheeseLbs?: string | number;
  originalSnackSticksLbs?: string | number;
  originalSnackSticksCheeseLbs?: string | number;
  jalapenoSnackSticksCheeseLbs?: string | number;

  notes?: string;

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;
  webbsOrderMode?: 'online';
  webbsItems?: WebbsOrderItem[];

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

/* ---------------- Helpers ---------------- */

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
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

const fullPaid = (j: Job): boolean => {
  const proc = !!j.paidProcessing;
  const needsSpec = asBool(j.specialtyProducts);
  const spec = needsSpec ? !!j.paidSpecialty : true;
  return proc && spec;
};

const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');
const is13Digits = (s?: string) => !!s && /^\d{13}$/.test(s);
const is10Digits = (s?: string) => !!s && /^\d{10}$/.test(s);

const REQUIRED_LABELS: Record<string, string> = {
  confirmation: 'Confirmation #',
  customer: 'Customer Name',
  phone: 'Phone',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'Zip',
  county: 'County Killed',
  dropoff: 'Drop-off Date',
  sex: 'Deer Sex',
  howKilled: 'How Killed',
  processType: 'Process Type',
  webbsPounds: 'Estimated Webbs Pounds',
  webbsItems: 'Webbs Items',
};

/* ===== Suspense wrapper ===== */

export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{ padding: 16 }}>Loading…</div></div>}>
      <OvernightIntakePage />
    </Suspense>
  );
}

function OvernightIntakePage() {
  const [job, setJob] = useState<Job>({
    tag: undefined,
    dropoff: todayISO(),
    status: 'Dropped Off',
    capingStatus: '',
    webbsStatus: '',
    specialtyStatus: '',
    howKilled: '',

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
    webbsOrderMode: 'online',
    webbsItems: [],
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
  const [locked, setLocked] = useState<boolean>(false);
  const [showThanks, setShowThanks] = useState<boolean>(false);
  const [intakeEnabled, setIntakeEnabled] = useState(true);
  const [closureMessage, setClosureMessage] = useState('');
  const [webbsModalOpen, setWebbsModalOpen] = useState(false);
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [pricing, setPricing] = useState(DEFAULT_SITE_PRICING);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = useState(0);

  const steps = [
    { key: 'customer', title: 'Customer' },
    { key: 'hunt', title: 'Hunt' },
    { key: 'cuts', title: 'Cuts' },
    { key: 'extras', title: 'Extras' },
    { key: 'review', title: 'Review' },
  ] as const;

  type StepKey = (typeof steps)[number]['key'];
  const step = steps[stepIdx];

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setPricing(normalizePricing(j?.settings));
          setIntakeEnabled(!!j?.settings?.public_intake_enabled);
          if (j?.settings?.banner_enabled && j?.settings?.banner_message) {
            setClosureMessage(String(j.settings.banner_message));
          }
        }
      })
      .catch(() => {});
  }, []);

  const processingPrice = useMemo(
    () => calcProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder, pricing),
    [job.processType, job.beefFat, job.webbsOrder, pricing]
  );

  const specialtyPrice = useMemo(() => {
    if (!job.specialtyProducts) return 0;
    return calcSpecialtyPrice(job as any, pricing);
  }, [
    job.specialtyProducts,
    job.originalSummerSausageLbs,
    job.summerSausageCheeseLbs,
    job.jalapenoSummerSausageCheeseLbs,
    job.originalSnackSticksLbs,
    job.originalSnackSticksCheeseLbs,
    job.jalapenoSnackSticksCheeseLbs,
    pricing,
  ]);
  const specialtyItems = useMemo(
    () => specialtyBreakdown(job as Record<string, any>, pricing).filter((item) => item.pounds > 0),
    [job, pricing]
  );
  const specialtySummaryText = useMemo(() => {
    if (!job.specialtyProducts) return 'No specialty products selected';
    const parts: string[] = [];
    if (specialtyItems.length) parts.push(`${specialtyItems.length} products`);
    if (specialtyItems.length) {
      parts.push(`${specialtyItems.reduce((sum, item) => sum + item.pounds, 0)} lb total`);
    }
    if (specialtyPrice) parts.push(`$${specialtyPrice.toFixed(2)}`);
    return parts.length ? parts.join(' • ') : 'Specialty products selected';
  }, [job.specialtyProducts, specialtyItems, specialtyPrice]);

  const totalPrice = processingPrice + specialtyPrice;
  const webbsItems = useMemo(() => normalizeWebbsOrderItems(job.webbsItems), [job.webbsItems]);
  const webbsItemTotal = useMemo(() => webbsOrderTotalLbs(webbsItems), [webbsItems]);
  const webbsItemLines = useMemo(() => webbsOrderSummary(webbsItems), [webbsItems]);
  const webbsSummaryText = useMemo(() => {
    if (!job.webbsOrder) return 'No Webbs order';
    const parts: string[] = [];
    if (toInt(job.webbsPounds)) parts.push(`${toInt(job.webbsPounds)} lb entered`);
    if (webbsItems.length) parts.push(`${webbsItems.length} items`);
    if (webbsItemTotal) parts.push(`${webbsItemTotal} lb detailed`);
    return parts.length ? parts.join(' • ') : 'Fill out the Webbs order';
  }, [job.webbsOrder, job.webbsPounds, webbsItems.length, webbsItemTotal]);

  const procNorm = normProc(job.processType);
  const capingFlow = procNorm === 'Caped' || procNorm === 'Cape & Donate';
  const webbsOn = !!job.webbsOrder;

  // status coercion/initialization (hidden UI)
  useEffect(() => {
    setJob((prev) => {
      const next = { ...prev };
      if (!next.webbsOrder) {
        next.webbsOrderMode = 'online';
        next.webbsItems = [];
      } else if (!next.webbsOrderMode || next.webbsOrderMode !== 'online') {
        next.webbsOrderMode = 'online';
      }
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
    if (!job.webbsOrder && webbsModalOpen) {
      setWebbsModalOpen(false);
    }
  }, [job.webbsOrder, webbsModalOpen]);

  useEffect(() => {
    if (!job.specialtyProducts && specialtyModalOpen) {
      setSpecialtyModalOpen(false);
    }
  }, [job.specialtyProducts, specialtyModalOpen]);

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

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok || !j?.settings) return;
        setIntakeEnabled(j.settings.public_intake_enabled !== false);
        setClosureMessage(String(j.settings.banner_enabled ? j.settings.banner_message || '' : ''));
      })
      .catch(() => {});
  }, []);

  const confirmationLast5 = (job.confirmation || '').replace(/\D/g, '').slice(-5);

  const focusFirstError = (nextErrors: Record<string, string>) => {
    const firstKey = Object.keys(nextErrors)[0];
    if (!firstKey) return;
    window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-err="${firstKey}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.focus();
      }
    });
  };

  const clearErr = (k: string) =>
    setErrors((prev) => {
      if (!prev[k]) return prev;
      const n = { ...prev };
      delete n[k];
      return n;
    });

  const setConfirmation = (v: string) => {
    const val = digitsOnly(v).slice(0, 13);
    setJob((p) => ({ ...p, confirmation: val }));

    // Keep the red error until it's valid.
    setErrors((prev) => {
      if (!prev.confirmation) return prev;
      const n = { ...prev };
      if (is13Digits(val)) delete n.confirmation;
      else n.confirmation = 'Confirmation must be 13 digits';
      return n;
    });
  };

  const setPhone = (v: string) => {
    const val = digitsOnly(v).slice(0, 10);
    setJob((p) => ({ ...p, phone: val }));

    // Keep the red error until it's valid.
    setErrors((prev) => {
      if (!prev.phone) return prev;
      const n = { ...prev };
      if (is10Digits(val)) delete n.phone;
      else n.phone = 'Phone must be 10 digits';
      return n;
    });
  };

  const validateAll = (): Record<string, string> => {
    const e: Record<string, string> = {};

    // Customer (everything required except email)
    if (!is13Digits(job.confirmation)) e.confirmation = 'Confirmation must be 13 digits';
    if (!job.customer?.trim()) e.customer = 'Customer Name is required';
    if (!is10Digits(job.phone)) e.phone = 'Phone must be 10 digits';
    if (!job.address?.trim()) e.address = 'Address is required';
    if (!job.city?.trim()) e.city = 'City is required';
    if (!job.state?.trim()) e.state = 'State is required';
    if (!job.zip?.trim()) e.zip = 'Zip is required';

    // Hunt details (all required)
    if (!job.county?.trim()) e.county = 'County Killed is required';
    if (!job.dropoff?.trim()) e.dropoff = 'Drop-off Date is required';
    if (!job.sex) e.sex = 'Deer Sex is required';
    if (!job.howKilled) e.howKilled = 'How Killed is required';
    if (!job.processType) e.processType = 'Process Type is required';

    if (job.webbsOrder) {
      const enteredPounds = toInt(job.webbsPounds);
      if (!enteredPounds) e.webbsPounds = 'Estimated Webbs pounds are required';
      if (!webbsItems.length) e.webbsItems = 'Enter at least one Webbs item and pounds';
    }

    return e;
  };

  const validateStep = (k: StepKey): Record<string, string> => {
    const all = validateAll();
    const e: Record<string, string> = {};
    const pick = (key: string) => {
      if (all[key]) e[key] = all[key];
    };

    if (k === 'customer') ['confirmation','customer','phone','address','city','state','zip'].forEach(pick);
    if (k === 'hunt') ['county', 'dropoff', 'sex', 'howKilled', 'processType'].forEach(pick);
    if (k === 'extras') ['webbsPounds', 'webbsItems'].forEach(pick);
    if (k === 'review') Object.assign(e, all);
    return e;
  };

  const currentStepErrors = validateStep(step.key);
  const currentStepMissing = Object.keys(currentStepErrors).map((key) => REQUIRED_LABELS[key] || key);
  const requiredDone = currentStepMissing.length === 0;

  const goNext = () => {
    if (locked) return;
    setMsg('');
    const e = validateStep(step.key);
    setErrors(e);
    if (Object.keys(e).length) {
      setMsg('Fix the highlighted required fields.');
      focusFirstError(e);
      return;
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (locked) return;
    setMsg('');
    setStepIdx((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSave = async () => {
    if (locked) return;
    setMsg('');
    if (!intakeEnabled) {
      setMsg(closureMessage || 'Overnight intake is currently unavailable.');
      return;
    }
    const e = validateAll();
    setErrors(e);
    if (Object.keys(e).length) {
      setMsg('Fix the highlighted required fields.');
      focusFirstError(e);
      return;
    }

    const pnorm = normProc(job.processType);

    // IMPORTANT: public/overnight has no tag. Send empty string (not null).
    const payload: Job = {
      ...job,
      tag: '',
      requiresTag: true,

      status: pnorm === 'Cape & Donate' || pnorm === 'Donate' ? '' : (job.status || 'Dropped Off'),

      capingStatus: (pnorm === 'Caped' || pnorm === 'Cape & Donate') ? (job.capingStatus || 'Dropped Off') : '',

      webbsStatus: (job.webbsOrder && pnorm !== 'Donate') ? (job.webbsStatus || 'Dropped Off') : '',
      webbsOrderMode: job.webbsOrder ? 'online' : 'online',
      webbsItems: job.webbsOrder ? webbsItems : [],
      webbsPounds: job.webbsOrder ? String(toInt(job.webbsPounds) || webbsItemTotal || '') : '',

      specialtyStatus: job.specialtyProducts ? (job.specialtyStatus || 'Dropped Off') : '',

      howKilled: job.howKilled || '',

      priceProcessing: processingPrice,
      priceSpecialty: specialtyPrice,
      price: totalPrice,

      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty: job.specialtyProducts ? !!job.paidSpecialty : false,

      originalSummerSausageLbs: job.specialtyProducts ? String(toInt(job.originalSummerSausageLbs)) : '',
      summerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
      jalapenoSummerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.jalapenoSummerSausageCheeseLbs)) : '',
      originalSnackSticksLbs: job.specialtyProducts ? String(toInt(job.originalSnackSticksLbs)) : '',
      originalSnackSticksCheeseLbs: job.specialtyProducts ? String(toInt(job.originalSnackSticksCheeseLbs)) : '',
      jalapenoSnackSticksCheeseLbs: job.specialtyProducts ? String(toInt(job.jalapenoSnackSticksCheeseLbs)) : '',
    };

    try {
      setBusy(true);
      const r = await fetch('/api/public-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ job: payload }),
      });
      const res = await r.json().catch(() => ({} as any));
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

  const setVal = <K extends keyof Job>(k: K, v: Job[K]) => !locked && setJob((p) => ({ ...p, [k]: v }));

  const setWebbsItemPounds = (key: string, value: string) => {
    if (locked) return;
    setJob((prev) => {
      const next = normalizeWebbsOrderItems(prev.webbsItems).filter((item) => item.key !== key);
      const pounds = toInt(value);
      if (pounds > 0) next.push({ key, label: '', pounds });
      return { ...prev, webbsItems: next };
    });
  };

  const setHind = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => ({ ...p, hind: { ...(p.hind || {}), [k]: !(p.hind?.[k]) } }));

  const setFront = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => ({ ...p, front: { ...(p.front || {}), [k]: !(p.front?.[k]) } }));

  return (
    <div className={`form-card ${locked ? 'locked' : ''}`}>
      <div className="screen-only">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-kicker">Overnight Drop-Off</div>
            <h2>Deer Intake Form</h2>
            <p>
              We&apos;ll walk you through this one step at a time. Required items are checked before you move on so
              your deer can be processed without delays.
            </p>
          </div>
          <div className="hero-card">
            <div className="hero-card-title">Before you submit</div>
            <ul>
              <li>Use your 13-digit GoOutdoorsIN confirmation number</li>
              <li>Leave a note with your name, phone, and confirmation digits</li>
              <li>Front desk will assign the real deer tag in the morning</li>
            </ul>
          </div>
        </div>
        {!intakeEnabled ? (
          <div
            style={{
              margin: '0 0 12px',
              border: '1px solid #ef4444',
              background: '#fff1f2',
              color: '#991b1b',
              borderRadius: 10,
              padding: '10px 12px',
              fontWeight: 700,
            }}
          >
            {closureMessage || 'Overnight intake is currently unavailable.'}
          </div>
        ) : null}

        <div className="wizardHead">
          <div className="wizardLeft">
            <div className="wizardStep">Step {stepIdx + 1} of {steps.length}</div>
            <div className="wizardTitle">{step.title}</div>
          </div>
          <div className="wizardRight">
            <span className={`stepState ${requiredDone ? 'good' : ''}`}>
              {requiredDone ? 'Required fields complete' : `${currentStepMissing.length} required item${currentStepMissing.length === 1 ? '' : 's'} left`}
            </span>
          </div>
        </div>

        <div className="stepChips" aria-label="Progress">
          {steps.map((s, idx) => {
            const state = idx < stepIdx ? 'done' : idx === stepIdx ? 'current' : 'upcoming';
            return (
              <button
                key={s.key}
                type="button"
                className={`stepChip ${state}`}
                onClick={() => {
                  if (locked || idx > stepIdx) return;
                  setStepIdx(idx);
                  setMsg('');
                }}
                disabled={locked || idx > stepIdx}
              >
                <span className="stepChipNum">{idx + 1}</span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        {!requiredDone ? (
          <div className="requiredBox" role="status" aria-live="polite">
            <div className="requiredTitle">Finish these before moving on:</div>
            <div className="requiredList">
              {currentStepMissing.map((item) => (
                <span key={item} className="requiredPill">{item}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="summary">
          <div className="row">
            <div className="col">
              <label>Tag Number</label>
              <input value={''} onChange={() => {}} placeholder="Assigned by staff" disabled />
              <div className="muted" style={{ fontSize: 12 }}>Front desk will assign your tag in the morning.</div>
            </div>

            <div className="col price">
              <label>Processing Price</label>
              <div className="money">{processingPrice.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Proc. type + beef fat + Webbs fee</div>
            </div>

            <div className="col price">
              <label>Specialty Price</label>
              <div className="money">{specialtyPrice.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Based on specialty product selections</div>
            </div>
          </div>

          <div className="row small">
            <div className="col total">
              <label>Total (preview)</label>
              <div className="money total">{totalPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Step: Customer */}
        {step.key === 'customer' && (
          <section>
            <h3>Customer</h3>
            <div className="grid">
              <div className="c3">
                <label>Confirmation #</label>
                <Hint>Confirmation number you received from your GoOutdoorsIN (State) check-in.</Hint>
                <input
                  value={job.confirmation || ''}
                  onChange={(e) => setConfirmation(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={13}
                  className={errors.confirmation ? 'err' : ''}
                  data-err="confirmation"
                  disabled={locked}
                />
                {errors.confirmation ? <div className="errText">{errors.confirmation}</div> : null}
              </div>

              <div className="c6">
                <label>Customer Name</label>
                <input
                  value={job.customer || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVal('customer', v);
                    setErrors((prev) => {
                      if (!prev.customer) return prev;
                      const n = { ...prev };
                      if (v.trim()) delete n.customer;
                      else n.customer = 'Customer Name is required';
                      return n;
                    });
                  }}
                  className={errors.customer ? 'err' : ''}
                  data-err="customer"
                  disabled={locked}
                />
                {errors.customer ? <div className="errText">{errors.customer}</div> : null}
              </div>

              <div className="c3">
                <label>Phone</label>
                <input
                  value={job.phone || ''}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  className={errors.phone ? 'err' : ''}
                  data-err="phone"
                  disabled={locked}
                />
                {errors.phone ? <div className="errText">{errors.phone}</div> : null}
              </div>

              <div className="c4">
                <label>Email</label>
                <Hint>Used for receipts or email updates.</Hint>
                <input value={job.email || ''} onChange={(e) => setVal('email', e.target.value)} disabled={locked} />
              </div>

              <div className="c8">
                <label>Address</label>
                <input
                  value={job.address || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVal('address', v);
                    setErrors((prev) => {
                      if (!prev.address) return prev;
                      const n = { ...prev };
                      if (v.trim()) delete n.address;
                      else n.address = 'Address is required';
                      return n;
                    });
                  }}
                  className={errors.address ? 'err' : ''}
                  data-err="address"
                  disabled={locked}
                />
                {errors.address ? <div className="errText">{errors.address}</div> : null}
              </div>

              <div className="c4">
                <label>City</label>
                <input
                  value={job.city || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setZipDirty(false);
                    setVal('city', v);
                    setErrors((prev) => {
                      if (!prev.city) return prev;
                      const n = { ...prev };
                      if (v.trim()) delete n.city;
                      else n.city = 'City is required';
                      return n;
                    });
                  }}
                  className={errors.city ? 'err' : ''}
                  data-err="city"
                  disabled={locked}
                />
                {errors.city ? <div className="errText">{errors.city}</div> : null}
              </div>

              <div className="c4">
                <label>State</label>
                <select
                  value={job.state || ''}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setZipDirty(false);
                    setVal('state', v);
                    setErrors((prev) => {
                      if (!prev.state) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.state;
                      else n.state = 'State is required';
                      return n;
                    });
                  }}
                  className={errors.state ? 'err' : ''}
                  data-err="state"
                  disabled={locked}
                >
                  <option value="">—</option>
                  <option value="IN">IN</option>
                  <option value="KY">KY</option>
                  <option value="IL">IL</option>
                  <option value="OH">OH</option>
                  <option value="MI">MI</option>
                  <option value="TN">TN</option>
                  <option value="MO">MO</option>
                  <option value="WI">WI</option>
                  <option value="IA">IA</option>
                  <option value="WV">WV</option>
                  <option value="PA">PA</option>
                  <option value="VA">VA</option>
                  <option value="NC">NC</option>
                  <option value="SC">SC</option>
                  <option value="GA">GA</option>
                  <option value="FL">FL</option>
                  <option value="AL">AL</option>
                  <option value="MS">MS</option>
                  <option value="LA">LA</option>
                  <option value="AR">AR</option>
                  <option value="TX">TX</option>
                  <option value="OK">OK</option>
                  <option value="KS">KS</option>
                  <option value="NE">NE</option>
                  <option value="SD">SD</option>
                  <option value="ND">ND</option>
                  <option value="MN">MN</option>
                  <option value="CO">CO</option>
                  <option value="WY">WY</option>
                  <option value="MT">MT</option>
                  <option value="NM">NM</option>
                  <option value="AZ">AZ</option>
                  <option value="UT">UT</option>
                  <option value="ID">ID</option>
                  <option value="NV">NV</option>
                  <option value="CA">CA</option>
                  <option value="OR">OR</option>
                  <option value="WA">WA</option>
                  <option value="AK">AK</option>
                  <option value="HI">HI</option>
                  <option value="NY">NY</option>
                  <option value="NJ">NJ</option>
                  <option value="CT">CT</option>
                  <option value="RI">RI</option>
                  <option value="MA">MA</option>
                  <option value="VT">VT</option>
                  <option value="NH">NH</option>
                  <option value="ME">ME</option>
                  <option value="MD">MD</option>
                  <option value="DE">DE</option>
                  <option value="DC">DC</option>
                </select>
                {errors.state ? <div className="errText">{errors.state}</div> : null}
              </div>

              <div className="c4">
                <label>Zip</label>
                <input
                  value={job.zip || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setZipDirty(true);
                    setVal('zip', v);
                    setErrors((prev) => {
                      if (!prev.zip) return prev;
                      const n = { ...prev };
                      if (v.trim()) delete n.zip;
                      else n.zip = 'Zip is required';
                      return n;
                    });
                  }}
                  className={errors.zip ? 'err' : ''}
                  data-err="zip"
                  disabled={locked}
                />
                {errors.zip ? <div className="errText">{errors.zip}</div> : null}
              </div>
            </div>
          </section>
        )}

        {/* Step: Hunt */}
        {step.key === 'hunt' && (
          <section>
            <h3>Hunt Details</h3>
            <div className="grid">
              <div className="c4">
                <label>County Killed</label>
                <Hint>County where the deer was harvested (required for state reporting).</Hint>
                <input
                  value={job.county || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVal('county', v);
                    setErrors((prev) => {
                      if (!prev.county) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.county;
                      else n.county = 'County Killed is required';
                      return n;
                    });
                  }}
                  className={errors.county ? 'err' : ''}
                  data-err="county"
                  disabled={locked}
                />
                {errors.county ? <div className="errText">{errors.county}</div> : null}
              </div>

              <div className="c4">
                <label>Drop-off Date</label>
                <input
                  type="date"
                  value={job.dropoff || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVal('dropoff', v);
                    setErrors((prev) => {
                      if (!prev.dropoff) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.dropoff;
                      else n.dropoff = 'Drop-off Date is required';
                      return n;
                    });
                  }}
                  className={errors.dropoff ? 'err' : ''}
                  data-err="dropoff"
                  disabled={locked}
                />
                {errors.dropoff ? <div className="errText">{errors.dropoff}</div> : null}
              </div>

              <div className="c4">
                <label>Deer Sex</label>
                <select
                  value={job.sex || ''}
                  onChange={(e) => {
                    const v = e.target.value as Job['sex'];
                    setVal('sex', v);
                    setErrors((prev) => {
                      if (!prev.sex) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.sex;
                      else n.sex = 'Deer Sex is required';
                      return n;
                    });
                  }}
                  className={errors.sex ? 'err' : ''}
                  data-err="sex"
                  disabled={locked}
                >
                  <option value="">—</option>
                  <option value="Buck">Buck</option>
                  <option value="Doe">Doe</option>
                  <option value="Antlerless">Antlerless</option>
                </select>
                {errors.sex ? <div className="errText">{errors.sex}</div> : null}
              </div>

              <div className="c4">
                <label>How Killed</label>
                <select
                  value={job.howKilled || ''}
                  onChange={(e) => {
                    const v = e.target.value as Job['howKilled'];
                    setVal('howKilled', v);
                    setErrors((prev) => {
                      if (!prev.howKilled) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.howKilled;
                      else n.howKilled = 'How Killed is required';
                      return n;
                    });
                  }}
                  className={errors.howKilled ? 'err' : ''}
                  data-err="howKilled"
                  disabled={locked}
                >
                  <option value="">—</option>
                  <option value="Gun">Gun</option>
                  <option value="Archery">Archery</option>
                  <option value="Vehicle">Vehicle</option>
                </select>
                {errors.howKilled ? <div className="errText">{errors.howKilled}</div> : null}
              </div>

              <div className="c4">
                <label>Process Type</label>
                <Hint>Select Standard for normal processing of Doe or Buck you do not want skull.</Hint>
                <select
                  value={job.processType || ''}
                  onChange={(e) => {
                    const v = e.target.value as Job['processType'];
                    setVal('processType', v);
                    setErrors((prev) => {
                      if (!prev.processType) return prev;
                      const n = { ...prev };
                      if (String(v || '').trim()) delete n.processType;
                      else n.processType = 'Process Type is required';
                      return n;
                    });
                  }}
                  className={errors.processType ? 'err' : ''}
                  data-err="processType"
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
                {errors.processType ? <div className="errText">{errors.processType}</div> : null}
              </div>
            </div>
          </section>
        )}

        {/* Step: Cuts */}
        {step.key === 'cuts' && (
          <>
            <section>
              <h3>Cuts</h3>
              <div className="grid">
                <div className="c6">
                  <label>Hind Quarter</label>
                  <Hint>Pick how you want the rear leg processed. Grind refers to burger meat.</Hint>
                  <div className="checks">
                    <label className="chk">
                      <input type="checkbox" checked={!!job.hind?.['Hind - Steak']} onChange={() => setHind('Hind - Steak')} disabled={locked} />
                      <span>Steak</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.hind?.['Hind - Roast']} onChange={() => setHind('Hind - Roast')} disabled={locked} />
                      <span>Roast</span>
                    </label>
                    <span className="count">
                      <span className="muted"># of Roast</span>
                      <input
                        className="countInp"
                        value={!!job.hind?.['Hind - Roast'] ? (job.hindRoastCount || '') : ''}
                        onChange={(e) => setVal('hindRoastCount', e.target.value)}
                        disabled={!job.hind?.['Hind - Roast'] || locked}
                        inputMode="numeric"
                      />
                    </span>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.hind?.['Hind - Grind']} onChange={() => setHind('Hind - Grind')} disabled={locked} />
                      <span>Grind</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.hind?.['Hind - None']} onChange={() => setHind('Hind - None')} disabled={locked} />
                      <span>None</span>
                    </label>
                  </div>
                </div>

                <div className="c6">
                  <label>Front Shoulder</label>
                  <Hint>Pick how you want the front shoulder processed. Grind refers to burger meat.</Hint>
                  <div className="checks">
                    <label className="chk">
                      <input type="checkbox" checked={!!job.front?.['Front - Steak']} onChange={() => setFront('Front - Steak')} disabled={locked} />
                      <span>Steak</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.front?.['Front - Roast']} onChange={() => setFront('Front - Roast')} disabled={locked} />
                      <span>Roast</span>
                    </label>
                    <span className="count">
                      <span className="muted"># of Roast</span>
                      <input
                        className="countInp"
                        value={!!job.front?.['Front - Roast'] ? (job.frontRoastCount || '') : ''}
                        onChange={(e) => setVal('frontRoastCount', e.target.value)}
                        disabled={!job.front?.['Front - Roast'] || locked}
                        inputMode="numeric"
                      />
                    </span>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.front?.['Front - Grind']} onChange={() => setFront('Front - Grind')} disabled={locked} />
                      <span>Grind</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.front?.['Front - None']} onChange={() => setFront('Front - None')} disabled={locked} />
                      <span>None</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3>Packaging & Add-ons</h3>
              <div className="pkgGrid">
                <div className="pkg steak">
                  <label>Steak Size</label>
                  <select value={job.steak || ''} onChange={(e) => setVal('steak', e.target.value)} disabled={locked}>
                    <option value="">—</option>
                    <option>1/2"</option>
                    <option>3/4"</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="pkg steakOther">
                  <label>Steak Size (Other)</label>
                  <Hint>If you selected other, type the thickness you want.</Hint>
                  <input
                    value={job.steak === 'Other' ? (job.steakOther || '') : ''}
                    onChange={(e) => setVal('steakOther', e.target.value)}
                    disabled={job.steak !== 'Other' || locked}
                    placeholder={'e.g., 5/8"'}
                  />
                </div>

                <div className="pkg steaksPer">
                  <label>Steaks per Package</label>
                  <select value={job.steaksPerPackage || ''} onChange={(e) => setVal('steaksPerPackage', e.target.value)} disabled={locked}>
                    <option value="">—</option>
                    <option>4</option>
                    <option>6</option>
                    <option>8</option>
                  </select>
                </div>

                <div className="pkg burgerSize">
                  <label>Burger Size</label>
                  <select value={job.burgerSize || ''} onChange={(e) => setVal('burgerSize', e.target.value)} disabled={locked}>
                    <option value="">—</option>
                    <option>1 lb</option>
                    <option>2 lb</option>
                  </select>
                </div>

                <div className="pkg beefFat">
                  <label className="chk tight pkg-beef">
                    <Hint>Beef Fat added to Burger Meat</Hint>
                    <input type="checkbox" checked={!!job.beefFat} onChange={(e) => setVal('beefFat', e.target.checked)} disabled={locked} />
                    <span>Beef fat</span>
                    <span className="muted"> (+$5)</span>
                  </label>
                </div>
              </div>
            </section>

            <section>
              <h3>Backstrap</h3>
              <div className="grid">
                <div className="c4">
                  <label>Prep</label>
                  <select value={job.backstrapPrep || ''} onChange={(e) => setVal('backstrapPrep', e.target.value as any)} disabled={locked}>
                    <option value="">—</option>
                    <option>Whole</option>
                    <option>Sliced</option>
                    <option>Butterflied</option>
                  </select>
                </div>

                <div className="c4">
                  <label>Thickness</label>
                  <Hint>Only needed if Sliced/Butterflied.</Hint>
                  <select
                    value={job.backstrapPrep === 'Whole' ? '' : (job.backstrapThickness || '')}
                    onChange={(e) => setVal('backstrapThickness', e.target.value as any)}
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
                  <Hint>If you selected Other, type it here.</Hint>
                  <input
                    value={job.backstrapPrep !== 'Whole' && job.backstrapThickness === 'Other' ? (job.backstrapThicknessOther || '') : ''}
                    onChange={(e) => setVal('backstrapThicknessOther', e.target.value)}
                    disabled={!(job.backstrapPrep !== 'Whole' && job.backstrapThickness === 'Other') || locked}
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* Step: Extras */}
        {step.key === 'extras' && (
          <>
            <section>
              <h3>McAfee Specialty Products</h3>
              <div className="grid">
                <div className="c3 rowInline">
                  <label className="chk tight pkg-beef">
                    <input
                      type="checkbox"
                      checked={!!job.specialtyProducts}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVal('specialtyProducts', checked);
                        if (checked) setSpecialtyModalOpen(true);
                      }}
                      disabled={locked}
                    />
                    <span><strong>Would like specialty products</strong></span>
                  </label>
                </div>
                {job.specialtyProducts ? (
                  <div className="c12">
                    <div className="webbsSummaryCard">
                      <div className="webbsSummaryHead">
                        <div>
                          <div className="webbsSummaryTitle">Specialty Order</div>
                          <div className="muted" style={{ fontSize: 13 }}>{specialtySummaryText}</div>
                        </div>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                          <span className="badge">Products: {specialtyItems.length || 0}</span>
                          <span className="badge">Total lbs: {specialtyItems.reduce((sum, item) => sum + item.pounds, 0) || 0}</span>
                        </div>
                      </div>
                      {specialtyItems.length > 0 ? (
                        <div className="webbsSummaryList">
                          {specialtyItems.map((item) => (
                            <div key={item.key} className="webbsSummaryLine">
                              {item.label.replace(' (lb)', '')}: {item.pounds} lb
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="muted" style={{ fontSize: 13 }}>No specialty items entered yet.</div>
                      )}
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn secondary" onClick={() => setSpecialtyModalOpen(true)} disabled={locked}>
                          Fill Out Specialty Order
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <h3>Notes</h3>
              <Hint>If there is anything we haven't covered, write it here (be specific).</Hint>
              <textarea rows={3} value={job.notes || ''} onChange={(e) => setVal('notes', e.target.value)} disabled={locked} />
            </section>

            <section>
              <h3>Webbs</h3>
              <div className="grid">
                <div className="c3 rowInline">
                  <label className="chk tight pkg-beef">
                    <input
                      type="checkbox"
                      checked={!!job.webbsOrder}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVal('webbsOrder', e.target.checked);
                        if (checked) setWebbsModalOpen(true);
                      }}
                      disabled={locked}
                    />
                    <span><strong>Webbs Order</strong></span>
                    <span className="muted"> (+$20 fee)</span>
                  </label>
                </div>

                {job.webbsOrder && (
                  <>
                    <div className="c12">
                      <label>Estimated Webbs Pounds (lb)</label>
                      <Hint>Tell us how many pounds you want to send to Webbs. Fill out the Webbs order below so we know what products you want.</Hint>
                      <input
                        inputMode="numeric"
                        value={job.webbsPounds || ''}
                        onChange={(e) => setVal('webbsPounds', e.target.value)}
                        className={errors.webbsPounds ? 'err' : ''}
                        data-err="webbsPounds"
                        disabled={locked}
                      />
                      {errors.webbsPounds ? <div className="errText">{errors.webbsPounds}</div> : null}
                    </div>

                    <div className="c12">
                      <div className="webbsSummaryCard">
                        <div className="webbsSummaryHead">
                          <div>
                            <div className="webbsSummaryTitle">Webbs Order</div>
                            <div className="muted" style={{ fontSize: 13 }}>{webbsSummaryText}</div>
                          </div>
                          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                            <span className="badge">Entered lbs: {toInt(job.webbsPounds) || 0}</span>
                            <span className="badge">Detailed lbs: {webbsItemTotal || 0}</span>
                          </div>
                        </div>
                        {webbsItemLines.length > 0 ? (
                          <div className="webbsSummaryList">
                            {webbsItemLines.slice(0, 6).map((line) => (
                              <div key={line} className="webbsSummaryLine">{line}</div>
                            ))}
                            {webbsItemLines.length > 6 ? <div className="webbsSummaryMore">+{webbsItemLines.length - 6} more items</div> : null}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 13 }}>No Webbs items entered yet.</div>
                        )}
                        {errors.webbsItems ? <div className="errText" data-err="webbsItems" style={{ marginTop: 12 }}>{errors.webbsItems}</div> : null}
                        <div style={{ marginTop: 12 }}>
                          <button type="button" className="btn secondary" onClick={() => setWebbsModalOpen(true)} disabled={locked}>
                            Fill Out Webbs Order
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section>
              <h3>Communication Preference & Consent</h3>
              <div className="grid">
                <div className="c6">
                  <label>Preferred Contact Methods</label>
                  <div className="checks">
                    <label className="chk">
                      <input type="checkbox" checked={!!job.prefEmail} onChange={(e) => setVal('prefEmail', e.target.checked)} disabled={locked} />
                      <span>Email</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.prefSMS} onChange={(e) => setVal('prefSMS', e.target.checked)} disabled={locked} />
                      <span>Text (SMS)</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.prefCall} onChange={(e) => setVal('prefCall', e.target.checked)} disabled={locked} />
                      <span>Phone Call</span>
                    </label>
                  </div>
                </div>

                <div className="c6">
                  <label>Legal Consent</label>
                  <div className="checks">
                    <label className="chk">
                      <input type="checkbox" checked={!!job.smsConsent} onChange={(e) => setVal('smsConsent', e.target.checked)} disabled={locked} />
                      <span>I consent to receive informational/automated SMS</span>
                    </label>
                    <label className="chk">
                      <input type="checkbox" checked={!!job.autoCallConsent} onChange={(e) => setVal('autoCallConsent', e.target.checked)} disabled={locked} />
                      <span>I consent to receive automated phone calls</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Step: Review */}
        {step.key === 'review' && (
          <section>
            <h3>Review</h3>
            <Hint>Double-check everything below. If it looks right, submit.</Hint>
            <div style={{ marginTop: 12 }}>
              <PrintSheet job={job as any} />
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="actions">
          <div className="statusWrap">
            <div className={`status ${msg.startsWith('Save') || msg.startsWith('Saved') ? 'ok' : msg ? 'err' : ''}`}>{msg}</div>
            {!locked ? (
              <div className="statusHint">
                {requiredDone
                  ? `Step ${stepIdx + 1} is ready`
                  : `${currentStepMissing.length} required item${currentStepMissing.length === 1 ? '' : 's'} still missing`}
              </div>
            ) : null}
          </div>

          <button className="btn secondary" onClick={goBack} disabled={busy || locked || stepIdx === 0}>
            Back
          </button>

          {step.key === 'review' ? (
            <button className="btn" onClick={onSave} disabled={busy || locked}>
              {busy ? 'Saving…' : locked ? 'Saved' : 'Submit'}
            </button>
          ) : (
            <button className="btn" onClick={goNext} disabled={busy || locked}>
              Next
            </button>
          )}
        </div>
      </div>

      <div className="print-only">
        <PrintSheet job={job} />
      </div>

      {specialtyModalOpen && job.specialtyProducts && !locked ? (
        <div className="modal" onClick={() => setSpecialtyModalOpen(false)}>
          <div className="modal-card webbsModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="webbsModalHead">
              <div>
                <div className="modalKicker">McAfee Specialty</div>
                <h3>Fill Out Your Specialty Order</h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  Enter how many pounds you want for each specialty item. Leave a box blank if you do not want that item.
                </div>
              </div>
              <button className="btn secondary" type="button" onClick={() => setSpecialtyModalOpen(false)}>
                Done
              </button>
            </div>

            <div className="webbsModalBody">
              <div>
                <div className="webbsGroupTitle">Summer Sausage</div>
                <div className="webbsWorksheet">
                  <div className="webbsWorksheetHead">
                    <div>Product</div>
                    <div>Lb</div>
                  </div>
                  {SPECIALTY_ITEMS.filter((item) => item.category === 'summer').map((item) => (
                    <div key={item.key} className="webbsWorksheetRow">
                      <div className="webbsWorksheetLabel">{item.label.replace(' (lb)', '')}</div>
                      <div>
                        <input
                          inputMode="numeric"
                          value={String((job as any)[item.key] ?? '')}
                          onChange={(e) => setVal(item.key as keyof Job, e.target.value as any)}
                          placeholder="lb"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="webbsGroupTitle">Snack Stix</div>
                <div className="webbsWorksheet">
                  <div className="webbsWorksheetHead">
                    <div>Product</div>
                    <div>Lb</div>
                  </div>
                  {SPECIALTY_ITEMS.filter((item) => item.category === 'snack').map((item) => (
                    <div key={item.key} className="webbsWorksheetRow">
                      <div className="webbsWorksheetLabel">{item.label.replace(' (lb)', '')}</div>
                      <div>
                        <input
                          inputMode="numeric"
                          value={String((job as any)[item.key] ?? '')}
                          onChange={(e) => setVal(item.key as keyof Job, e.target.value as any)}
                          placeholder="lb"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {webbsModalOpen && job.webbsOrder && !locked ? (
        <div className="modal" onClick={() => setWebbsModalOpen(false)}>
          <div className="modal-card webbsModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="webbsModalHead">
              <div>
                <div className="modalKicker">Webbs Order</div>
                <h3>Fill Out Your Webbs Order</h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  Enter how many pounds you want for each item you want made. Leave a box blank if you do not want that item.
                </div>
              </div>
              <button className="btn secondary" type="button" onClick={() => setWebbsModalOpen(false)}>
                Done
              </button>
            </div>

            <div className="webbsModalBody">
              {WEBBS_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="webbsGroupTitle">{group.title}</div>
                  <div className="webbsWorksheet">
                    <div className="webbsWorksheetHead">
                      <div>Product</div>
                      <div>Lb going into product</div>
                    </div>
                    {group.items.map((item) => {
                      const selected = webbsItems.find((entry) => entry.key === item.key);
                      return (
                        <div key={item.key} className="webbsWorksheetRow">
                          <div className="webbsWorksheetLabel">{item.label}</div>
                          <div>
                            <input
                              inputMode="numeric"
                              value={selected?.pounds || ''}
                              onChange={(e) => setWebbsItemPounds(item.key, e.target.value)}
                              placeholder="lb"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Thank-you modal */}
      {showThanks && (
        <div className="modal">
          <div className="modal-card">
            <h3>Thank you!</h3>
            <p style={{ marginTop: 8 }}>
              Please leave a note with your Full Name, Phone Number, and the <b>last 5 digits</b> of your confirmation number
              {confirmationLast5 ? <> (<code>{confirmationLast5}</code>)</> : null}
              {' '}with your deer.
            </p>
            <p className="muted" style={{ marginTop: 8 }}>
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
        .form-card{
          max-width: 980px;
          margin: 18px auto;
          padding: 16px 18px;
          background: #fff;
          border: 1px solid #eef2f7;
          border-radius: 14px;
          box-shadow: 0 10px 28px rgba(0,0,0,.10);
        }

        h2 { margin: 8px 0; font-size: 32px; line-height: 1.05; }
        h3 { margin: 16px 0 8px; }
        section {
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid #e7eef9;
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        label { font-size: 12px; font-weight: 700; color: #0b0f12; display: block; margin-bottom: 4px; }
        input, select, textarea {
          width: 100%; padding: 10px 12px; border: 1px solid #d8e3f5; border-radius: 10px; background: #fbfdff; box-sizing: border-box;
        }
        textarea { resize: vertical; }
        input:disabled, select:disabled, textarea:disabled { background: #f3f4f6; color: #6b7280; }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
        }

        .grid { display: grid; gap: 10px; grid-template-columns: repeat(12, 1fr); }
        .c3{grid-column: span 3} .c4{grid-column: span 4} .c6{grid-column: span 6} .c8{grid-column: span 8}

        .rowInline { display: flex; align-items: center; padding-top: 22px; gap: 8px; }
        .checks { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .chk { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; min-width: 0; max-width: 100%; }
        .chk input[type="checkbox"], .chk input[type="radio"] { width: 18px; height: 18px; flex: 0 0 auto; }
        .chk span { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
        .count {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .countInp {
          width: 100%;
          max-width: 100%;
        }
        .muted { color: #6b7280; font-size: 12px; }
        .hero {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
          padding: 16px;
          border-radius: 18px;
          background: linear-gradient(135deg, #122217 0%, #22412d 100%);
          color: #f8fafc;
        }
        .hero p {
          margin: 8px 0 0;
          color: rgba(248, 250, 252, 0.86);
          line-height: 1.55;
          max-width: 60ch;
        }
        .hero-kicker {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-weight: 800;
          color: #b9ddc2;
        }
        .hero-card {
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 16px;
          background: rgba(255,255,255,.08);
          padding: 14px;
          align-self: stretch;
        }
        .hero-card-title {
          font-weight: 900;
          margin-bottom: 8px;
        }
        .hero-card ul {
          margin: 0;
          padding-left: 18px;
          line-height: 1.55;
          color: rgba(248, 250, 252, 0.9);
        }

        /* Wizard header */
        .wizardHead{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:12px;
          padding: 8px 0 12px;
          border-bottom: 1px solid #dce7df;
          margin-bottom: 10px;
        }
        .wizardLeft{ display:flex; flex-direction:column; gap:2px; }
        .wizardStep{ font-size:12px; color:#64748b; font-weight:700; }
        .wizardTitle{ font-size:16px; font-weight:900; color:#0b0f12; }
        .wizardRight { display:flex; align-items:center; }
        .stepState {
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          padding: 7px 12px;
          background:#eef8f0;
          color:#235532;
          border:1px solid #bfd2c2;
          font-size:12px;
          font-weight:800;
          text-align:center;
        }
        .stepState.good {
          background:#ecfdf5;
          color:#166534;
          border-color:#bbf7d0;
        }
        .stepChips {
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin: 0 0 10px;
        }
        .stepChip {
          border:1px solid #dce7df;
          border-radius:999px;
          background:#fff;
          color:#334155;
          font-weight:800;
          padding:8px 12px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          cursor:pointer;
        }
        .stepChip:disabled {
          opacity:.65;
          cursor:not-allowed;
        }
        .stepChip.current {
          background:#eef8f0;
          color:#235532;
          border-color:#bfd2c2;
        }
        .stepChip.done {
          background:#ecfdf5;
          color:#166534;
          border-color:#bbf7d0;
        }
        .stepChipNum {
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:rgba(15,23,42,.08);
          font-size:12px;
        }
        .requiredBox {
          border:1px solid #fecaca;
          background:#fff7f7;
          color:#7f1d1d;
          border-radius:12px;
          padding:10px 12px;
          margin-bottom:10px;
        }
        .requiredTitle {
          font-size:12px;
          font-weight:900;
          margin-bottom:8px;
        }
        .requiredList {
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .requiredPill {
          display:inline-flex;
          align-items:center;
          padding:5px 10px;
          border-radius:999px;
          background:#fff;
          border:1px solid #fecaca;
          font-size:12px;
          font-weight:800;
        }

        .summary { position: sticky; top: 0; background: #f3f8f4; border: 1px solid #dce7df; border-radius: 10px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.06); z-index:5; }
        .summary .row { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); align-items: end; }
        .summary .row.small { margin-top: 6px; grid-template-columns: 1fr; }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #dce7df; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }

        .actions { position: sticky; bottom: 0; background:#fff; padding: 10px 0 calc(10px + env(safe-area-inset-bottom)); display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; border-top:1px solid #dce7df; }
        .btn { padding: 12px 14px; min-height: 46px; border: 1px solid #235532; border-radius: 10px; background: #2f6f3f; color: #fff; font-weight: 800; cursor: pointer; }
        .btn.secondary{ background:#f3f8f4; color:#173321; border-color:#bfd2c2; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .statusWrap { margin-right:auto; display:grid; gap:2px; }
        .status { min-height: 20px; font-size: 12px; color: #334155; }
        .statusHint { font-size: 12px; color: #64748b; font-weight: 700; }
        .status.ok { color: #065f46; }
        .status.err { color: #b91c1c; }

        .err{ border-color:#ef4444 !important; background:#fff1f2; }
        .errText{ color:#b91c1c; font-size:12px; margin-top:4px; font-weight:700; }
        .webbsSummaryCard { border:1px solid #dbe3ea; border-radius:16px; padding:16px; background:#f8fafc; }
        .webbsSummaryHead { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
        .webbsSummaryTitle { font-weight:800; color:#0f172a; }
        .webbsSummaryList { margin-top:12px; display:grid; gap:6px; }
        .webbsSummaryLine { font-size:13px; color:#334155; }
        .webbsSummaryMore { font-size:13px; font-weight:700; color:#475569; }
        .webbsModalCard {
          width: min(980px, 100%);
          max-width: 980px;
          max-height: min(88vh, 920px);
          overflow: auto;
          padding: 18px;
        }
        .webbsModalHead {
          display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:14px;
          position: sticky; top: -18px; z-index: 2; background: #fff; padding: 2px 0 12px;
        }
        .modalKicker { font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.06em; }
        .webbsModalBody { display:grid; gap:16px; min-width:0; }
        .webbsGroupTitle { font-weight:800; color:#0f172a; margin-bottom:8px; }
        .webbsWorksheet { border:1px solid #d7dee7; border-radius:14px; overflow:hidden; background:#fff; }
        .webbsWorksheetHead,
        .webbsWorksheetRow { display:grid; grid-template-columns:minmax(0,1fr) 140px; gap:10px; align-items:center; }
        .webbsWorksheetHead { padding:10px 12px; background:#f8fafc; font-size:12px; font-weight:800; color:#475569; border-bottom:1px solid #d7dee7; }
        .webbsWorksheetRow { padding:8px 12px; border-top:1px solid #eef2f7; }
        .webbsWorksheetRow:first-of-type { border-top:0; }
        .webbsWorksheetLabel { font-size:13px; font-weight:700; color:#0f172a; }

        .print-only { display: none; }
        @media print { .screen-only { display: none !important; } .print-only { display: block !important; } }

        @media (max-width: 900px) {
          .summary .row { grid-template-columns: 1fr; }
          .summary .row.small { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .hero {
            grid-template-columns: 1fr;
            padding: 14px;
          }
          .form-card {
            margin: 0;
            padding: 12px;
            border-radius: 0;
            box-shadow: none;
            border-left: none;
            border-right: none;
          }
          h2 {
            font-size: 28px;
          }
          section {
            padding: 12px;
            border-radius: 14px;
          }
          .grid { grid-template-columns: 1fr; gap: 12px; }
          .c3, .c4, .c6, .c8 { grid-column: span 1; }
          .rowInline { padding-top: 0; align-items: flex-start; }
          .summary .checks { gap: 8px; }
          .wizardHead{ align-items:flex-start; }
          .wizardRight { width: 100%; }
          .stepState { width: 100%; justify-content: center; }
          .stepChips {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }
          .stepChips::-webkit-scrollbar {
            display: none;
          }
          .stepChip {
            white-space: nowrap;
          }
          .summary {
            position: static !important;
            padding: 10px;
          }
          .summary .price .money,
          .summary .total .money.total {
            text-align: left;
            font-size: 18px;
          }
          .checks {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .chk {
            width: 100%;
            max-width: 100%;
            display: grid;
            grid-template-columns: 18px minmax(0, 1fr);
            column-gap: 10px;
            row-gap: 4px;
            align-items: flex-start;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid #d8e3f5;
            background: #fbfdff;
          }
          .chk input[type="checkbox"],
          .chk input[type="radio"] {
            grid-column: 1;
            grid-row: 1;
            margin-top: 2px;
          }
          .chk > span {
            grid-column: 2;
          }
          .rowInline,
          .requiredList,
          .wizardHead,
          .hero,
          section,
          .grid,
          .pkgGrid,
          .summary {
            min-width: 0;
          }
          .grid > *,
          .pkgGrid > * {
            min-width: 0;
          }
          .pkgGrid .pkg-beef,
          .pkgGrid .pkg-beef span {
            white-space: normal;
          }
          .count {
            width: 100%;
          }
          .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding-top: 12px;
          }
          .statusWrap {
            grid-column: 1 / -1;
          }
          .btn {
            width: 100%;
          }
          .webbsModalCard {
            max-height: calc(100vh - 20px);
            padding: 14px;
          }
          .webbsWorksheetHead,
          .webbsWorksheetRow { grid-template-columns:minmax(0,1fr) 96px; }
          .webbsModalHead {
            display:grid; gap:10px;
            top: -14px;
          }
        }
        /* Packaging layout */
        .pkgGrid { display: grid; gap: 16px; }
        @media (min-width: 960px) {
          .pkgGrid {
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-areas:
              "steak steakOther steaksPer"
              "burger beef beef";
            align-items: end;
          }
        }
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
        .pkgGrid .beefFat    { grid-area: beef; display: flex; align-items: center; justify-content:flex-start; }
        .pkgGrid select, .pkgGrid input { width: 100%; min-width: 0; }
        .pkgGrid .pkg-beef { white-space: nowrap; }
        .pkgGrid .pkg-beef span { white-space: nowrap; }

        /* Modal */
        .modal {
          position: fixed; inset: 0; background: rgba(11, 15, 18, 0.6);
          display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 9999;
          overflow-y: auto;
        }
        .modal-card {
          width: 100%; max-width: 520px; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 12px 30px rgba(0,0,0,.25);
        }
        .modal-card h3 { margin: 4px 0 0; }
        .modal-card code { background: #f3f4f6; padding: 0 6px; border-radius: 4px; }
        .btn.wide { width: 100%; margin-top: 12px; }

        @media (max-width: 720px) {
          .summary { position: static !important; top: auto !important; box-shadow: none; z-index: auto; }
        }
        @media (orientation: landscape) and (max-height: 520px) {
          .summary { position: static !important; top: auto !important; box-shadow: none; }
          html, body { height: auto !important; overflow: auto !important; }
          .page, .wrap, .container, .content, .main { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .stickyHeading { position: static !important; top: auto !important; }
        }
      `}</style>
    </div>
  );
}
