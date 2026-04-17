// app/(public)/overnight/page.tsx
'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { Hint } from '@/app/intake/overnight/_ux_upgrades';
import { lookupUniqueZipByCity } from '@/app/lib/cityZip';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import type { PublicCopySettings } from '@/lib/siteSettings';
import {
  confirmationInputMode,
  identifierSettingsFromPublicCopy,
  normalizeConfirmationInput,
  validateConfirmation,
} from '@/lib/identifiers';
import { specialtyBreakdown, specialtyPrice as calcSpecialtyPrice } from '@/lib/specialty';
import { defaultSpecialtyCatalog, normalizeJobSpecialtyItems, normalizeSpecialtyCatalog, SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import { calcProcessingPrice, DEFAULT_SITE_PRICING, normalizePricing, normProc } from '@/lib/pricing';
import {
  AddOnCatalogItem,
  ProcessTypeCatalogItem,
  calcCatalogProcessingPrice,
  defaultAddOnCatalog,
  defaultProcessCatalog,
  deriveSelectedAddOnItems,
  filterVisibleAddOnItems,
  normalizeAddOnCatalog,
  normalizeJobAddOnItems,
  normalizeProcessCatalog,
} from '@/lib/processorCatalog';
import { StateFormType } from '@/lib/stateforms/types';
import {
  WEBBS_GROUPS,
  type WebbsAllocationItem,
  type WebbsOrderItem,
  normalizeWebbsAllocations,
  normalizeWebbsOrderItems,
  normalizeWebbsOrderStyle,
  webbsOrderStyleLabel,
  webbsAllocationSummary,
  webbsAllocationTotalPercent,
  webbsPrimarySummary,
  webbsOrderSummary,
  webbsOrderTotalLbs,
} from '@/lib/webbs';

export const dynamic = 'force-dynamic';

const WEBBS_PRICE_SHEET_URL = '/webbs-price.pdf';

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
  huntingLicenseNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  county?: string;
  dropoff?: string; // yyyy-mm-dd
  sex?: '' | 'Buck' | 'Doe' | 'Antlerless';
  howKilled?: '' | 'Gun' | 'Archery' | 'Vehicle';
  processType?: string;
  processTypeSlug?: string | null;
  processTypeRequiresCape?: boolean | null;

  status?: string;       // hidden in UI
  capingStatus?: string; // hidden in UI
  webbsStatus?: string;  // hidden in UI

  specialtyStatus?: '' | 'Dropped Off' | 'In Progress' | 'Finished' | 'Called' | 'Picked Up';

  steak?: string;
  steakOther?: string;
  burgerSize?: string;
  steaksPerPackage?: string;
  beefFat?: boolean;
  addOnItems?: Array<{
    slug: string;
    name: string;
    selected: boolean;
    price: number;
    sortOrder: number;
    legacyBooleanKey?: 'beefFat' | 'webbsOrder' | null;
  }>;

  hindRoastCount?: string;
  frontRoastCount?: string;

  hind?: CutsBlock;
  front?: CutsBlock;

  backstrapPrep?: '' | 'Whole' | 'Sliced' | 'Butterflied';
  backstrapThickness?: '' | '1/2"' | '3/4"' | 'Other';
  backstrapThicknessOther?: string;

  specialtyProducts?: boolean;
  specialtyItems?: Array<{
    id?: string | null;
    catalogId?: string | null;
    slug: string;
    name: string;
    shortName: string;
    unit: 'lb';
    priceType: 'per_lb';
    quantity: number;
    pricePerUnit: number;
    total: number;
    sortOrder: number;
    legacyFieldKey?: string | null;
  }>;
  originalSummerSausageLbs?: string | number;
  summerSausageCheeseLbs?: string | number;
  jalapenoSummerSausageCheeseLbs?: string | number;
  originalSnackSticksLbs?: string | number;
  originalSnackSticksCheeseLbs?: string | number;
  jalapenoSnackSticksCheeseLbs?: string | number;

  notes?: string;

  webbsOrder?: boolean;
  webbsPounds?: string;
  webbsOrderMode?: 'online';
  webbsOrderStyle?: 'itemized_lbs' | 'whole_deer_percent' | 'paper_form';
  webbsItems?: WebbsOrderItem[];
  webbsAllocations?: WebbsAllocationItem[];

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
  return ['true', 'yes', 'y', '1', 'on', 'paid', 'x'].includes(s);
};

const fullPaid = (j: Job): boolean => {
  const proc = !!j.paidProcessing;
  const needsSpec = asBool(j.specialtyProducts);
  const spec = needsSpec ? !!j.paidSpecialty : true;
  return proc && spec;
};

const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');
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
  webbsItems: 'Webbs Items',
};

/* ===== Suspense wrapper ===== */

