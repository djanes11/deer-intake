'use client';

import { Fragment, useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveJob, getJob, tokenHeader } from '@/lib/api';
import PrintSheet from '@/app/components/PrintSheet';
import { lookupUniqueZipByCity } from '@/app/lib/cityZip';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { SPECIALTY_ITEMS, specialtyBreakdown, specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';
import { calcProcessingPrice, DEFAULT_SITE_PRICING, normalizePricing, normProc } from '@/lib/pricing';
import {
  WEBBS_GROUPS,
  type WebbsAllocationItem,
  type WebbsOrderItem,
  normalizeWebbsAllocations,
  normalizeWebbsOrderItems,
  normalizeWebbsOrderStyle,
  webbsAllocationSummary,
  webbsAllocationTotalPercent,
  webbsOrderSummary,
  webbsOrderTotalLbs,
} from '@/lib/webbs';

const API_MARK_PRINTED = '/api/v2/reports/mark-printed';
const API_CUSTOMER_LOOKUP = '/api/v2/customers/lookup';

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
  originalSummerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  jalapenoSummerSausageCheeseLbs?: string | number;
  originalSnackSticksLbs?: string | number;
  originalSnackSticksCheeseLbs?: string | number;
  jalapenoSnackSticksCheeseLbs?: string | number;
  specialtyPounds?: string;

  notes?: string;

  howKilled?: '' | 'Gun' | 'Archery' | 'Vehicle';

  webbsOrder?: boolean;
  webbsFormNumber?: string;
  webbsPounds?: string;
  webbsPaperFormCompleted?: boolean;
  webbsOrderStyle?: 'itemized_lbs' | 'whole_deer_percent';
  webbsItems?: WebbsOrderItem[];
  webbsAllocations?: WebbsAllocationItem[];

  price?: number | string; // optional override

  // Price overrides (leave null/blank to use auto)
  processing_price_override?: number | string | null;
  specialty_price_override?: number | string | null;

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
    originalSummerSausageLbs: String((j as any).originalSummerSausageLbs ?? ''),
    summerSausageCheeseLbs: String(j.summerSausageCheeseLbs ?? ''),
    jalapenoSummerSausageCheeseLbs: String((j as any).jalapenoSummerSausageCheeseLbs ?? ''),
    originalSnackSticksLbs: String((j as any).originalSnackSticksLbs ?? ''),
    originalSnackSticksCheeseLbs: String((j as any).originalSnackSticksCheeseLbs ?? ''),
    jalapenoSnackSticksCheeseLbs: String((j as any).jalapenoSnackSticksCheeseLbs ?? ''),
    specialtyPounds: j.specialtyPounds ?? '',

    notes: j.notes ?? '',

    webbsOrder: !!j.webbsOrder,
    webbsFormNumber: j.webbsFormNumber ?? (j as any).webbsOrderFormNumber ?? '',
    webbsPounds: j.webbsPounds ?? '',
    webbsPaperFormCompleted: !!(j as any).webbsPaperFormCompleted,
    webbsOrderStyle: normalizeWebbsOrderStyle((j as any).webbsOrderStyle),
    webbsItems: normalizeWebbsOrderItems(j.webbsItems),
    webbsAllocations: normalizeWebbsAllocations((j as any).webbsAllocations),

    processing_price_override: String((j as any).processing_price_override ?? ''),
    specialty_price_override: String((j as any).specialty_price_override ?? ''),

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

// ---- Input standardization helpers ----
const digitsOnly = (s: string) => String(s || '').replace(/\D+/g, '');
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

const toInt = (val: any) => {
  const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toMoneyOrNull = (v: any): number | null => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

type CustomerLookupMatch = {
  customer: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dropoff?: string | null;
  tag?: string;
  exact?: boolean;
};

async function markPrinted(tag: string) {
  const r = await fetch(API_MARK_PRINTED, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tokenHeader() },
    cache: 'no-store',
    body: JSON.stringify({ tag }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

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
  const router = useRouter();
  const sp = useSearchParams();
  const tagFromUrl = sp.get('tag') ?? '';

  const newBlankJob = (tag: string = ''): Job => ({
    tag,
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
    webbsOrderStyle: 'itemized_lbs',
    webbsItems: [],
    webbsAllocations: [],
    webbsPaperFormCompleted: false,

    processing_price_override: null,
    specialty_price_override: null,


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

  const [job, setJob] = useState<Job>(() => newBlankJob(tagFromUrl || ''));

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
  const [webbsModalOpen, setWebbsModalOpen] = useState(false);
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [pricing, setPricing] = useState(DEFAULT_SITE_PRICING);
  const [customerMatch, setCustomerMatch] = useState<CustomerLookupMatch | null>(null);
  const [customerMatches, setCustomerMatches] = useState<CustomerLookupMatch[]>([]);
  const [customerLookupBusy, setCustomerLookupBusy] = useState(false);
  const [customerLookupCollapsedFor, setCustomerLookupCollapsedFor] = useState('');

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

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setPricing(normalizePricing(j?.settings?.pricing ?? j?.settings));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const name = String(job.customer || '').trim();
    if (name.length < 3) {
      setCustomerMatch(null);
      setCustomerMatches([]);
      setCustomerLookupCollapsedFor('');
      return;
    }

    const t = window.setTimeout(async () => {
      try {
        setCustomerLookupBusy(true);
        const qs = new URLSearchParams({ name });
        const res = await fetch(`${API_CUSTOMER_LOOKUP}?${qs.toString()}`, {
          cache: 'no-store',
          headers: { ...tokenHeader() },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        const match = (j?.match || null) as CustomerLookupMatch | null;
        const matches = (Array.isArray(j?.matches) ? j.matches : []) as CustomerLookupMatch[];
        setCustomerMatch(match);
        setCustomerMatches(matches);

        if (match && matches.length === 1) {
          setJob((prev) => ({
            ...prev,
            phone: prev.phone || match.phone || '',
            email: prev.email || match.email || '',
            address: prev.address || match.address || '',
            city: prev.city || match.city || '',
            state: prev.state || (match.state as any) || '',
            zip: prev.zip || match.zip || '',
          }));
        }
      } catch {
        setCustomerMatch(null);
        setCustomerMatches([]);
      } finally {
        setCustomerLookupBusy(false);
      }
    }, 350);

    return () => window.clearTimeout(t);
  }, [job.customer]);

  const applyCustomerMatch = () => {
    if (!customerMatch) return;
    applyCustomerCandidate(customerMatch);
  };

  const applyCustomerCandidate = (match: CustomerLookupMatch) => {
    const currentName = String(job.customer || '').trim().toLowerCase();
    setJob((prev) => ({
      ...prev,
      phone: match.phone || prev.phone || '',
      email: match.email || prev.email || '',
      address: match.address || prev.address || '',
      city: match.city || prev.city || '',
      state: (match.state as any) || prev.state || '',
      zip: match.zip || prev.zip || '',
    }));
    setCustomerLookupCollapsedFor(currentName);
  };

  const customerLookupVisible =
    customerLookupCollapsedFor !== String(job.customer || '').trim().toLowerCase();

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
            webbsItems: [],
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
            webbsFormNumber: j.webbsFormNumber ?? (j as any).webbsOrderFormNumber ?? '',
            webbsOrderStyle: normalizeWebbsOrderStyle((j as any).webbsOrderStyle),
            webbsItems: normalizeWebbsOrderItems(j.webbsItems),
            webbsAllocations: normalizeWebbsAllocations((j as any).webbsAllocations),
            webbsPaperFormCompleted: !!(j as any).webbsPaperFormCompleted,
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

  const processingPriceAuto = useMemo(
    () => calcProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder, pricing),
    [job.processType, job.beefFat, job.webbsOrder, pricing]
  );

  const specialtyPriceAuto = useMemo(() => {
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

  const processingOverride = toMoneyOrNull((job as any).processing_price_override);
  const specialtyOverride = toMoneyOrNull((job as any).specialty_price_override);

  const processingPriceUsed = processingOverride ?? processingPriceAuto;
  const specialtyPriceUsed = specialtyOverride ?? specialtyPriceAuto;

  const totalPrice = processingPriceUsed + specialtyPriceUsed;
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
    if (specialtyPriceUsed) parts.push(`$${specialtyPriceUsed.toFixed(2)}`);
    return parts.length ? parts.join(' • ') : 'Specialty products selected';
  }, [job.specialtyProducts, specialtyItems, specialtyPriceUsed]);
  const webbsItems = useMemo(() => normalizeWebbsOrderItems(job.webbsItems), [job.webbsItems]);
  const webbsItemTotal = useMemo(() => webbsOrderTotalLbs(webbsItems), [webbsItems]);
  const webbsItemLines = useMemo(() => webbsOrderSummary(webbsItems), [webbsItems]);
  const webbsAllocations = useMemo(() => normalizeWebbsAllocations(job.webbsAllocations), [job.webbsAllocations]);
  const webbsAllocationTotal = useMemo(() => webbsAllocationTotalPercent(webbsAllocations), [webbsAllocations]);
  const webbsAllocationLines = useMemo(() => webbsAllocationSummary(webbsAllocations), [webbsAllocations]);
  const webbsOrderStyle = normalizeWebbsOrderStyle(job.webbsOrderStyle);
  const webbsAllocationOver = webbsOrderStyle === 'whole_deer_percent' && webbsAllocationTotal > 100;
  const webbsSummaryText = useMemo(() => {
    if (!job.webbsOrder) return 'No Webbs order';
    const parts: string[] = [];
    if ((job.webbsFormNumber || '').trim()) parts.push(`Form #${job.webbsFormNumber}`);
    if (toInt(job.webbsPounds)) parts.push(`${toInt(job.webbsPounds)} lb entered`);
    if (job.webbsPaperFormCompleted) parts.push('Paper form completed');
    if (webbsItems.length) parts.push(`${webbsItems.length} items`);
    if (webbsItemTotal) parts.push(`${webbsItemTotal} lb detailed`);
    return parts.length ? parts.join(' • ') : 'Webbs order selected';
  }, [job.webbsOrder, job.webbsFormNumber, job.webbsPounds, job.webbsPaperFormCompleted, webbsItems.length, webbsItemTotal]);
  const webbsStyleSummaryText = useMemo(() => {
    if (!job.webbsOrder) return 'No Webbs order';
    const parts: string[] = [];
    if ((job.webbsFormNumber || '').trim()) parts.push(`Form #${job.webbsFormNumber}`);
    if (webbsOrderStyle !== 'whole_deer_percent' && toInt(job.webbsPounds)) parts.push(`${toInt(job.webbsPounds)} lb entered`);
    if (job.webbsPaperFormCompleted) parts.push('Paper form completed');
    parts.push(webbsOrderStyle === 'whole_deer_percent' ? 'Whole deer by percentages' : 'Products by pounds');
    if (webbsOrderStyle === 'whole_deer_percent') {
      if (webbsAllocations.length) parts.push(`${webbsAllocations.length} products`);
      if (webbsAllocationTotal) parts.push(`${webbsAllocationTotal}% assigned`);
    } else {
      if (webbsItems.length) parts.push(`${webbsItems.length} items`);
      if (webbsItemTotal) parts.push(`${webbsItemTotal} lb detailed`);
    }
    return parts.join(' | ');
  }, [job.webbsOrder, job.webbsFormNumber, job.webbsPounds, job.webbsPaperFormCompleted, webbsOrderStyle, webbsAllocations.length, webbsAllocationTotal, webbsItems.length, webbsItemTotal]);

  const hindRoastOn = !!job.hind?.['Hind - Roast'];
  const frontRoastOn = !!job.front?.['Front - Roast'];
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
    setJob((prev) => {
      if (!asBool(prev.specialtyProducts)) {
        const next: Job = { ...prev, paidSpecialty: false, specialtyStatus: '', specialty_price_override: null };
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
    // Tag: required (numbers only)
    const tagDigits = digitsOnly(job.tag || '');
    if (!tagDigits) missing.push('Tag Number');
    // Confirmation: exactly 13 digits
    const conf13 = digitsOnly(job.confirmation || '');
    if (conf13.length !== 13) missing.push('Confirmation # (13 digits)');
    if (!job.customer) missing.push('Customer Name');
    // Phone: store as 10 digits
    const phone10 = digitsOnly(job.phone || '');
    if (phone10.length !== 10) missing.push('Phone (10 digits)');

    // Overrides: if provided, must be valid numbers (>= 0)
    const poRaw = String((job as any).processing_price_override ?? '').trim();
    if (poRaw) {
      const po = toMoneyOrNull(poRaw);
      if (po == null || po < 0) missing.push('Processing Override (valid $ amount)');
    }
    const soRaw = String((job as any).specialty_price_override ?? '').trim();
    if (soRaw) {
      const so = toMoneyOrNull(soRaw);
      if (so == null || so < 0) missing.push('Specialty Override (valid $ amount)');
    }
    if (job.prefEmail && !job.email) missing.push('Email');
    if (!job.address) missing.push('Address');
    if (!job.city) missing.push('City');
    if (!job.state) missing.push('State');
    if (!job.zip) missing.push('Zip');
    if (!job.county) missing.push('County Killed');
    if (!job.dropoff) missing.push('Drop-off Date');
    if (!job.sex) missing.push('Deer Sex');
    if (!job.processType) missing.push('Process Type');
    if (job.prefSMS && !job.smsConsent) missing.push('SMS Consent');
    if (hindRoastOn && !toInt(job.hindRoastCount)) missing.push('Hind Roast Count');
    if (frontRoastOn && !toInt(job.frontRoastCount)) missing.push('Front Roast Count');
    if (job.webbsOrder) {
      if (webbsOrderStyle === 'whole_deer_percent') {
        if (!webbsAllocations.length) missing.push('Webbs Percentages');
        if (webbsAllocationTotal !== 100) missing.push('Webbs Percentages Must Total 100%');
      } else {
        if (!toInt(job.webbsPounds)) missing.push('Webbs Pounds');
        if (!webbsItems.length) missing.push('Webbs Items');
      }
    }
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
      // enforce standardized values on save
      tag: digitsOnly(job.tag || ''),
      confirmation: clip(digitsOnly(job.confirmation || ''), 13),
      phone: clip(digitsOnly(job.phone || ''), 10),
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
      webbsFormNumber: job.webbsOrder ? (job.webbsFormNumber || '') : '',
      webbsPounds: job.webbsOrder
        ? webbsOrderStyle === 'whole_deer_percent'
          ? String(toInt(job.webbsPounds) || '')
          : String(toInt(job.webbsPounds) || webbsItemTotal || '')
        : '',
      webbsPaperFormCompleted: !!job.webbsOrder && !!job.webbsPaperFormCompleted,
      webbsOrderStyle: job.webbsOrder ? webbsOrderStyle : 'itemized_lbs',
      webbsItems: job.webbsOrder && webbsOrderStyle === 'itemized_lbs' ? webbsItems : [],
      webbsAllocations: job.webbsOrder && webbsOrderStyle === 'whole_deer_percent' ? webbsAllocations : [],

      specialtyStatus: job.specialtyProducts
        ? coerce(job.specialtyStatus, STATUS_SPECIALTY)
        : '',

      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty: job.specialtyProducts ? !!job.paidSpecialty : false,
      howKilled: job.howKilled || '',

      originalSummerSausageLbs: job.specialtyProducts ? String(toInt(job.originalSummerSausageLbs)) : '',
      summerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
      jalapenoSummerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.jalapenoSummerSausageCheeseLbs)) : '',
      originalSnackSticksLbs: job.specialtyProducts ? String(toInt(job.originalSnackSticksLbs)) : '',
      originalSnackSticksCheeseLbs: job.specialtyProducts ? String(toInt(job.originalSnackSticksCheeseLbs)) : '',
      jalapenoSnackSticksCheeseLbs: job.specialtyProducts ? String(toInt(job.jalapenoSnackSticksCheeseLbs)) : '',
      processing_price_override: toMoneyOrNull((job as any).processing_price_override),
      specialty_price_override: job.specialtyProducts ? toMoneyOrNull((job as any).specialty_price_override) : null,
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

      // Re-load after save (use the standardized tag from payload)
      if (payload.tag) {
        const fresh = await getJob(payload.tag);
if (fresh?.exists && fresh.job) {
  const j: any = fresh.job;

  const merged: Job = {
    ...job,
    ...j,
    confirmation:
      j.confirmation ?? j['Confirmation #'] ?? j['Confirmation'] ?? job.confirmation ?? '',
    webbsFormNumber: j.webbsFormNumber ?? (j as any).webbsOrderFormNumber ?? job.webbsFormNumber ?? '',
    webbsOrderStyle: normalizeWebbsOrderStyle((j as any).webbsOrderStyle),
    paidProcessing: !!(j.paidProcessing ?? j.PaidProcessing ?? j.Paid_Processing),
    paidSpecialty:  !!(j.paidSpecialty  ?? j.PaidSpecialty  ?? j.Paid_Specialty),

    prefEmail:  asBool(j.prefEmail),
    prefSMS:    asBool(j.prefSMS),
    prefCall:   asBool(j.prefCall),
    smsConsent: asBool(j.smsConsent),
    autoCallConsent: asBool(j.autoCallConsent),
    webbsItems: normalizeWebbsOrderItems(j.webbsItems),
    webbsAllocations: normalizeWebbsAllocations((j as any).webbsAllocations),
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

  const resetForNew = () => {
    const fresh = newBlankJob('');
    setJob(fresh);
    setZipDirty(false);
    setMsg('');
    setLastSavedJson(stableStringify(snapshotJob(fresh))); // not dirty after reset

    // Clear ?tag= in the URL so we don't accidentally reload an existing job
    try {
      router.replace('/intake');
    } catch {
      // ignore
    }

    // Put the cursor back on Tag Number for fast counter workflow
    requestAnimationFrame(() => tagRef.current?.focus());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setVal = <K extends keyof Job>(k: K, v: Job[K]) =>
    setJob((p) => {
      const next: Job = { ...p, [k]: v };

      if (k === 'processType' || k === 'beefFat' || k === 'webbsOrder') {
        next.processing_price_override = null;
      }

      if (k === 'webbsOrder') {
        if (!v) {
          next.webbsOrderStyle = 'itemized_lbs';
          next.webbsItems = [];
          next.webbsAllocations = [];
          next.webbsPounds = '';
          next.webbsFormNumber = '';
          next.webbsPaperFormCompleted = false;
        }
      }

      if (k === 'webbsOrderStyle') {
        if (v === 'whole_deer_percent') next.webbsItems = [];
        if (v === 'itemized_lbs') next.webbsAllocations = [];
      }

      if (
        k === 'specialtyProducts' ||
        k === 'originalSummerSausageLbs' ||
        k === 'summerSausageCheeseLbs' ||
        k === 'jalapenoSummerSausageCheeseLbs' ||
        k === 'originalSnackSticksLbs' ||
        k === 'originalSnackSticksCheeseLbs' ||
        k === 'jalapenoSnackSticksCheeseLbs'
      ) {
        next.specialty_price_override = null;
      }

      return next;
    });

  const setContactMethod = (method: 'email' | 'sms' | 'call') =>
    setJob((p) => ({
      ...p,
      prefEmail: method === 'email',
      prefSMS: method === 'sms',
      prefCall: method === 'call',
      smsConsent: method === 'sms' ? !!p.smsConsent : false,
      autoCallConsent: false,
    }));

  const setWebbsItemPounds = (key: string, value: string) => {
    setJob((prev) => {
      const existing = normalizeWebbsOrderItems(prev.webbsItems).filter((item) => item.key !== key);
      const pounds = toInt(value);
      if (pounds > 0) existing.push({ key, label: '', pounds });
      return { ...prev, webbsItems: existing };
    });
  };

  const setWebbsAllocationPercent = (key: string, value: string) => {
    setJob((prev) => {
      const existing = normalizeWebbsAllocations(prev.webbsAllocations).filter((item) => item.key !== key);
      const percent = toInt(value);
      if (percent > 0) existing.push({ key, label: '', percent });
      return { ...prev, webbsAllocations: existing };
    });
  };

  const setHind = (k: keyof Required<CutsBlock>) =>
    setJob((p) => {
      const nextValue = !(p.hind?.[k]);
      return {
        ...p,
        hind: { ...(p.hind || {}), [k]: nextValue },
        hindRoastCount: k === 'Hind - Roast' && !nextValue ? '' : p.hindRoastCount,
      };
    });

  const setFront = (k: keyof Required<CutsBlock>) =>
    setJob((p) => {
      const nextValue = !(p.front?.[k]);
      return {
        ...p,
        front: { ...(p.front || {}), [k]: nextValue },
        frontRoastCount: k === 'Front - Roast' && !nextValue ? '' : p.frontRoastCount,
      };
    });

  return (
    <div className="form-card">
      <div className="screen-only">
        <h2>Deer Intake</h2>

        <div className="summaryMini">
          {job.tag ? (
            <div className="miniChip">
              <span className="miniLabel">Tag</span>
              <span className="miniValue">{job.tag}</span>
            </div>
          ) : null}
          <div className="miniChip">
            <span className="miniLabel">Total</span>
            <span className="miniValue">${totalPrice.toFixed(2)}</span>
          </div>
          <div className={`miniChip ${fullPaid(job) ? 'ok' : 'warn'}`}>
            <span className="miniLabel">Paid</span>
            <span className="miniValue">{fullPaid(job) ? 'Paid in Full' : 'Unpaid'}</span>
          </div>
        </div>

        <div className="summary">
          <div className="row">
            <div className="col tagCol">
              <label>Tag Number</label>
              <input
                className="tagInput"
                ref={tagRef}
                value={job.tag || ''}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) => setVal('tag', digitsOnly(e.target.value))}
                placeholder="e.g. 1234"
              />
              <div className="muted" style={{ fontSize: 12 }}>Deer Tag</div>
            </div>

            <div className="col price">
              <label>Processing Price</label>
              <div className="money">{processingPriceUsed.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Proc. type + beef fat + Webbs fee</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Auto: {processingPriceAuto.toFixed(2)}{processingOverride != null ? ' • override active' : ''}
              </div>
              <input
                inputMode="decimal"
                placeholder="Override (optional)"
                value={((job as any).processing_price_override ?? '') as any}
                onChange={(e) => setVal('processing_price_override', e.target.value as any)}
              />
            </div>

            <div className="col price">
              <label>Specialty Price</label>
              <div className="money">{specialtyPriceUsed.toFixed(2)}</div>
              <div className="muted" style={{ fontSize: 12 }}>Based on specialty product selections</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Auto: {specialtyPriceAuto.toFixed(2)}{specialtyOverride != null ? ' • override active' : ''}
              </div>
              <input
                inputMode="decimal"
                placeholder={job.specialtyProducts ? 'Override (optional)' : 'Enable specialty first'}
                value={((job as any).specialty_price_override ?? '') as any}
                onChange={(e) => setVal('specialty_price_override', e.target.value as any)}
                disabled={!job.specialtyProducts}
              />
            </div>
          </div>

          <div className="row small">
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
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={13}
                onChange={(e) => setVal('confirmation', clip(digitsOnly(e.target.value), 13))}
              />
            </div>
            <div className="c6">
              <label>Customer Name</label>
              <input
                value={job.customer || ''}
                onChange={(e) => setVal('customer', e.target.value)}
              />
              {customerLookupBusy && customerLookupVisible ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Looking up previous customer info…</div>
              ) : customerLookupVisible && customerMatches.length > 1 ? (
                <div className="customerMatchList">
                  <div className="customerMatchTitle">Possible previous customers</div>
                  {customerMatches.slice(0, 4).map((match, idx) => (
                    <button
                      key={`${match.tag || 'no-tag'}:${match.dropoff || idx}`}
                      type="button"
                      className="customerMatchOption"
                      onClick={() => applyCustomerCandidate(match)}
                    >
                      <span>
                        <strong>{match.customer || 'Saved customer'}</strong>
                        {match.tag ? ` • tag ${match.tag}` : ''}
                        {match.dropoff ? ` • ${match.dropoff}` : ''}
                      </span>
                      <span>{[match.phone, match.city, match.state].filter(Boolean).join(' • ') || 'Use saved contact info'}</span>
                    </button>
                  ))}
                </div>
              ) : customerLookupVisible && customerMatch ? (
                <div className="customerMatch">
                  <div>
                    Previous intake found
                    {customerMatch.tag ? ` • tag ${customerMatch.tag}` : ''}
                    {customerMatch.dropoff ? ` • ${customerMatch.dropoff}` : ''}
                  </div>
                  <button type="button" className="miniFillBtn" onClick={applyCustomerMatch}>
                    Use Saved Info
                  </button>
                </div>
              ) : null}
            </div>
            <div className="c3">
              <label>Phone</label>
              <input
                value={job.phone || ''}
                inputMode="tel"
                pattern="[0-9]*"
                maxLength={10}
                onChange={(e) => setVal('phone', clip(digitsOnly(e.target.value), 10))}
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

          {customerMatches.length > 0 ? (
            <div className="historyPanel">
              <div className="historyPanelTitle">Recent customer history</div>
              <div className="historyPanelList">
                {customerMatches.slice(0, 4).map((match, idx) => (
                  <div key={`${match.tag || 'no-tag'}:${match.dropoff || idx}`} className="historyCard">
                    <div className="historyTop">
                      <div className="historyName">{match.customer || 'Saved customer'}</div>
                      <button type="button" className="miniFillBtn" onClick={() => applyCustomerCandidate(match)}>
                        Use This
                      </button>
                    </div>
                    <div className="historyMeta">
                      {[match.tag ? `Tag ${match.tag}` : '', match.dropoff || '', match.phone || '']
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                    <div className="historyMeta">
                      {[match.address, match.city, match.state, match.zip].filter(Boolean).join(', ') || 'No saved address'}
                    </div>
                    {match.email ? <div className="historyMeta">{match.email}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
                {hindRoastOn ? (
                  <span className="count">
                    <span className="muted">Count</span>
                    <input
                      className="countInp"
                      value={job.hindRoastCount || ''}
                      onChange={(e) => setVal('hindRoastCount', e.target.value)}
                      inputMode="numeric"
                    />
                  </span>
                ) : null}
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
                    checked={!!job.front?.['Front - Roast']}
                    onChange={() => setFront('Front - Roast')}
                  />
                  <span>Roast</span>
                </label>
                {frontRoastOn ? (
                  <span className="count">
                    <span className="muted">Count</span>
                    <input
                      className="countInp"
                      value={job.frontRoastCount || ''}
                      onChange={(e) => setVal('frontRoastCount', e.target.value)}
                      inputMode="numeric"
                    />
                  </span>
                ) : null}
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
            <div className="c4">
              <label>Steaks per Package</label>
              <select
                value={job.steaksPerPackage || ''}
                onChange={(e) => setVal('steaksPerPackage', e.target.value)}
              >
                <option value="">--</option>
                <option>4</option>
                <option>6</option>
                <option>8</option>
              </select>
            </div>
            <div className="c4">
              <label>Burger Size</label>
              <select
                value={job.burgerSize || ''}
                onChange={(e) => setVal('burgerSize', e.target.value)}
              >
                <option value="">--</option>
                <option>1 lb</option>
                <option>2 lb</option>
              </select>
            </div>
            <div className="c4 rowInline">
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
          </div>
        </section>

        {/* Backstrap */}
        <section>
          <h3>Backstrap</h3>
          <div className="grid">
            <div className="c12">
              <label>Prep</label>
              <select
                value={job.backstrapPrep || ''}
                onChange={(e) => setVal('backstrapPrep', e.target.value as Job['backstrapPrep'])}
              >
                <option value="">--</option>
                <option>Whole</option>
                <option>Sliced</option>
                <option>Butterflied</option>
              </select>
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setVal('specialtyProducts', checked);
                    if (checked) setSpecialtyModalOpen(true);
                  }}
                />
                <span><strong>Would like specialty products</strong></span>
              </label>
            </div>

            {job.specialtyProducts && (
              <div className="c9">
                <div className="webbsSummaryCard">
                  <div className="webbsSummaryHead">
                    <div>
                      <div className="webbsSummaryTitle">Specialty Order Summary</div>
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
                    <button type="button" className="btn secondaryBtn" onClick={() => setSpecialtyModalOpen(true)}>
                      Edit Specialty Order
                    </button>
                  </div>
                </div>
              </div>
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setVal('webbsOrder', checked);
                    if (checked) setWebbsModalOpen(true);
                  }}
                />
                <span><strong>Webbs Order</strong></span>
                <span className="muted"> (+$20 fee)</span>
              </label>
            </div>
            {job.webbsOrder && (
              <div className="c9">
                <div className="webbsSummaryCard">
                  <div className="webbsSummaryHead">
                    <div>
                      <div className="webbsSummaryTitle">Webbs Order Summary</div>
                      <div className="muted" style={{ fontSize: 13 }}>{webbsStyleSummaryText}</div>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {webbsOrderStyle !== 'whole_deer_percent' || toInt(job.webbsPounds) ? (
                        <span className="badge">
                          {webbsOrderStyle === 'whole_deer_percent'
                            ? `Optional lbs: ${toInt(job.webbsPounds) || 0}`
                            : `Entered lbs: ${toInt(job.webbsPounds) || 0}`}
                        </span>
                      ) : null}
                      {job.webbsPaperFormCompleted ? <span className="badge">Paper form done</span> : null}
                      <span className="badge">
                        {webbsOrderStyle === 'whole_deer_percent'
                          ? `Assigned: ${webbsAllocationTotal || 0}%`
                          : `Detailed lbs: ${webbsItemTotal || 0}`}
                      </span>
                    </div>
                  </div>
                  {webbsOrderStyle === 'whole_deer_percent' ? (
                    <div className="webbsSummaryList">
                      {webbsAllocationLines.slice(0, 6).map((line) => (
                        <div key={line} className="webbsSummaryLine">{line}</div>
                      ))}
                      {webbsAllocationLines.length > 6 ? (
                        <div className="webbsSummaryMore">+{webbsAllocationLines.length - 6} more items</div>
                      ) : null}
                    </div>
                  ) : webbsItemLines.length > 0 ? (
                    <div className="webbsSummaryList">
                      {webbsItemLines.slice(0, 6).map((line) => (
                        <div key={line} className="webbsSummaryLine">{line}</div>
                      ))}
                      {webbsItemLines.length > 6 ? (
                        <div className="webbsSummaryMore">+{webbsItemLines.length - 6} more items</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 13 }}>No detailed Webbs items entered yet.</div>
                  )}
                  {webbsAllocationOver ? (
                    <div className="errText" style={{ marginTop: 12 }}>
                      Webbs percentages are over 100%. Reduce them before saving.
                    </div>
                  ) : null}
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn secondaryBtn" onClick={() => setWebbsModalOpen(true)}>
                      Edit Webbs Order
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Communication & Consent */}
        <section>
          <h3>Communication & Consent</h3>
          <div className="grid">
            <div className="c12">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Preferred Contact Method</div>
              <div className="checks">
                <label className="chk">
                  <input
                    type="radio"
                    name="preferred-contact-staff"
                    checked={!!job.prefEmail}
                    onChange={() => setContactMethod('email')}
                  />
                  <span>Email</span>
                </label>
                <label className="chk">
                  <input
                    type="radio"
                    name="preferred-contact-staff"
                    checked={!!job.prefSMS}
                    onChange={() => setContactMethod('sms')}
                  />
                  <span>Text (SMS)</span>
                </label>
                <label className="chk">
                  <input
                    type="radio"
                    name="preferred-contact-staff"
                    checked={!!job.prefCall}
                    onChange={() => setContactMethod('call')}
                  />
                  <span>Phone Call</span>
                </label>
              </div>
            </div>

            {job.prefSMS ? (
              <div className="c12">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={!!job.smsConsent}
                    onChange={(e) => setVal('smsConsent', e.target.checked)}
                  />
                  <span>Consent to receive SMS texts</span>
                </label>
              </div>
            ) : null}

            <div className="c12 muted" style={{ fontSize: 13 }}>
              We will use the selected method only. Phone calls are always made by a person.
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
              const tagToPrint = digitsOnly(job.tag || '');
              if (!tagToPrint) {
                setMsg('Tag Number is required before printing');
                return;
              }
              try {
                await markPrinted(tagToPrint);
              } catch (e: any) {
                setMsg(e?.message || 'Could not mark intake sheet as printed');
                return;
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

          <button
            className="btn"
            type="button"
            onClick={async () => {
              const ok = await onSave();
              if (!ok) return;
              resetForNew();
            }}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save & New'}
          </button>
        </div>
      </div>

      <div className="print-only">
        <PrintSheet job={job} />
      </div>

      {specialtyModalOpen && job.specialtyProducts ? (
        <div className="modal" onClick={() => setSpecialtyModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalKicker">McAfee Specialty</div>
                <h3 style={{ margin: '4px 0 0' }}>Specialty Order</h3>
              </div>
              <button type="button" className="btn secondaryBtn" onClick={() => setSpecialtyModalOpen(false)}>
                Done
              </button>
            </div>

            <div className="webbsModalInfo">
              <span className="badge">Summer Sausage: ${pricing.summer_sausage_price_per_lb.toFixed(2)}/lb</span>
              <span className="badge">Snack Stix: ${pricing.snack_stix_price_per_lb.toFixed(2)}/lb</span>
              <span className="badge">Current Total: ${specialtyPriceUsed.toFixed(2)}</span>
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
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={String((job as any)[item.key] ?? '')}
                        onChange={(e) => setVal(item.key as keyof Job, e.target.value as any)}
                        placeholder="0"
                      />
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
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={String((job as any)[item.key] ?? '')}
                        onChange={(e) => setVal(item.key as keyof Job, e.target.value as any)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {webbsModalOpen && job.webbsOrder ? (
        <div className="modal" onClick={() => setWebbsModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalKicker">Webbs Order</div>
                <h3>Edit Webbs Order</h3>
              </div>
              <button type="button" className="iconBtn" onClick={() => setWebbsModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="webbsModalGrid">
              <div>
                <label>Webbs Order Form Number</label>
                <input
                  value={job.webbsFormNumber || ''}
                  onChange={(e) => setVal('webbsFormNumber', e.target.value)}
                />
              </div>
              <div>
                <label>{webbsOrderStyle === 'whole_deer_percent' ? 'Webbs Pounds (optional)' : 'Webbs Pounds (lb)'}</label>
                <input
                  inputMode="numeric"
                  value={job.webbsPounds || ''}
                  onChange={(e) => setVal('webbsPounds', e.target.value)}
                />
              </div>
            </div>

            <div className="webbsModalInfo">
              {webbsOrderStyle !== 'whole_deer_percent' || toInt(job.webbsPounds) ? (
                <span className="badge">
                  {webbsOrderStyle === 'whole_deer_percent'
                    ? `Optional lbs: ${toInt(job.webbsPounds) || 0}`
                    : `Estimated lbs: ${toInt(job.webbsPounds) || 0}`}
                </span>
              ) : null}
              <span className="badge">{job.webbsPaperFormCompleted ? 'Paper form done' : 'Paper form not marked'}</span>
              <span className="badge">
                {webbsOrderStyle === 'whole_deer_percent'
                  ? `Assigned: ${webbsAllocationTotal || 0}%`
                  : `Detailed lbs: ${webbsItemTotal || 0}`}
              </span>
            </div>

            {webbsAllocationOver ? (
              <div className="errText" style={{ marginBottom: 12 }}>
                Webbs percentages are over 100%. This order cannot be saved until the total is 100% or less.
              </div>
            ) : null}

            <label className="chk" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={!!job.webbsPaperFormCompleted}
                onChange={(e) => setVal('webbsPaperFormCompleted', e.target.checked)}
              />
              <span>Filled out on the paper form</span>
            </label>

            <div className="webbsModeSwitch" style={{ marginBottom: 12 }}>
              <label className="chk">
                <input
                  type="radio"
                  checked={webbsOrderStyle === 'itemized_lbs'}
                  onChange={() => setVal('webbsOrderStyle', 'itemized_lbs')}
                />
                <span>Choose products by pounds</span>
              </label>
              <label className="chk">
                <input
                  type="radio"
                  checked={webbsOrderStyle === 'whole_deer_percent'}
                  onChange={() => setVal('webbsOrderStyle', 'whole_deer_percent')}
                />
                <span>Send whole deer by percentages</span>
              </label>
            </div>

            <div className="webbsModalBody">
              {WEBBS_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="webbsGroupTitle">{group.title}</div>
                  <div className="webbsWorksheet">
                    <div className="webbsWorksheetHead">
                      <div>Product</div>
                      <div>{webbsOrderStyle === 'whole_deer_percent' ? 'Percent of deer' : 'Lb going into product'}</div>
                    </div>
                    {group.items.map((item) => {
                      const selected = webbsItems.find((entry) => entry.key === item.key);
                      const allocated = webbsAllocations.find((entry) => entry.key === item.key);
                      return (
                        <div key={item.key} className="webbsWorksheetRow">
                          <div className="webbsWorksheetLabel">{item.label}</div>
                          <div>
                            <input
                              inputMode="numeric"
                              value={webbsOrderStyle === 'whole_deer_percent' ? allocated?.percent || '' : selected?.pounds || ''}
                              onChange={(e) =>
                                webbsOrderStyle === 'whole_deer_percent'
                                  ? setWebbsAllocationPercent(item.key, e.target.value)
                                  : setWebbsItemPounds(item.key, e.target.value)
                              }
                              placeholder={webbsOrderStyle === 'whole_deer_percent' ? '%' : 'lb'}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="modalActions">
              <button type="button" className="btn secondaryBtn" onClick={() => setWebbsModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

        .summaryMini {
          position: sticky;
          top: 0;
          z-index: 8;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          padding: 8px 10px;
          margin-bottom: 10px;
          background: rgba(255,255,255,.96);
          border: 1px solid #d8e3f5;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,.06);
          backdrop-filter: blur(6px);
        }
        .miniChip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #f8fbff;
          border: 1px solid #d8e3f5;
          color: #132238;
          font-weight: 800;
        }
        .miniChip.ok {
          background: #ecfdf5;
          border-color: #86efac;
          color: #166534;
        }
        .miniChip.warn {
          background: #fff7db;
          border-color: #facc15;
          color: #854d0e;
        }
        .miniLabel {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .05em;
          opacity: 0.72;
        }
        .miniValue {
          font-size: 14px;
          font-weight: 900;
        }
        .summary { position: static; background: #f5f8ff; border: 1px solid #d8e3f5; border-radius: 10px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.06); z-index:5; }
        .summary .row { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); align-items: start; }
        .summary .row.small { margin-top: 6px; grid-template-columns: repeat(4, 1fr); }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .tagCol { justify-content: flex-start; }
        .summary .tagInput {
          min-height: 56px;
          font-size: 18px;
          font-weight: 800;
          border-width: 2px;
          background: #fff;
        }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #d8e3f5; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }

        .summary .pillrow { display: flex; gap: 10px; align-items: center; flex-wrap: nowrap; }
        .summary .pill { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 10px; border: 2px solid #eab308; background: #fff7db; border-radius: 999px; white-space: nowrap; cursor: pointer; user-select: none; }
        .summary .pill.on { border-color: #10b981; background: #ecfdf5; }
        .summary .pill > input[type="checkbox"] { width: 18px; height: 18px; margin: 0; appearance: auto; }
        .summary .badge { display: inline-block; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; line-height: 1.1; }

        .count { display: inline-flex; align-items: center; gap: 6px; }
        .countInp { width: 70px; text-align: center; }

        .actions { position: sticky; bottom: 0; background:#fff; padding: 10px 0; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; align-items: center; border-top:1px solid #dce7df; }
        .btn { padding: 8px 12px; border: 1px solid #235532; border-radius: 8px; background: #2f6f3f; color: #fff; font-weight: 800; cursor: pointer; }
        .secondaryBtn { background: #f3f8f4; color: #173321; border-color:#bfd2c2; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .status { min-height: 20px; font-size: 12px; color: #334155; margin-right:auto; }
        .status.ok { color: #065f46; }
        .status.err { color: #b91c1c; }
        .webbsSummaryCard { border: 1px solid #dbe3ea; border-radius: 16px; padding: 16px; background: #f8fafc; }
        .webbsSummaryHead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .webbsSummaryTitle { font-weight: 800; color: #0f172a; }
        .webbsSummaryList { margin-top: 12px; display: grid; gap: 6px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .webbsSummaryLine { font-size: 13px; color: #334155; }
        .webbsSummaryMore { font-size: 13px; font-weight: 700; color: #475569; }
        .customerMatch {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #bfd2c2;
          background: #eef8f0;
          color: #235532;
          font-size: 12px;
          font-weight: 700;
        }
        .customerMatchList {
          margin-top: 8px;
          display: grid;
          gap: 8px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid #bfd2c2;
          background: #f7fbf8;
        }
        .customerMatchTitle {
          font-size: 12px;
          font-weight: 800;
          color: #406c4d;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .customerMatchOption {
          display: grid;
          gap: 4px;
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #d6e6d8;
          background: #fff;
          color: #173321;
          cursor: pointer;
        }
        .customerMatchOption:hover {
          border-color: #89c096;
          background: #f3f8f4;
        }
        .customerMatchOption span:last-child {
          font-size: 12px;
          color: #567061;
          font-weight: 700;
        }
        .historyPanel {
          margin-top: 14px;
          border: 1px solid #dce7df;
          background: #f8fbf9;
          border-radius: 14px;
          padding: 12px;
        }
        .historyPanelTitle {
          font-size: 12px;
          font-weight: 900;
          color: #406c4d;
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 10px;
        }
        .historyPanelList {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .historyCard {
          border: 1px solid #d7e4d9;
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          display: grid;
          gap: 6px;
        }
        .historyTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .historyName {
          font-weight: 900;
          color: #173321;
        }
        .historyMeta {
          font-size: 12px;
          color: #567061;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        .miniFillBtn {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #235532;
          background: #2f6f3f;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }
        .modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
        .modalCard { width: min(1040px, 100%); max-height: 88vh; overflow: auto; background: #fff; border-radius: 18px; border: 1px solid #dce7df; box-shadow: 0 22px 60px rgba(15, 23, 42, 0.24); padding: 18px; }
        .modalHead { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
        .modalKicker { font-size: 12px; font-weight: 800; color: #4e6a58; text-transform: uppercase; letter-spacing: .06em; }
        .iconBtn { padding: 8px 12px; border-radius: 10px; border: 1px solid #bfd2c2; background: #f3f8f4; color: #173321; font-weight: 700; cursor: pointer; }
        .webbsModalGrid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; margin-bottom: 12px; }
        .webbsModalInfo { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .webbsModalBody { display: grid; gap: 16px; }
        .webbsGroupTitle { font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .webbsWorksheet { border: 1px solid #d7dee7; border-radius: 14px; overflow: hidden; background: #fff; }
        .webbsWorksheetHead,
        .webbsWorksheetRow { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 10px; align-items: center; }
        .webbsWorksheetHead { padding: 10px 12px; background: #f8fafc; font-size: 12px; font-weight: 800; color: #475569; border-bottom: 1px solid #d7dee7; }
        .webbsWorksheetRow { padding: 8px 12px; border-top: 1px solid #eef2f7; }
        .webbsWorksheetRow:first-of-type { border-top: 0; }
        .webbsWorksheetLabel { font-size: 13px; font-weight: 700; color: #0f172a; }
        .modalActions { display: flex; justify-content: flex-end; margin-top: 16px; }

        .print-only { display: none; }
        @media print { .screen-only { display: none !important; } .print-only { display: block !important; } }
        @media (max-width: 900px) { .summary .row.small { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 720px) {
          .summaryMini {
            padding: 8px;
          }
          .miniChip {
            flex: 1 1 140px;
            justify-content: space-between;
          }
          .grid { grid-template-columns: 1fr; }
          .summary .row { grid-template-columns: 1fr; }
          .summary .row.small { grid-template-columns: 1fr; }
          .rowInline { padding-top: 0; }
          .summary .pillrow { flex-wrap: wrap; }
          .webbsModalGrid { grid-template-columns: 1fr; }
          .webbsWorksheetHead,
          .webbsWorksheetRow { grid-template-columns: minmax(0, 1fr) 110px; }
          .modal { padding: 10px; }
          .modalCard { padding: 14px; max-height: 92vh; }
        }
      `}</style>
    </div>
  );
}