export default function Page() {
  return (
    <Suspense fallback={<div className="form-card"><div style={{ padding: 16 }}>Loading...</div></div>}>
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
    addOnItems: [],
    webbsOrder: false,
    webbsOrderMode: 'online',
    webbsOrderStyle: 'itemized_lbs',
    webbsItems: [],
    webbsAllocations: [],
    Paid: false,
    paid: false,
    paidProcessing: false,
    paidSpecialty: false,
    specialtyProducts: false,
    specialtyItems: [],

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
  const [processCatalog, setProcessCatalog] = useState<ProcessTypeCatalogItem[]>(defaultProcessCatalog(DEFAULT_SITE_PRICING));
  const [addOnCatalog, setAddOnCatalog] = useState<AddOnCatalogItem[]>(defaultAddOnCatalog(DEFAULT_SITE_PRICING));
  const [specialtyCatalog, setSpecialtyCatalog] = useState<SpecialtyCatalogItem[]>(defaultSpecialtyCatalog(DEFAULT_SITE_PRICING));
  const [specialtyEnabled, setSpecialtyEnabled] = useState(true);
  const [cutOptions, setCutOptions] = useState(normalizeCutOptionSettings({}));
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [stateFormType, setStateFormType] = useState<StateFormType>('indiana');
  const [publicCopy, setPublicCopy] = useState<PublicCopySettings>({
    homeHeadline: 'Professional wild game processing, with a cleaner customer experience.',
    homeIntro: 'Submit your intake, choose your cuts, and check status online without guessing what happens next.',
    homeHowItWorks: [
      'Use the public intake form before or during drop-off so the shop has your information and cut selections right away.',
      'Include your state confirmation number and leave your deer with your name and phone details for easy matching.',
      'Staff assigns the permanent tag, reviews your order, and updates status as work moves forward.',
      'Check status online anytime and pick up promptly once you are notified.',
    ],
    pricingNote:
      'Final totals can vary with cut selections, specialty items, and processor-specific options. Customers can review their selections before submitting.',
    beforeDropoffChecklist: [
      'Have your state harvest/check-in confirmation number ready',
      'Leave your name, phone number, and confirmation details with the deer',
      'Staff will assign the permanent deer tag after reviewing the intake',
    ],
    intakeHighlights: [
      'Complete this before leaving your deer so the shop has your cuts and contact details right away.',
      'Staff will assign the permanent deer tag after reviewing the drop-off.',
    ],
    reviewChecklist: [
      'Customer name and state confirmation number match',
      'Drop-off details and process type are correct',
      'Cuts, specialty items, and contact preference look right',
    ],
    customerInfoIntro:
      'Fill in your state confirmation number, your name, and the best phone number to reach you. Then finish your address so staff can match your deer quickly.',
    confirmationLabel: 'Confirmation #',
    confirmationPlaceholder: 'State confirmation #',
    confirmationHelpText: 'Use the confirmation number from your state harvest/check-in system.',
    confirmationValidation: 'exact_13' as const,
    turnaroundEstimate:
      'Turnaround time depends on season volume and the cuts you choose. The shop will contact you when your order is ready.',
    acceptedPaymentMethods: ['cash', 'check', 'card'],
    callBeforePickup: false,
    storageFeeStartsAfterDays: 0,
    storageFeePolicy: '',
    pickupInstructions:
      'Leave a note with your full name, phone number, and the last 5 digits of your confirmation number attached to the deer.',
    thankYouMessage:
      'Save or screenshot this confirmation number before you close this page. You will need it to check your status until staff assign your deer tag.',
    statusIntro:
      'Use your confirmation number, or use your deer tag and last name after staff have assigned the real tag. This page updates as your order moves through the shop.',
    statusBestWay:
      'Confirmation number works best before staff assign the permanent tag. After the tag is assigned, you can also search with the tag number and customer last name.',
    statusLookupHelp:
      'Most customers should start with the confirmation number. Only use tag number + last name after staff have assigned the permanent tag.',
    confirmationSearchHelp:
      'Best for most customers. Use the number from your intake or state harvest/check-in.',
    tagLabel: 'Tag Number',
    tagPlaceholder: 'Deer tag number',
    tagFormat: 'digits_only' as const,
    tagMinLength: 5,
    startingTagNumber: '1000',
    tagSearchHelp: 'Only use this after staff have assigned the real deer tag.',
    faqItems: [
      {
        question: 'How do I use the Public Intake Form?',
        answer: 'Open the public intake form, fill in the steps from top to bottom, and save your confirmation number when you finish.',
      },
      {
        question: 'Where are you located?',
        answer: 'Use the address and map link on this site for directions to the shop.',
      },
      {
        question: 'How will I know my deer is ready?',
        answer: 'We will use the contact method you selected on your intake form for updates, and you can also check status online.',
      },
    ],
  });

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
  const showIntroGuidance = !showThanks && stepIdx === 0;
  const compactSummary = !showThanks && stepIdx > 0;
  const identifierSettings = useMemo(() => identifierSettingsFromPublicCopy(publicCopy), [publicCopy]);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setPricing(normalizePricing(j?.settings?.pricing ?? j?.settings));
          setProcessCatalog(normalizeProcessCatalog(j?.settings?.processCatalog, j?.settings));
          setAddOnCatalog(normalizeAddOnCatalog(j?.settings?.addOnCatalog, j?.settings));
          setSpecialtyEnabled(j?.settings?.features?.specialtyEnabled !== false);
          setSpecialtyCatalog(j?.settings?.features?.specialtyEnabled === false ? [] : normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, j?.settings));
          setCutOptions(normalizeCutOptionSettings(j?.settings?.cutOptions));
          setIntakeEnabled(!!j?.settings?.public_intake_enabled);
          setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
          setSmsEnabled(j?.settings?.features?.smsEnabled !== false);
          setStateFormType((j?.settings?.stateFormType as StateFormType) || 'indiana');
          setPublicCopy(j?.settings?.publicCopy || publicCopy);
          if (j?.settings?.banner_enabled && j?.settings?.banner_message) {
            setClosureMessage(String(j.settings.banner_message));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeProcessCatalog = useMemo(
    () => normalizeProcessCatalog(processCatalog, pricing).filter((item) => item.active),
    [processCatalog, pricing]
  );
  const activeAddOnCatalog = useMemo(
    () =>
      filterVisibleAddOnItems(
        normalizeAddOnCatalog(addOnCatalog, pricing).filter((item) => item.active),
        webbsEnabled,
      ),
    [addOnCatalog, pricing, webbsEnabled]
  );
  const pricedAddOnCatalog = useMemo(
    () => normalizeAddOnCatalog(addOnCatalog, pricing).filter((item) => item.active),
    [addOnCatalog, pricing]
  );
  const selectedProcessType = useMemo(
    () => activeProcessCatalog.find((item) => item.name === job.processType || item.slug === String(job.processType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || null,
    [activeProcessCatalog, job.processType]
  );
  const selectedAddOnItems = useMemo(
    () =>
      deriveSelectedAddOnItems(
        {
          addOnItems: job.addOnItems,
          beefFat: job.beefFat,
          webbsOrder: job.webbsOrder,
        },
        activeAddOnCatalog,
      ),
    [job.addOnItems, job.beefFat, job.webbsOrder, activeAddOnCatalog]
  );
  const processingPrice = useMemo(
    () =>
      calcCatalogProcessingPrice(
        {
          processType: job.processType,
          addOnItems: selectedAddOnItems,
          beefFat: job.beefFat,
          webbsOrder: job.webbsOrder,
        },
        activeProcessCatalog,
        pricedAddOnCatalog,
      ),
    [job.processType, job.addOnItems, job.beefFat, job.webbsOrder, activeProcessCatalog, pricedAddOnCatalog, selectedAddOnItems]
  );

  const specialtyPrice = useMemo(() => {
    if (!specialtyEnabled || !job.specialtyProducts) return 0;
    return calcSpecialtyPrice(job as any, pricing, specialtyCatalog);
  }, [
    specialtyEnabled,
    job.specialtyProducts,
    job.specialtyItems,
    pricing,
    specialtyCatalog,
  ]);
  const activeSpecialtyCatalog = useMemo(
    () => specialtyEnabled ? normalizeSpecialtyCatalog(specialtyCatalog, pricing).filter((item) => item.active) : [],
    [specialtyEnabled, specialtyCatalog, pricing]
  );
  const showFrontShoulderSteaks = cutOptions.showFrontShoulderSteaks !== false;
  const showSteakThickness = cutOptions.showSteakThickness !== false;
  const showBackstrapThickness = cutOptions.showBackstrapThickness !== false;
  const showRoastCounts = cutOptions.showRoastCounts !== false;
  const requiresHuntingLicense = stateFormType === 'michigan';
  const specialtyItems = useMemo(
    () => specialtyBreakdown(job as Record<string, any>, pricing, activeSpecialtyCatalog).filter((item) => item.pounds > 0),
    [job, pricing, activeSpecialtyCatalog]
  );
  const specialtySummaryText = useMemo(() => {
    if (!job.specialtyProducts) return 'No specialty products selected';
    const parts: string[] = [];
    if (specialtyItems.length) parts.push(`${specialtyItems.length} products`);
    if (specialtyItems.length) {
      parts.push(`${specialtyItems.reduce((sum, item) => sum + item.pounds, 0)} lb total`);
    }
    if (specialtyPrice) parts.push(`$${specialtyPrice.toFixed(2)}`);
    return parts.length ? parts.join(' | ') : 'Specialty products selected';
  }, [job.specialtyProducts, specialtyItems, specialtyPrice]);

  const totalPrice = processingPrice + specialtyPrice;
  const processingEstimatePending = false;
  const webbsItems = useMemo(() => normalizeWebbsOrderItems(job.webbsItems), [job.webbsItems]);
  const webbsAllocations = useMemo(() => normalizeWebbsAllocations(job.webbsAllocations), [job.webbsAllocations]);
  const webbsItemTotal = useMemo(() => webbsOrderTotalLbs(webbsItems), [webbsItems]);
  const webbsAllocationTotal = useMemo(() => webbsAllocationTotalPercent(webbsAllocations), [webbsAllocations]);
  const webbsItemLines = useMemo(() => webbsOrderSummary(webbsItems), [webbsItems]);
  const webbsAllocationLines = useMemo(() => webbsAllocationSummary(webbsAllocations), [webbsAllocations]);
  const webbsOrderStyle = normalizeWebbsOrderStyle(job.webbsOrderStyle);
  const webbsAllocationOver = webbsOrderStyle === 'whole_deer_percent' && webbsAllocationTotal > 100;
  const webbsSummaryText = useMemo(() => {
    return webbsPrimarySummary({
      webbsOrder: job.webbsOrder,
      webbsOrderStyle,
      webbsItems,
      webbsAllocations,
    });
  }, [job.webbsOrder, webbsOrderStyle, webbsItems, webbsAllocations]);
  const hindSelections = useMemo(() => {
    const out: string[] = [];
    if (job.hind?.['Hind - Steak']) out.push('Steak');
    if (job.hind?.['Hind - Roast']) out.push(`Roast${showRoastCounts && toInt(job.hindRoastCount) ? ` (${toInt(job.hindRoastCount)})` : ''}`);
    if (job.hind?.['Hind - Grind']) out.push('Grind');
    if (job.hind?.['Hind - None']) out.push('None');
    return out;
  }, [job.hind, job.hindRoastCount, showRoastCounts]);
  const frontSelections = useMemo(() => {
    const out: string[] = [];
    if (showFrontShoulderSteaks && job.front?.['Front - Steak']) out.push('Steak');
    if (job.front?.['Front - Roast']) out.push(`Roast${showRoastCounts && toInt(job.frontRoastCount) ? ` (${toInt(job.frontRoastCount)})` : ''}`);
    if (job.front?.['Front - Grind']) out.push('Grind');
    if (job.front?.['Front - None']) out.push('None');
    return out;
  }, [job.front, job.frontRoastCount, showFrontShoulderSteaks, showRoastCounts]);
  const preferredContact = job.prefSMS ? 'Text (SMS)' : job.prefCall ? 'Phone Call' : job.prefEmail ? 'Email' : 'Not selected';
  const intakeNotice = `Updates will be sent by ${preferredContact.toLowerCase()} when available for this processor.`;
  const reviewChecks = [
    ...(publicCopy.reviewChecklist || []),
  ];

  const procNorm = normProc(job.processType);
  const capingFlow = procNorm === 'Caped' || procNorm === 'Cape & Donate';
  const webbsOn = !!job.webbsOrder;

  useEffect(() => {
    if (webbsEnabled) return;
    setJob((prev) => ({
      ...prev,
      webbsOrder: false,
      webbsStatus: '',
      webbsOrderStyle: 'itemized_lbs',
      webbsItems: [],
      webbsAllocations: [],
      webbsPounds: '',
    }));
    setWebbsModalOpen(false);
  }, [webbsEnabled]);

  // status coercion/initialization (hidden UI)
  useEffect(() => {
    setJob((prev) => {
      const next = { ...prev };
      if (!next.webbsOrder) {
        next.webbsOrderMode = 'online';
        next.webbsOrderStyle = 'itemized_lbs';
        next.webbsItems = [];
        next.webbsAllocations = [];
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
    if (specialtyEnabled) return;
    setJob((prev) => ({
      ...prev,
      specialtyProducts: false,
      specialtyStatus: '',
      specialtyItems: [],
      paidSpecialty: false,
    }));
    setSpecialtyModalOpen(false);
  }, [specialtyEnabled]);

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
        setProcessCatalog(normalizeProcessCatalog(j?.settings?.processCatalog, j?.settings));
        setAddOnCatalog(normalizeAddOnCatalog(j?.settings?.addOnCatalog, j?.settings));
        setSpecialtyEnabled(j?.settings?.features?.specialtyEnabled !== false);
        setSpecialtyCatalog(j?.settings?.features?.specialtyEnabled === false ? [] : normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, j?.settings));
        setCutOptions(normalizeCutOptionSettings(j?.settings?.cutOptions));
        setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
        setSmsEnabled(j?.settings?.features?.smsEnabled !== false);
        setStateFormType((j?.settings?.stateFormType as StateFormType) || 'indiana');
        setPublicCopy(j?.settings?.publicCopy || publicCopy);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (smsEnabled || !job.prefSMS) return;
    setContactMethod(job.email ? 'email' : 'call');
  }, [smsEnabled, job.prefSMS, job.email]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const scrollPageTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const setConfirmation = (v: string) => {
    const val = normalizeConfirmationInput(v, identifierSettings);
    setJob((p) => ({ ...p, confirmation: val }));

    // Keep the red error until it's valid.
    setErrors((prev) => {
      if (!prev.confirmation) return prev;
      const n = { ...prev };
      const error = validateConfirmation(val, identifierSettings);
      if (!error) delete n.confirmation;
      else n.confirmation = error;
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
    const confirmationError = validateConfirmation(String(job.confirmation || ''), identifierSettings);
    if (confirmationError) e.confirmation = confirmationError;
    if (!job.customer?.trim()) e.customer = 'Customer Name is required';
    if (!is10Digits(job.phone)) e.phone = 'Phone must be 10 digits';
    if (job.prefEmail && !job.email?.trim()) e.email = 'Email is required when email updates are selected';
    if (requiresHuntingLicense && !job.huntingLicenseNumber?.trim()) e.huntingLicenseNumber = 'Hunting License # is required';
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
    if (job.prefSMS && !job.smsConsent) e.smsConsent = 'SMS consent is required when text updates are selected';
    if (showRoastCounts && job.hind?.['Hind - Roast'] && !toInt(job.hindRoastCount)) e.hindRoastCount = 'Hind Roast Count is required';
    if (showRoastCounts && job.front?.['Front - Roast'] && !toInt(job.frontRoastCount)) e.frontRoastCount = 'Front Roast Count is required';

    if (webbsEnabled && job.webbsOrder) {
      if (webbsOrderStyle === 'whole_deer_percent') {
        if (!webbsAllocations.length) e.webbsItems = 'Enter at least one Webbs product percentage';
        else if (webbsAllocationTotal !== 100) e.webbsItems = 'Webbs percentages must add up to 100%';
      } else {
        if (!webbsItems.length) e.webbsItems = 'Enter at least one Webbs item and pounds';
      }
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
    if (k === 'cuts') ['hindRoastCount', 'frontRoastCount'].forEach(pick);
    if (k === 'extras') ['webbsItems'].forEach(pick);
    if (k === 'review') Object.assign(e, all);
    return e;
  };

  const requiredLabels = useMemo<Record<string, string>>(
    () => ({
      ...REQUIRED_LABELS,
      confirmation: identifierSettings.confirmationLabel,
    }),
    [identifierSettings.confirmationLabel]
  );
  const currentStepErrors = validateStep(step.key);
  const currentStepMissing = Object.keys(currentStepErrors).map((key) => requiredLabels[key] || key);
  const requiredDone = currentStepMissing.length === 0;
  const compactRequiredList = stepIdx > 0 && currentStepMissing.length > 3;

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
    scrollPageTop();
  };

  const goBack = () => {
    if (locked) return;
    setMsg('');
    setStepIdx((i) => Math.max(i - 1, 0));
    scrollPageTop();
  };

  const onSave = async () => {
    if (locked) return;
    setMsg('');
    if (!intakeEnabled) {
      setMsg(closureMessage || 'Public intake is currently unavailable.');
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
    const selectedProcessType = activeProcessCatalog.find((item) => item.name === job.processType || item.slug === String(job.processType || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

    // IMPORTANT: public/overnight has no tag. Send empty string (not null).
    const payload: Job = {
      ...job,
      tag: '',
      requiresTag: true,

      status: pnorm === 'Cape & Donate' || pnorm === 'Donate' ? '' : (job.status || 'Dropped Off'),

      capingStatus: (pnorm === 'Caped' || pnorm === 'Cape & Donate') ? (job.capingStatus || 'Dropped Off') : '',

      webbsStatus: (job.webbsOrder && pnorm !== 'Donate') ? (job.webbsStatus || 'Dropped Off') : '',
      webbsOrderMode: job.webbsOrder ? 'online' : 'online',
      webbsOrderStyle: job.webbsOrder ? webbsOrderStyle : 'itemized_lbs',
      webbsItems: job.webbsOrder && webbsOrderStyle === 'itemized_lbs' ? webbsItems : [],
      webbsAllocations: job.webbsOrder && webbsOrderStyle === 'whole_deer_percent' ? webbsAllocations : [],
      webbsPounds: job.webbsOrder
        ? webbsOrderStyle === 'whole_deer_percent'
          ? ''
          : String(webbsItemTotal || '')
        : '',

      specialtyStatus: job.specialtyProducts ? (job.specialtyStatus || 'Dropped Off') : '',

      howKilled: job.howKilled || '',

      priceProcessing: processingPrice,
      priceSpecialty: specialtyPrice,
      price: totalPrice,

      Paid: fullPaid(job),
      paid: fullPaid(job),
      paidProcessing: !!job.paidProcessing,
      paidSpecialty: job.specialtyProducts ? !!job.paidSpecialty : false,
      addOnItems: normalizeJobAddOnItems(selectedAddOnItems),
      processTypeSlug: selectedProcessType?.slug || null,
      processTypeRequiresCape: !!selectedProcessType?.triggersCapeWorkflow,
      specialtyItems: job.specialtyProducts ? normalizeJobSpecialtyItems((job as any).specialtyItems) : [],
      huntingLicenseNumber: job.huntingLicenseNumber || '',

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
      setMsg('Saved');
      scrollPageTop();
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 1500);
    }
  };

  useEffect(() => {
    scrollPageTop();
  }, [stepIdx, showThanks, scrollPageTop]);

  const setVal = <K extends keyof Job>(k: K, v: Job[K]) =>
    !locked &&
    setJob((p) => {
      const next = { ...p, [k]: v };
      if (k === 'webbsOrder' && !v) {
        next.webbsOrderStyle = 'itemized_lbs';
        next.webbsItems = [];
        next.webbsAllocations = [];
      }
      if (k === 'webbsOrderStyle') {
        if (v === 'whole_deer_percent') next.webbsItems = [];
        if (v === 'itemized_lbs') next.webbsAllocations = [];
      }
      return next;
    });

  const setAddOnSelected = (slug: string, selected: boolean) => {
    if (locked) return;
    setJob((prev) => {
      const catalogItem = activeAddOnCatalog.find((item) => item.slug === slug);
      if (!catalogItem) return prev;
      const nextItems = normalizeJobAddOnItems(prev.addOnItems).filter((item) => item.slug !== slug);
      if (selected) {
        nextItems.push({
          slug: catalogItem.slug,
          name: catalogItem.name,
          selected: true,
          price: catalogItem.price,
          sortOrder: catalogItem.sortOrder,
          legacyBooleanKey: catalogItem.legacyBooleanKey ?? null,
        });
      }
      const next = {
        ...prev,
        addOnItems: nextItems.sort((a, b) => a.sortOrder - b.sortOrder),
      };
      if (catalogItem.legacyBooleanKey === 'beefFat') next.beefFat = selected;
      if (catalogItem.legacyBooleanKey === 'webbsOrder') next.webbsOrder = selected;
      return next;
    });
  };

  const setSpecialtyQuantity = (slug: string, rawValue: string) => {
    if (locked) return;
    const quantity = toInt(rawValue);
    const catalogItem = activeSpecialtyCatalog.find((item) => item.slug === slug);
    setJob((prev) => {
      const nextItems = normalizeJobSpecialtyItems((prev as any).specialtyItems).filter((item) => item.slug !== slug);
      if (catalogItem && quantity > 0) {
        nextItems.push({
          catalogId: catalogItem.id ?? null,
          slug: catalogItem.slug,
          name: catalogItem.name,
          shortName: catalogItem.shortName,
          unit: 'lb',
          priceType: 'per_lb',
          quantity,
          pricePerUnit: Number(catalogItem.price ?? 0),
          total: quantity * Number(catalogItem.price ?? 0),
          sortOrder: catalogItem.sortOrder,
          legacyFieldKey: catalogItem.legacyFieldKey ?? null,
        });
      }
      const next = { ...prev, specialtyItems: nextItems };
      if (catalogItem?.legacyFieldKey) (next as any)[catalogItem.legacyFieldKey] = quantity > 0 ? String(quantity) : '';
      return next;
    });
  };

  const setContactMethod = (method: 'email' | 'sms' | 'call') => {
    if (locked) return;
    setJob((p) => ({
      ...p,
      prefEmail: method === 'email',
      prefSMS: method === 'sms',
      prefCall: method === 'call',
      smsConsent: method === 'sms' ? !!p.smsConsent : false,
      autoCallConsent: false,
    }));
  };

  const setWebbsItemPounds = (key: string, value: string) => {
    if (locked) return;
    setJob((prev) => {
      const next = normalizeWebbsOrderItems(prev.webbsItems).filter((item) => item.key !== key);
      const pounds = toInt(value);
      if (pounds > 0) next.push({ key, label: '', pounds });
      return { ...prev, webbsItems: next };
    });
  };

  const setWebbsAllocationPercent = (key: string, value: string) => {
    if (locked) return;
    setJob((prev) => {
      const next = normalizeWebbsAllocations(prev.webbsAllocations).filter((item) => item.key !== key);
      const percent = toInt(value);
      if (percent > 0) next.push({ key, label: '', percent });
      return { ...prev, webbsAllocations: next };
    });
  };

  const setHind = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => {
      const nextValue = !(p.hind?.[k]);
      return {
        ...p,
        hind: { ...(p.hind || {}), [k]: nextValue },
        hindRoastCount: k === 'Hind - Roast' && !nextValue ? '' : p.hindRoastCount,
      };
    });

  const setFront = (k: keyof Required<CutsBlock>) =>
    !locked && setJob((p) => {
      const nextValue = !(p.front?.[k]);
      return {
        ...p,
        front: { ...(p.front || {}), [k]: nextValue },
        frontRoastCount: k === 'Front - Roast' && !nextValue ? '' : p.frontRoastCount,
      };
    });

  return (
    <div className={`form-card ${locked ? 'locked' : ''}`}>
      <div className="screen-only">
        {showIntroGuidance ? (
          <>
            <div className="hero">
              <div className="hero-copy">
                <div className="hero-kicker">Public Intake</div>
                <h2>Deer Intake Form</h2>
                <p>
                  We&apos;ll walk you through this one step at a time. Required items are checked before you move on so
                  the processor has everything needed to tag, process, and contact you without delays.
                </p>
              </div>
              <div className="hero-card">
                <div className="hero-card-title">Before you drop off</div>
                <ul>
                  {(publicCopy.beforeDropoffChecklist || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="intakeNotice" role="status" aria-live="polite">
              <span className="intakeHighlightDot" aria-hidden="true" />
              <span>{intakeNotice}</span>
            </div>
          </>
        ) : null}
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
            {closureMessage || 'Public intake is currently unavailable.'}
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

        <div className={`stepChips ${stepIdx > 0 ? 'mobileCollapse' : ''}`} aria-label="Progress">
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

        <div className={`summary ${compactSummary ? 'compact' : ''}`}>
          {compactSummary ? (
            <div className="compactSummaryBar">
              <div className="compactSummaryMain">
                <div className="compactSummaryStep">Step {stepIdx + 1} of {steps.length}: {step.title}</div>
                <div className="compactSummaryTotal">${totalPrice.toFixed(2)}</div>
              </div>
              <div className="compactSummarySub">
                <span>Processing ${processingPrice.toFixed(2)}</span>
                <span>Specialty ${specialtyPrice.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="row">
                <div className="col">
                  <label>Assigned Tag</label>
                  <input value={''} onChange={() => {}} placeholder="Assigned by staff" disabled />
                  <div className="muted" style={{ fontSize: 12 }}>This form saves your order first. Staff adds the permanent tag after review.</div>
                </div>

                <div className="col price">
                  <label>Processing Estimate</label>
                  <div className="money">{processingPrice.toFixed(2)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                      Base process type + selected add-ons
                  </div>
                </div>

                <div className="col price">
                  <label>Specialty Estimate</label>
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
            </>
          )}
        </div>

        {/* Step: Customer */}
        {step.key === 'customer' && (
          <section>
            <h3>Customer</h3>
            <div className="stepIntro">
              <div className="stepIntroTitle">Start here</div>
              <div className="stepIntroCopy">
                {publicCopy.customerInfoIntro}
              </div>
            </div>
            <div className="grid">
              <div className="c3">
                <label>{identifierSettings.confirmationLabel}</label>
                <Hint>{publicCopy.confirmationHelpText}</Hint>
                <input
                  value={job.confirmation || ''}
                  onChange={(e) => setConfirmation(e.target.value)}
                  inputMode={confirmationInputMode(identifierSettings)}
                  pattern={identifierSettings.confirmationValidation === 'freeform' ? undefined : '[0-9]*'}
                  maxLength={identifierSettings.confirmationValidation === 'freeform' ? 40 : identifierSettings.confirmationValidation === 'exact_13' ? 13 : 24}
                  placeholder={identifierSettings.confirmationPlaceholder}
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
                  placeholder="First and last name"
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
                  placeholder="10-digit phone number"
                  className={errors.phone ? 'err' : ''}
                  data-err="phone"
                  disabled={locked}
                />
                {errors.phone ? <div className="errText">{errors.phone}</div> : null}
              </div>

              <div className="c4">
                <label>Email</label>
                <Hint>Only needed if you want email updates.</Hint>
                <input
                  value={job.email || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVal('email', v);
                    setErrors((prev) => {
                      if (!prev.email) return prev;
                      const n = { ...prev };
                      if (!job.prefEmail || v.trim()) delete n.email;
                      else n.email = 'Email is required when email updates are selected';
                      return n;
                    });
                  }}
                  placeholder="Email address"
                  className={errors.email ? 'err' : ''}
                  data-err="email"
                  disabled={locked}
                />
                {errors.email ? <div className="errText">{errors.email}</div> : null}
              </div>

              {requiresHuntingLicense ? (
                <div className="c4">
                  <label>Hunting License #</label>
                  <Hint>Required for Michigan reporting.</Hint>
                  <input
                    value={job.huntingLicenseNumber || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVal('huntingLicenseNumber', v);
                      setErrors((prev) => {
                        if (!prev.huntingLicenseNumber) return prev;
                        const n = { ...prev };
                        if (v.trim()) delete n.huntingLicenseNumber;
                        else n.huntingLicenseNumber = 'Hunting License # is required';
                        return n;
                      });
                    }}
                    placeholder="License number"
                    className={errors.huntingLicenseNumber ? 'err' : ''}
                    data-err="huntingLicenseNumber"
                    disabled={locked}
                  />
                  {errors.huntingLicenseNumber ? <div className="errText">{errors.huntingLicenseNumber}</div> : null}
                </div>
              ) : null}

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
                  placeholder="Street address"
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
                  placeholder="City"
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
                  <option value="">--</option>
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
                  placeholder="ZIP"
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
                  <option value="">--</option>
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
                  <option value="">--</option>
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
                  <option value="">--</option>
                  {activeProcessCatalog.map((item) => (
                    <option key={item.slug} value={item.name}>{item.name}</option>
                  ))}
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
                    {showRoastCounts && !!job.hind?.['Hind - Roast'] ? (
                      <span className="count">
                        <span className="muted"># of Roast</span>
                        <input
                          className="countInp"
                          value={job.hindRoastCount || ''}
                          onChange={(e) => setVal('hindRoastCount', e.target.value)}
                          inputMode="numeric"
                        />
                      </span>
                    ) : null}
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
                      <input type="checkbox" checked={!!job.front?.['Front - Roast']} onChange={() => setFront('Front - Roast')} disabled={locked} />
                      <span>Roast</span>
                    </label>
                    {showRoastCounts && !!job.front?.['Front - Roast'] ? (
                      <span className="count">
                        <span className="muted"># of Roast</span>
                        <input
                          className="countInp"
                          value={job.frontRoastCount || ''}
                          onChange={(e) => setVal('frontRoastCount', e.target.value)}
                          inputMode="numeric"
                        />
                      </span>
                    ) : null}
                    {showFrontShoulderSteaks ? (
                      <label className="chk">
                        <input type="checkbox" checked={!!job.front?.['Front - Steak']} onChange={() => setFront('Front - Steak')} disabled={locked} />
                        <span>Steak</span>
                      </label>
                    ) : null}
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
                {showSteakThickness ? (
                  <div className="pkg steak">
                    <label>Steak Thickness</label>
                    <select value={job.steak || ''} onChange={(e) => setVal('steak', e.target.value)} disabled={locked}>
                      <option value="">--</option>
                      <option value='1/2"'>1/2"</option>
                      <option value='3/4"'>3/4"</option>
                      <option value='1"'>1"</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                ) : null}

                {showSteakThickness && job.steak === 'Other' ? (
                  <div className="pkg steakOther">
                    <label>Custom Steak Thickness</label>
                    <input value={job.steakOther || ''} onChange={(e) => setVal('steakOther', e.target.value)} disabled={locked} placeholder="Enter thickness" />
                  </div>
                ) : null}

                <div className="pkg steaksPer">
                  <label>Steaks per Package</label>
                  <select value={job.steaksPerPackage || ''} onChange={(e) => setVal('steaksPerPackage', e.target.value)} disabled={locked}>
                    <option value="">--</option>
                    <option>4</option>
                    <option>6</option>
                    <option>8</option>
                  </select>
                </div>

                <div className="pkg burgerSize">
                  <label>Burger Size</label>
                  <select value={job.burgerSize || ''} onChange={(e) => setVal('burgerSize', e.target.value)} disabled={locked}>
                    <option value="">--</option>
                    <option>1 lb</option>
                    <option>2 lb</option>
                  </select>
                </div>

                {activeAddOnCatalog.length ? (
                <div className="pkg" style={{ gridColumn: '1 / -1' }}>
                  <label>Add-Ons</label>
                  <div className="checks">
                    {activeAddOnCatalog.map((item) => {
                      const checked = selectedAddOnItems.some((selected) => selected.slug === item.slug);
                      return (
                        <label className="chk tight" key={item.slug}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAddOnSelected(item.slug, e.target.checked);
                              if (item.legacyBooleanKey === 'webbsOrder' && e.target.checked) {
                                setWebbsModalOpen(true);
                              }
                            }}
                            disabled={locked}
                          />
                          <span>{item.name}</span>
                          <span className="muted"> (+${Number(item.price || 0).toFixed(2)})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                ) : null}
              </div>
            </section>

            <section>
              <h3>Backstrap</h3>
              <div className="grid">
                <div className={showBackstrapThickness ? 'c4' : 'c12'}>
                  <label>Prep</label>
                  <select value={job.backstrapPrep || ''} onChange={(e) => setVal('backstrapPrep', e.target.value as any)} disabled={locked}>
                    <option value="">--</option>
                    <option>Whole</option>
                    <option>Sliced</option>
                    <option>Butterflied</option>
                  </select>
                </div>
                {showBackstrapThickness ? (
                  <div className="c4">
                    <label>Thickness</label>
                    <select value={job.backstrapThickness || ''} onChange={(e) => setVal('backstrapThickness', e.target.value as any)} disabled={locked}>
                      <option value="">--</option>
                      <option value='1/2"'>1/2"</option>
                      <option value='3/4"'>3/4"</option>
                      <option value="Other">Other</option>
                    </select>
                    {job.backstrapThickness === 'Other' ? (
                      <input style={{ marginTop: 8 }} value={job.backstrapThicknessOther || ''} onChange={(e) => setVal('backstrapThicknessOther', e.target.value)} disabled={locked} placeholder="Enter thickness" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}

        {/* Step: Extras */}
        {step.key === 'extras' && (
          <>
            <section>
              <h3>Specialty Products</h3>
              <div className="grid">
                <div className="c3 rowInline">
                  <label className="chk tight pkg-beef">
                    <input
                      type="checkbox"
                      checked={!!job.specialtyProducts}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setVal('specialtyProducts', checked);
                        if (!checked) setJob((prev) => ({ ...prev, specialtyItems: [] }));
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
                              {item.label}: {item.pounds} lb
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

                {webbsEnabled && job.webbsOrder && (
                  <>
                    <div className="c12">
                      <div className="webbsSummaryCard">
                        <div className="webbsSummaryHead">
                          <div>
                            <div className="webbsSummaryTitle">Webbs Order</div>
                            <div className="muted" style={{ fontSize: 13 }}>{webbsSummaryText}</div>
                            <div style={{ marginTop: 8 }}>
                              <a
                                href={WEBBS_PRICE_SHEET_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="webbsPdfLink"
                              >
                                Open Webbs price sheet (PDF)
                              </a>
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
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
                            {webbsAllocationLines.length > 6 ? <div className="webbsSummaryMore">+{webbsAllocationLines.length - 6} more items</div> : null}
                          </div>
                        ) : webbsItemLines.length > 0 ? (
                          <div className="webbsSummaryList">
                            {webbsItemLines.slice(0, 6).map((line) => (
                              <div key={line} className="webbsSummaryLine">{line}</div>
                            ))}
                            {webbsItemLines.length > 6 ? <div className="webbsSummaryMore">+{webbsItemLines.length - 6} more items</div> : null}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 13 }}>No Webbs items entered yet.</div>
                        )}
                        {webbsAllocationOver ? (
                          <div className="errText" data-err="webbsItems" style={{ marginTop: 12 }}>
                            Webbs percentages are over 100%. Reduce them before submitting.
                          </div>
                        ) : null}
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
                  <label>Preferred Contact Method</label>
                  <div className="checks">
                    <label className="chk">
                      <input type="radio" name="preferred-contact-public" checked={!!job.prefEmail} onChange={() => setContactMethod('email')} disabled={locked} />
                      <span>Email</span>
                    </label>
                    <label className="chk">
                      <input type="radio" name="preferred-contact-public" checked={!!job.prefSMS} onChange={() => setContactMethod('sms')} disabled={locked || !smsEnabled} />
                      <span>Text (SMS)</span>
                    </label>
                    <label className="chk">
                      <input type="radio" name="preferred-contact-public" checked={!!job.prefCall} onChange={() => setContactMethod('call')} disabled={locked} />
                      <span>Phone Call</span>
                    </label>
                  </div>
                </div>

                <div className="c6">
                  <label>Legal Consent</label>
                  <div className="checks">
                    {job.prefSMS ? (
                      <label className="chk">
                        <input type="checkbox" checked={!!job.smsConsent} onChange={(e) => setVal('smsConsent', e.target.checked)} disabled={locked} />
                        <span>I consent to receive informational SMS updates</span>
                      </label>
                    ) : (
                      <div className="muted">No extra consent needed for email or staff phone calls.</div>
                    )}
                    {errors.smsConsent ? <div className="errText" data-err="smsConsent">{errors.smsConsent}</div> : null}
                    {!smsEnabled ? <div className="muted">Text updates are not included for this processor&apos;s current plan.</div> : null}
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
            <Hint>Double-check everything below. If it looks right, submit and leave your deer with your confirmation details attached.</Hint>
            <div className="reviewPrep">
              <div className="reviewPrepTitle">Before you submit, confirm these three things:</div>
              <div className="reviewPrepList">
                {reviewChecks.map((item) => (
                  <div key={item} className="reviewPrepItem">
                    <span className="reviewPrepDot" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="reviewMobile" style={{ marginTop: 12 }}>
              <div className="reviewSummaryGrid">
                <div className="reviewCard">
                  <div className="reviewCardTitle">Customer</div>
                  <div className="reviewLine"><strong>{job.customer || '-'}</strong></div>
                  <div className="reviewLine">Confirmation: {job.confirmation || '-'}</div>
                  <div className="reviewLine">Phone: {job.phone || '-'}</div>
                  {requiresHuntingLicense ? <div className="reviewLine">Hunting license: {job.huntingLicenseNumber || '-'}</div> : null}
                  <div className="reviewLine">Address: {[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ') || '-'}</div>
                </div>
                <div className="reviewCard">
                  <div className="reviewCardTitle">Hunt Details</div>
                  <div className="reviewLine">County: {job.county || '-'}</div>
                  <div className="reviewLine">Drop-off: {job.dropoff || '-'}</div>
                  <div className="reviewLine">Sex: {job.sex || '-'}</div>
                  <div className="reviewLine">How killed: {job.howKilled || '-'}</div>
                  <div className="reviewLine">Process type: {job.processType || '-'}</div>
                </div>
                <div className="reviewCard">
                  <div className="reviewCardTitle">Cuts & Packaging</div>
                  <div className="reviewLine">Hind quarter: {hindSelections.join(' | ') || '-'}</div>
                  <div className="reviewLine">Front shoulder: {frontSelections.join(' | ') || '-'}</div>
                <div className="reviewLine">Steaks per pack: {job.steaksPerPackage || '-'}</div>
                  {showSteakThickness ? (
                    <div className="reviewLine">
                      Steak thickness: {job.steak === 'Other' ? (job.steakOther || '-') : (job.steak || '-')}
                    </div>
                  ) : null}
                  <div className="reviewLine">Burger size: {job.burgerSize || '-'}</div>
                  <div className="reviewLine">Backstrap: {job.backstrapPrep || '-'}</div>
                  {showBackstrapThickness ? (
                    <div className="reviewLine">Backstrap thickness: {job.backstrapThickness === 'Other' ? (job.backstrapThicknessOther || '-') : (job.backstrapThickness || '-')}</div>
                  ) : null}
                  <div className="reviewLine">
                    Add-ons: {selectedAddOnItems.length ? selectedAddOnItems.map((item) => `${item.name}${item.price ? ` (+$${Number(item.price || 0).toFixed(2)})` : ''}`).join(' | ') : 'No add-ons'}
                  </div>
                </div>
                <div className="reviewCard">
                  <div className="reviewCardTitle">Extras & Contact</div>
                  <div className="reviewLine">Specialty: {job.specialtyProducts ? specialtySummaryText : 'No specialty products'}</div>
                  {job.specialtyProducts && specialtyItems.length > 0 ? (
                    <div className="reviewList">
                      {specialtyItems.map((item) => (
                        <div key={item.key} className="reviewListItem">{item.label.replace(' (lb)', '')}: {item.pounds} lb</div>
                      ))}
                    </div>
                  ) : null}
                  {webbsEnabled ? (
                    <div className="reviewLine">Webbs: {job.webbsOrder ? webbsSummaryText : 'No Webbs order'}</div>
                  ) : null}
                  {job.webbsOrder && webbsOrderStyle === 'whole_deer_percent' && webbsAllocationLines.length > 0 ? (
                    <div className="reviewList">
                      {webbsAllocationLines.map((line) => (
                        <div key={line} className="reviewListItem">{line}</div>
                      ))}
                    </div>
                  ) : null}
                  {job.webbsOrder && webbsOrderStyle !== 'whole_deer_percent' && webbsItemLines.length > 0 ? (
                    <div className="reviewList">
                      {webbsItemLines.map((line) => (
                        <div key={line} className="reviewListItem">{line}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="reviewLine">Preferred contact: {preferredContact}</div>
                  <div className="reviewLine">SMS consent: {job.prefSMS ? (job.smsConsent ? 'Yes' : 'No') : 'Not needed'}</div>
                </div>
                {job.notes?.trim() ? (
                  <div className="reviewCard reviewNotesCard">
                    <div className="reviewCardTitle">Notes</div>
                    <div className="reviewNoteText">{job.notes}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="reviewDesktop reviewSheetFrame" style={{ marginTop: 12 }}>
              <PrintSheet job={job as any} webbsEnabled={webbsEnabled} />
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
              {busy ? 'Saving...' : locked ? 'Saved' : 'Submit'}
            </button>
          ) : (
            <button className="btn" onClick={goNext} disabled={busy || locked}>
              Next
            </button>
          )}
        </div>
      </div>

      <div className="print-only">
        <PrintSheet job={job} webbsEnabled={webbsEnabled} />
      </div>

      {specialtyModalOpen && job.specialtyProducts && !locked ? (
        <div className="modal" onClick={() => setSpecialtyModalOpen(false)}>
          <div className="modal-card webbsModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="webbsModalHead">
              <div>
                <div className="modalKicker">Specialty</div>
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
                <div className="webbsGroupTitle">Processor Specialty Catalog</div>
                <div className="webbsWorksheet">
                  <div className="webbsWorksheetHead">
                    <div>Product</div>
                    <div>Lb</div>
                  </div>
                  {activeSpecialtyCatalog.map((item) => (
                    <div key={item.slug} className="webbsWorksheetRow">
                      <div className="webbsWorksheetLabel">
                        {item.name}
                        <div className="muted" style={{ marginTop: 4 }}>
                          ${Number(item.price ?? 0).toFixed(2)}/lb
                        </div>
                      </div>
                      <div>
                        <input
                          inputMode="numeric"
                          value={String(
                            normalizeJobSpecialtyItems((job as any).specialtyItems).find((entry) => entry.slug === item.slug)?.quantity ??
                              ((item.legacyFieldKey ? (job as any)[item.legacyFieldKey] : '') || '')
                          )}
                          onChange={(e) => setSpecialtyQuantity(item.slug, e.target.value)}
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

      {webbsEnabled && webbsModalOpen && job.webbsOrder && !locked ? (
        <div className="modal" onClick={() => setWebbsModalOpen(false)}>
          <div className="modal-card webbsModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="webbsModalHead">
              <div>
                <div className="modalKicker">Webbs Order</div>
                <h3>{webbsOrderStyleLabel(webbsOrderStyle)}</h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  {webbsOrderStyle === 'whole_deer_percent'
                    ? 'Enter percentages that add up to 100% for the whole deer.'
                    : 'Enter the products and pounds you want sent to Webbs.'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <a
                    href={WEBBS_PRICE_SHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="webbsPdfLink"
                  >
                    Open Webbs price sheet (PDF)
                  </a>
                </div>
              </div>
              <button className="btn secondary" type="button" onClick={() => setWebbsModalOpen(false)}>
                Done
              </button>
            </div>

            <div className="webbsModeSwitch" style={{ marginBottom: 12 }}>
              <label className="chk">
                <input
                  type="radio"
                  checked={webbsOrderStyle === 'itemized_lbs'}
                  onChange={() => setVal('webbsOrderStyle', 'itemized_lbs')}
                />
                <span>Products by pounds</span>
              </label>
              <label className="chk">
                <input
                  type="radio"
                  checked={webbsOrderStyle === 'whole_deer_percent'}
                  onChange={() => setVal('webbsOrderStyle', 'whole_deer_percent')}
                />
                <span>Whole deer by percentages</span>
              </label>
            </div>

            <div className="webbsModalBody">
              {webbsAllocationOver ? (
                <div className="errText" style={{ marginBottom: 12 }}>
                  Webbs percentages are over 100%. This order cannot be submitted until the total is 100% or less.
                </div>
              ) : null}
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
          </div>
        </div>
      ) : null}

      {/* Thank-you modal */}
      {showThanks && (
        <div className="modal thanksModal">
          <div className="modal-card thanksModalCard">
            <div className="thanksKicker">Form Submitted</div>
            <h3>Your public intake was received</h3>
            <div className="thanksConf">
              <div className="thanksConfLabel">Your confirmation number</div>
              <div className="thanksConfValue">{job.confirmation || 'Saved'}</div>
            </div>
            <p style={{ marginTop: 10, lineHeight: 1.6 }}>
              {publicCopy.thankYouMessage}
            </p>
            <p style={{ marginTop: 10, lineHeight: 1.6 }}>
              {publicCopy.pickupInstructions}
              {confirmationLast5 ? <> The last 5 digits of your confirmation number are <code>{confirmationLast5}</code>.</> : null}
            </p>
            <p style={{ marginTop: 10, lineHeight: 1.6 }}>
              Staff will review your intake, assign the permanent tag, and use your selected contact method when an update is available.
            </p>
            <div className="thanksList" style={{ marginTop: 12 }}>
              {publicCopy.turnaroundEstimate ? <div>{publicCopy.turnaroundEstimate}</div> : null}
              {Array.isArray(publicCopy.acceptedPaymentMethods) && publicCopy.acceptedPaymentMethods.length ? (
                <div>
                  Accepted payments: {publicCopy.acceptedPaymentMethods.map((method) => ({ cash: 'cash', check: 'check', card: 'card', other: 'other' }[method] || method)).join(', ')}.
                </div>
              ) : null}
              {publicCopy.callBeforePickup ? <div>Please call the shop before pickup so staff can have your order ready.</div> : null}
              {publicCopy.storageFeePolicy ? <div>{publicCopy.storageFeePolicy}</div> : null}
            </div>
            <div className="thanksList">
              <div>1. Staff will review your intake and assign the real deer tag.</div>
              <div>2. Use this confirmation number on the status page until that tag is assigned.</div>
              <div>3. We will contact you using the method you selected when there is an update.</div>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              If anything looks wrong later, contact the shop and have this confirmation number ready.
            </p>
            <div className="thanksActions">
              <button
                className="btn secondary"
                onClick={() => window.location.assign('/status')}
              >
                Check Status
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (window.history.length > 1) window.location.replace('/');
                  else window.close();
                }}
              >
                Done
              </button>
            </div>
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
          width: 100%; padding: 10px 12px; border: 1px solid #d8e3f5; border-radius: 10px; background: #fbfdff; box-sizing: border-box; font-size: 16px;
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
        .thanksKicker { font-size: 12px; font-weight: 900; color: #406c4d; text-transform: uppercase; letter-spacing: .08em; }
        .thanksConf {
          margin-top: 12px;
          border: 1px solid #bfd2c2;
          background: #eef8f0;
          border-radius: 14px;
          padding: 12px;
        }
        .thanksConfLabel { font-size: 12px; font-weight: 800; color: #406c4d; margin-bottom: 6px; }
        .thanksConfValue { font-size: 28px; font-weight: 950; letter-spacing: .04em; color: #173321; overflow-wrap: anywhere; }
        .thanksList {
          margin-top: 12px;
          display: grid;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          background: #f7faf8;
          border: 1px solid #dce7df;
          color: #173321;
          font-size: 14px;
          line-height: 1.5;
        }
        .thanksActions { display:flex; gap:10px; flex-wrap:wrap; margin-top: 14px; }
        .intakeNotice {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border: 1px solid #dce7df;
          border-radius: 12px;
          background: #f7faf8;
          color: #173321;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .intakeHighlightDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #406c4d;
          margin-top: 5px;
        }
        .reviewSheetFrame {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: visible;
          border: 1px solid #dce7df;
          border-radius: 14px;
          background: #fff;
          -webkit-overflow-scrolling: touch;
        }
        .reviewMobile { display: none; }
        .reviewSummaryGrid {
          display: grid;
          gap: 12px;
        }
        .reviewCard {
          border: 1px solid #dce7df;
          border-radius: 14px;
          background: #fff;
          padding: 14px;
        }
        .reviewNotesCard {
          background: #fbfdff;
        }
        .reviewCardTitle {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #406c4d;
          margin-bottom: 8px;
        }
        .reviewPrep {
          margin-top: 12px;
          border: 1px solid #dce7df;
          border-radius: 14px;
          background: #f7faf8;
          padding: 12px;
        }
        .reviewPrepTitle {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #406c4d;
          margin-bottom: 8px;
        }
        .reviewPrepList {
          display: grid;
          gap: 8px;
        }
        .reviewPrepItem {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          align-items: start;
          color: #173321;
          font-size: 14px;
          line-height: 1.5;
        }
        .reviewPrepDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #406c4d;
          margin-top: 5px;
        }
        .reviewLine {
          font-size: 14px;
          line-height: 1.55;
          color: #173321;
          margin-top: 4px;
          overflow-wrap: anywhere;
        }
        .reviewList {
          display: grid;
          gap: 6px;
          margin-top: 8px;
          padding-left: 10px;
        }
        .reviewListItem {
          font-size: 13px;
          line-height: 1.5;
          color: #173321;
          overflow-wrap: anywhere;
        }
        .reviewNoteText {
          white-space: pre-wrap;
          line-height: 1.6;
          color: #173321;
        }
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
        .mobileProgress {
          display: none;
          margin: 0 0 10px;
          padding: 10px 12px;
          border: 1px solid #dce7df;
          border-radius: 12px;
          background: #f7faf8;
        }
        .mobileProgressMeta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 800;
          color: #406c4d;
        }
        .mobileProgressTrack {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: #dce7df;
          overflow: hidden;
        }
        .mobileProgressFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2f6f3f 0%, #4d9661 100%);
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
        .requiredBox.compact {
          padding: 9px 10px;
        }
        .requiredMore {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(127, 29, 29, 0.08);
          font-size: 12px;
          font-weight: 800;
          color: #991b1b;
        }
        .stepIntro {
          border: 1px solid #dbe4ee;
          background: #f8fafc;
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 12px;
          display: grid;
          gap: 6px;
        }
        .stepIntroTitle {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: #406c4d;
        }
        .stepIntroCopy {
          color: #334155;
          font-size: 14px;
          line-height: 1.55;
        }

        .summary { position: sticky; top: 0; background: #f3f8f4; border: 1px solid #dce7df; border-radius: 10px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.06); z-index:5; }
        .summary .row { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); align-items: end; }
        .summary .row.small { margin-top: 6px; grid-template-columns: 1fr; }
        .summary .col { display: flex; flex-direction: column; gap: 4px; }
        .summary .price .money { font-weight: 800; text-align: right; background: #fff; border: 1px solid #dce7df; border-radius: 8px; padding: 6px 8px; }
        .summary .total .money.total { font-weight: 900; }
        .summary.compact {
          padding: 10px 12px;
        }
        .compactSummaryBar {
          display: grid;
          gap: 8px;
        }
        .compactSummaryMain {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .compactSummaryStep {
          font-size: 13px;
          font-weight: 800;
          color: #173321;
        }
        .compactSummaryTotal {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          white-space: nowrap;
        }
        .compactSummarySub {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          font-size: 12px;
          color: #4b5563;
          font-weight: 700;
        }

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
        .webbsPdfLink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #235532;
          font-weight: 800;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .webbsPdfLink:hover {
          color: #173321;
        }
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
          .mobileProgress.showCompact {
            display: block;
          }
          .stepChips.mobileCollapse {
            display: none;
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
          .compactSummaryMain {
            align-items: flex-start;
            flex-direction: column;
          }
          .compactSummaryTotal {
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
            position: sticky;
            bottom: 0;
            background: rgba(255,255,255,.98);
            backdrop-filter: blur(8px);
            margin: 12px -12px 0;
            padding: 12px;
            border-top: 1px solid #dce7df;
          }
          .statusWrap {
            grid-column: 1 / -1;
          }
          .btn {
            width: 100%;
          }
          .webbsSummaryCard {
            padding: 14px;
          }
          .webbsSummaryHead {
            display: grid;
            gap: 10px;
          }
          .reviewMobile {
            display: block;
          }
          .reviewDesktop {
            display: none;
          }
          .reviewSheetFrame {
            margin-left: -2px;
            margin-right: -2px;
            border-radius: 12px;
          }
          .thanksConfValue {
            font-size: 24px;
          }
          .thanksActions {
            display: grid;
            grid-template-columns: 1fr;
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
        .thanksModal {
          align-items: flex-start;
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
        }
        .thanksModalCard {
          margin: 0 auto;
          max-height: calc(100vh - 40px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
          overflow-y: auto;
        }
        .btn.wide { width: 100%; margin-top: 12px; }

        @media (max-width: 720px) {
          .summary { position: static !important; top: auto !important; box-shadow: none; z-index: auto; }
          .thanksModal {
            padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
          }
          .thanksModalCard {
            max-height: calc(100vh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            border-radius: 14px;
          }
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
