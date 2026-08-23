'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintAntlerLabel, canPrintCapeLabel, type ThermalLabelPrintMode } from '@/app/components/ThermalLabelSheet';
import { openBrowserPrintPreview, openElementPrintPreview } from '@/app/lib/browserPrint';
import type { Job } from '@/lib/api';
import { getJob, saveJob, searchJobs, tokenHeader } from '@/lib/api';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { specialtyBreakdown } from '@/lib/specialty';
import { DEFAULT_SITE_PRICING, normalizePricing } from '@/lib/pricing';
import { filterVisibleAddOnItems, normalizeJobAddOnItems } from '@/lib/processorCatalog';
import { defaultSpecialtyCatalog, normalizeSpecialtyCatalog, type SpecialtyCatalogItem } from '@/lib/specialtyCatalog';

const API_RESEND = '/api/v2/reports/resend-notification';
const API_RESET = '/api/v2/reports/reset-notification';
const API_UNPRINT = '/api/v2/reports/mark-unprinted';
const API_MARK = '/api/v2/reports/mark-printed';
const API_MANUAL_MESSAGE = '/api/v2/jobs/manual-message';
const RESEND_EVENTS = [
  { key: 'dropoff_tagged', label: 'Drop-Off Tagged' },
  { key: 'meat_finished', label: 'Meat Finished' },
  { key: 'cape_finished', label: 'Cape Finished' },
  { key: 'specialty_finished', label: 'Specialty Finished' },
  { key: 'webbs_delivered', label: 'Webbs Delivered' },
] as const;

type ResendEventKey = (typeof RESEND_EVENTS)[number]['key'];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const source = String(text || '');
  const term = String(query || '').trim();
  if (!source || !term || term.startsWith('@')) return <>{source || '-'}</>;
  const regex = new RegExp(`(${escapeRegExp(term)})`, 'ig');
  return (
    <>
      {source.split(regex).map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={`${part}-${index}`} style={{ background: '#fef08a', color: '#111827', padding: '0 2px', borderRadius: 4 }}>{part}</mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function rowBadges(row: Record<string, any>) {
  const badges: string[] = [];
  if (!row.tag || String(row.tag).toUpperCase().startsWith('PENDING-')) badges.push('Needs tag');
  const status = String(row.status || '').toLowerCase();
  if (status.includes('finished') || status.includes('ready') || status.includes('called')) badges.push('Ready');
  const due = processingDue(row) + specialtyDue(row);
  if (due > 0) badges.push('Unpaid');
  return badges;
}

function truthyFlag(value: any) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return ['1', 'true', 'yes', 'y', 'paid', 'x', 'on'].includes(String(value).trim().toLowerCase());
}

function processingDue(row: Record<string, any> | null | undefined) {
  if (!row) return 0;
  if (truthyFlag(row.paid ?? row.Paid) || truthyFlag(row.paidProcessing ?? row.paid_processing)) return 0;
  return Math.max(0, Number(row.priceProcessing ?? row.price_processing ?? 0) - Number(row.amountPaidProcessing ?? row.amount_paid_processing ?? 0));
}

function specialtyDue(row: Record<string, any> | null | undefined) {
  if (!row) return 0;
  if (truthyFlag(row.paid ?? row.Paid) || truthyFlag(row.paidSpecialty ?? row.paid_specialty)) return 0;
  return Math.max(0, Number(row.priceSpecialty ?? row.price_specialty ?? 0) - Number(row.amountPaidSpecialty ?? row.amount_paid_specialty ?? 0));
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusReadyLike(value: any) {
  const status = String(value || '').trim().toLowerCase();
  return ['called', 'finished', 'ready', 'complete', 'completed', 'done', 'delivered'].some((word) => status.includes(word));
}

function statusPickedUp(value: any) {
  return String(value || '').trim().toLowerCase().includes('picked up');
}

function displayStatus(value: any) {
  return String(value || '').trim() || 'Not started';
}

function labelModeLabel(mode: ThermalLabelPrintMode) {
  if (mode === 'deer-antler') return 'Deer + Antler Labels';
  if (mode === 'antler') return 'Antler Label';
  return 'Deer Label';
}

type PaymentMethod = 'cash' | 'card' | 'check' | 'other';
type PickupTrack = 'meat' | 'cape' | 'specialty' | 'webbs';
type SearchDetailTab = 'counter' | 'order' | 'contact' | 'messages' | 'history';
type PrimaryActionKind = 'open' | 'print' | 'counter';
type PickupChecklistTone = 'ok' | 'warn' | 'wait';
type PickupChecklistItem = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: PickupChecklistTone;
};

const DETAIL_TABS: Array<{ key: SearchDetailTab; label: string }> = [
  { key: 'counter', label: 'Counter' },
  { key: 'order', label: 'Order' },
  { key: 'contact', label: 'Contact' },
  { key: 'messages', label: 'Messages' },
  { key: 'history', label: 'History' },
];

export default function SearchPage() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState('');
  const [printJob, setPrintJob] = useState<Record<string, any> | null>(null);
  const [printMode, setPrintMode] = useState<'' | 'sheet' | ThermalLabelPrintMode>('');
  const [labelPreviewJob, setLabelPreviewJob] = useState<Record<string, any> | null>(null);
  const [labelPreviewMode, setLabelPreviewMode] = useState<'' | ThermalLabelPrintMode>('');
  const [pendingLabelPrint, setPendingLabelPrint] = useState(0);
  const labelPreviewRef = useRef<HTMLDivElement | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedJob, setSelectedJob] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState('');
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState('');
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [manualChannel, setManualChannel] = useState<'email' | 'sms'>('sms');
  const [manualSubject, setManualSubject] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [specialtyEnabled, setSpecialtyEnabled] = useState(true);
  const [pricing, setPricing] = useState(DEFAULT_SITE_PRICING);
  const [specialtyCatalog, setSpecialtyCatalog] = useState<SpecialtyCatalogItem[]>(defaultSpecialtyCatalog(DEFAULT_SITE_PRICING));
  const [cutOptions, setCutOptions] = useState(normalizeCutOptionSettings({}));
  const [brandingName, setBrandingName] = useState('Wild Game Butcher Board');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('/wgbb-logo.png');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [mobileMatchesOpen, setMobileMatchesOpen] = useState(true);
  const [quickPickupBy, setQuickPickupBy] = useState('');
  const [quickPickupNotes, setQuickPickupNotes] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<PaymentMethod>('cash');
  const [pickupActionBusy, setPickupActionBusy] = useState('');
  const [pickupActionMsg, setPickupActionMsg] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<SearchDetailTab>('counter');
  const debounced = useDebounced(q, 300);

  useEffect(() => {
    fetch('/api/staff/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
        setSmsEnabled(j?.settings?.features?.smsEnabled !== false);
        const nextPricing = normalizePricing(j?.settings?.pricing ?? j?.settings);
        const nextSpecialtyEnabled = j?.settings?.features?.specialtyEnabled !== false;
        setPricing(nextPricing);
        setSpecialtyEnabled(nextSpecialtyEnabled);
        setSpecialtyCatalog(nextSpecialtyEnabled ? normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, nextPricing) : []);
        setCutOptions(normalizeCutOptionSettings(j?.settings?.cutOptions));
        setBrandingName(String(j?.settings?.branding?.name || 'Wild Game Butcher Board'));
        setBrandingLogoUrl(String(j?.settings?.branding?.logoUrl || '/wgbb-logo.png'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/admin/staff-context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setStaffRole((json?.processor?.role as 'admin' | 'staff' | 'readonly' | null) || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const term = debounced.trim();
      if (!term) {
        setRows([]);
        setErr(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await searchJobs(term);
        if (!cancelled) {
          setRows(res.rows || []);
          setMobileMatchesOpen(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Search failed');
          setRows([]);
          setMobileMatchesOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    if (!rows.some((row) => row.tag === selectedTag)) {
      setSelectedTag('');
      setSelectedJob(null);
      setLabelPreviewJob(null);
      setLabelPreviewMode('');
      setDetailErr(null);
      setResendMsg(null);
      setPrintMsg(null);
      setPickupActionMsg(null);
    }
  }, [rows, selectedTag]);

  const openTag = (tag: string, publicToken?: string | null) => {
    if (!tag) return;
    const token = String(publicToken || '').trim();
    router.push(
      staffRole === 'admin' || staffRole === 'staff'
        ? `/intake?tag=${encodeURIComponent(tag)}`
        : token
          ? `/intake/view/${encodeURIComponent(token)}`
          : `/intake/${encodeURIComponent(tag)}`
    );
  };

  const openSelectedRecord = () => {
    if (!selectedTag) return;
    const rowToken = rows.find((row) => row.tag === selectedTag) as any;
    openTag(selectedTag, selectedJob?.publicToken || selectedJob?.public_token || rowToken?.publicToken);
  };

  const loadDetails = async (tag: string) => {
    if (!tag) return;
    setSelectedTag(tag);
    setMobileMatchesOpen(false);
    setDetailLoading(true);
    setDetailErr(null);
    setResendMsg(null);
    setPrintMsg(null);
    setLabelPreviewJob(null);
    setLabelPreviewMode('');
    setPickupActionMsg(null);
    setManualSubject('');
    setManualBody('');
    setDetailTab('counter');
    try {
      const res = await getJob(tag);
      const job = (res?.job || null) as Record<string, any> | null;
      if (!job) throw new Error('Could not load job details.');
      setSelectedJob(job);
    } catch (e: any) {
      setSelectedJob(null);
      setDetailErr(e?.message || 'Could not load job details.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingLabelPrint || !labelPreviewJob || !labelPreviewMode) return;
    const timer = window.setTimeout(() => {
      const labelElement = labelPreviewRef.current?.querySelector('.thermalLabelPrintJob') as HTMLElement | null;
      openElementPrintPreview(labelElement, {
        title: labelModeLabel(labelPreviewMode),
        onAfterPrint: () => setPrinting(''),
        onError: (message) => {
          setErr(message);
          setPrinting('');
        },
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pendingLabelPrint, labelPreviewJob, labelPreviewMode]);

  const printTag = async (tag: string) => {
    if (!tag) return;
    setPrinting(tag);
    setErr(null);
    setPrintMsg(null);
    try {
      const res = await getJob(tag);
      const job = (res?.job || null) as Record<string, any> | null;
      if (!job) throw new Error('Could not load intake sheet for printing.');

      const markRes = await fetch(API_MARK, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...tokenHeader(),
        },
        cache: 'no-store',
        body: JSON.stringify({ tag }),
      });
      const markJson = await markRes.json().catch(() => ({}));
      if (!markJson?.ok) throw new Error(markJson?.error || `HTTP ${markRes.status}`);

      setPrintJob(job);
      setPrintMode('sheet');
      openBrowserPrintPreview(() => {
        setPrintMode('');
        setPrinting('');
      });
      if (selectedTag === tag) {
        await loadDetails(tag);
        setPrintMsg('Intake marked printed. Use Print Options for labels or a reprint.');
      }
    } catch (e: any) {
      setErr(`Could not print this intake sheet. ${e?.message || 'Try again, or open the intake record and print from there.'}`);
      setPrinting('');
    }
  };

  const printLabel = async (tag: string, type: ThermalLabelPrintMode) => {
    if (!tag) return;
    setPrinting(tag);
    setErr(null);
    setPrintMsg(null);
    try {
      const res = await getJob(tag);
      const job = (res?.job || null) as Record<string, any> | null;
      if (!job) throw new Error('Could not load the label details.');
      setLabelPreviewJob(job);
      setLabelPreviewMode(type);
      setPendingLabelPrint((value) => value + 1);
    } catch (e: any) {
      setErr(`Could not print that label. ${e?.message || 'Try again, or open the intake record and print from there.'}`);
      setPrinting('');
    }
  };

  const preferredContact = useMemo(() => {
    if (!selectedJob) return '-';
    if (selectedJob.prefSMS) {
      if (!smsEnabled) return 'Text selected before SMS was turned off';
      return selectedJob.smsConsent ? 'Text (SMS)' : 'Text selected, no consent';
    }
    if (selectedJob.prefEmail) return 'Email';
    if (selectedJob.prefCall) return 'Phone Call';
    return 'Not selected';
  }, [selectedJob, smsEnabled]);

  const paymentSummary = useMemo(() => {
    if (!selectedJob) return '-';
    const procDue = processingDue(selectedJob);
    const specDue = specialtyEnabled ? specialtyDue(selectedJob) : 0;
    const procMethod = String(selectedJob.paymentMethodProcessing ?? selectedJob.payment_method_processing ?? '').trim();
    const specMethod = String(selectedJob.paymentMethodSpecialty ?? selectedJob.payment_method_specialty ?? '').trim();
    const proc = procDue <= 0
      ? `Processing paid${procMethod ? ` (${procMethod})` : ''}`
      : procDue < Number(selectedJob.priceProcessing ?? selectedJob.price_processing ?? 0)
        ? `Processing partial${procMethod ? ` (${procMethod})` : ''}`
        : 'Processing unpaid';
    const spec = specialtyEnabled && selectedJob.specialtyProducts
      ? specDue <= 0
        ? `Specialty paid${specMethod ? ` (${specMethod})` : ''}`
        : specDue < Number(selectedJob.priceSpecialty ?? selectedJob.price_specialty ?? 0)
          ? `Specialty partial${specMethod ? ` (${specMethod})` : ''}`
          : 'Specialty unpaid'
      : null;
    return [proc, spec].filter(Boolean).join(' | ');
  }, [selectedJob, specialtyEnabled]);

  const pickupQuickView = useMemo(() => {
    if (!selectedJob) return null;
    const procDue = processingDue(selectedJob);
    const specDue = specialtyEnabled ? specialtyDue(selectedJob) : 0;
    const due = procDue + specDue;
    const processingStatus = displayStatus(selectedJob.status);
    const capeStatus = displayStatus(selectedJob.capingStatus ?? selectedJob.caping_status);
    const specialtyStatus = displayStatus(selectedJob.specialtyStatus ?? selectedJob.specialty_status);
    const webbsStatus = displayStatus(selectedJob.webbsStatus ?? selectedJob.webbs_status);
    const processingPickedUp = !!(selectedJob.pickedUpProcessing ?? selectedJob.picked_up_processing);
    const capePickedUp = !!(selectedJob.pickedUpCape ?? selectedJob.picked_up_cape);
    const webbsPickedUp = !!(selectedJob.pickedUpWebbs ?? selectedJob.picked_up_webbs);
    const specialtyPickedUp = statusPickedUp(specialtyStatus);
    const processingReady = statusReadyLike(processingStatus);
    const capeReady = statusReadyLike(capeStatus);
    const specialtyReady = statusReadyLike(specialtyStatus);
    const webbsReady = statusReadyLike(webbsStatus);
    const hasCape = canPrintCapeLabel(selectedJob);
    const hasSpecialty =
      specialtyEnabled &&
      (!!selectedJob.specialtyProducts ||
        Number(selectedJob.priceSpecialty ?? selectedJob.price_specialty ?? 0) > 0 ||
        String(selectedJob.specialtyStatus ?? selectedJob.specialty_status ?? '').trim().length > 0);
    const hasWebbs = webbsEnabled && !!selectedJob.webbsOrder;
    const pickupState = processingPickedUp
      ? 'Processing picked up'
      : String(selectedJob.status || '').toLowerCase().includes('called')
        ? 'Ready for pickup'
        : processingReady
          ? 'Ready to contact'
          : 'Still in process';
    const pickedUpBy = String(selectedJob.pickedUpBy ?? selectedJob.picked_up_by ?? '').trim();
    const pickupNotes = String(selectedJob.pickupNotes ?? selectedJob.pickup_notes ?? '').trim();
    return {
      due,
      procDue,
      specDue,
      pickupState,
      processingStatus,
      capeStatus,
      specialtyStatus,
      webbsStatus,
      processingReady,
      capeReady,
      specialtyReady,
      webbsReady,
      processingPickedUp,
      capePickedUp,
      specialtyPickedUp,
      webbsPickedUp,
      hasCape,
      hasSpecialty,
      hasWebbs,
      pickedUpBy,
      pickupNotes,
    };
  }, [selectedJob, specialtyEnabled, webbsEnabled]);

  const pickupChecklist = useMemo<PickupChecklistItem[]>(() => {
    if (!selectedJob || !pickupQuickView) return [];
    const handoffItem = (
      key: string,
      label: string,
      pickedUp: boolean,
      ready: boolean,
      status: string,
      readyDetail: string,
      waitDetail: string
    ): PickupChecklistItem => {
      if (pickedUp) {
        return { key, label, value: 'Done', detail: 'Already marked picked up.', tone: 'ok' };
      }
      if (ready) {
        return { key, label, value: 'Ready', detail: readyDetail, tone: 'warn' };
      }
      return { key, label, value: 'Not ready', detail: `${waitDetail} Current status: ${displayStatus(status)}.`, tone: 'wait' };
    };

    const items: PickupChecklistItem[] = [
      {
        key: 'processing-payment',
        label: 'Processing payment',
        value: pickupQuickView.procDue > 0 ? `${money(pickupQuickView.procDue)} due` : 'Paid',
        detail: pickupQuickView.procDue > 0 ? 'Collect this before the processing order leaves.' : 'Processing balance is clear.',
        tone: pickupQuickView.procDue > 0 ? 'warn' : 'ok',
      },
      handoffItem(
        'processing-handoff',
        'Processing handoff',
        pickupQuickView.processingPickedUp,
        pickupQuickView.processingReady,
        pickupQuickView.processingStatus,
        'Meat can leave once payment is handled.',
        'Do not mark processing picked up until the meat is actually ready.'
      ),
    ];

    if (pickupQuickView.hasSpecialty) {
      items.push({
        key: 'specialty-payment',
        label: 'Specialty payment',
        value: pickupQuickView.specDue > 0 ? `${money(pickupQuickView.specDue)} due` : 'Paid',
        detail: pickupQuickView.specDue > 0 ? 'Collect this before specialty products leave.' : 'Specialty balance is clear.',
        tone: pickupQuickView.specDue > 0 ? 'warn' : 'ok',
      });
      items.push(
        handoffItem(
          'specialty-handoff',
          'Specialty handoff',
          pickupQuickView.specialtyPickedUp,
          pickupQuickView.specialtyReady,
          pickupQuickView.specialtyStatus,
          'Specialty products are ready to leave.',
          'Specialty products are still being worked or waiting to be marked finished.'
        )
      );
    }

    if (pickupQuickView.hasCape) {
      items.push(
        handoffItem(
          'cape-handoff',
          'Cape handoff',
          pickupQuickView.capePickedUp,
          pickupQuickView.capeReady,
          pickupQuickView.capeStatus,
          'Cape can leave with the customer.',
          'Cape is not marked ready yet.'
        )
      );
    }

    if (pickupQuickView.hasWebbs) {
      items.push(
        handoffItem(
          'webbs-handoff',
          'Webbs handoff',
          pickupQuickView.webbsPickedUp,
          pickupQuickView.webbsReady,
          pickupQuickView.webbsStatus,
          'Webbs order is ready to leave.',
          'Webbs order is not marked delivered yet.'
        )
      );
    }

    return items;
  }, [selectedJob, pickupQuickView]);

  const pickupWarnCount = pickupChecklist.filter((item) => item.tone === 'warn').length;
  const pickupWaitCount = pickupChecklist.filter((item) => item.tone === 'wait').length;
  const pickupChecklistSummary = pickupWarnCount > 0
    ? `Finish ${pickupWarnCount} counter ${pickupWarnCount === 1 ? 'item' : 'items'} before the customer leaves.`
    : pickupWaitCount > 0
      ? 'Nothing urgent to collect right now, but some pieces are not ready yet.'
      : 'Everything on the counter checklist is complete.';

  useEffect(() => {
    if (!selectedJob) {
      setQuickPickupBy('');
      setQuickPickupNotes('');
      setQuickPaymentMethod('cash');
      return;
    }
    setQuickPickupBy(String(selectedJob.pickedUpBy ?? selectedJob.picked_up_by ?? '').trim());
    setQuickPickupNotes(String(selectedJob.pickupNotes ?? selectedJob.pickup_notes ?? '').trim());
    const method = String(
      selectedJob.paymentMethodProcessing ??
      selectedJob.payment_method_processing ??
      selectedJob.paymentMethodSpecialty ??
      selectedJob.payment_method_specialty ??
      ''
    ).trim().toLowerCase();
    if (method === 'cash' || method === 'card' || method === 'check' || method === 'other') {
      setQuickPaymentMethod(method);
      return;
    }
    setQuickPaymentMethod('cash');
  }, [selectedJob]);

  const notificationRows = useMemo(() => {
    if (!selectedJob) return [];
    return [
      { label: 'Drop-Off Tagged', email: selectedJob.dropoffEmailSentAt, sms: selectedJob.dropoffSmsSentAt },
      { label: 'Meat Finished', email: selectedJob.meatFinishedEmailSentAt, sms: selectedJob.meatFinishedSmsSentAt },
      { label: 'Cape Finished', email: selectedJob.capeFinishedEmailSentAt, sms: selectedJob.capeFinishedSmsSentAt },
      { label: 'Specialty Finished', email: selectedJob.specialtyFinishedEmailSentAt, sms: selectedJob.specialtyFinishedSmsSentAt },
      { label: 'Webbs Delivered', email: selectedJob.webbsDeliveredEmailSentAt, sms: selectedJob.webbsDeliveredSmsSentAt },
    ].filter((row) =>
      (webbsEnabled || row.label !== 'Webbs Delivered') &&
      (specialtyEnabled || row.label !== 'Specialty Finished')
    );
  }, [selectedJob, webbsEnabled, specialtyEnabled]);

  const latestNotificationAt = useMemo(() => {
    const values = notificationRows.flatMap((row) => [row.email, row.sms]).filter(Boolean) as string[];
    if (!values.length) return null;
    return values.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [notificationRows]);

  const canShowResults = q.trim().length > 0;
  const canEdit = staffRole === 'admin' || staffRole === 'staff';
  const canManageNotifications = staffRole === 'admin';
  const canManualEmail = !!selectedJob?.email;
  const canManualSms = smsEnabled && !!selectedJob?.phone && !!selectedJob?.smsConsent;
  const visibleDetailTabs = useMemo(
    () => canManageNotifications ? DETAIL_TABS : DETAIL_TABS.filter((tab) => tab.key !== 'messages'),
    [canManageNotifications]
  );
  const statusSummary = selectedJob
    ? [selectedJob.status || 'No meat status', selectedJob.capingStatus ? `Cape: ${selectedJob.capingStatus}` : null]
        .filter(Boolean)
        .join(' | ')
    : '-';
  const selectedSearchAddOns = useMemo(() => {
    if (!selectedJob) return [];
    return filterVisibleAddOnItems(
      normalizeJobAddOnItems(
        selectedJob.addOnItems ||
          selectedJob.add_on_items ||
          [
            selectedJob.beefFat ? { slug: 'beef-fat', name: 'Beef Fat', selected: true, price: 5, sortOrder: 10, legacyBooleanKey: 'beefFat' } : null,
            selectedJob.webbsOrder ? { slug: 'webbs-order', name: 'Webbs Add-On', selected: true, price: 20, sortOrder: 20, legacyBooleanKey: 'webbsOrder' } : null,
          ].filter(Boolean)
      ).filter((item) => item.selected),
      webbsEnabled
    );
  }, [selectedJob, webbsEnabled]);
  const selectedSearchSpecialtyItems = useMemo(() => {
    if (!selectedJob || !specialtyEnabled) return [];
    return specialtyBreakdown(selectedJob, pricing, specialtyCatalog).filter((item) => item.pounds > 0);
  }, [selectedJob, specialtyEnabled, pricing, specialtyCatalog]);

  useEffect(() => {
    if (!visibleDetailTabs.some((tab) => tab.key === detailTab)) {
      setDetailTab('counter');
    }
  }, [detailTab, visibleDetailTabs]);

  useEffect(() => {
    if (!selectedJob) return;
    if (selectedJob.prefSMS && selectedJob.smsConsent && canManualSms) {
      setManualChannel('sms');
      return;
    }
    if (selectedJob.prefEmail && canManualEmail) {
      setManualChannel('email');
      return;
    }
    if (canManualEmail) {
      setManualChannel('email');
      return;
    }
    if (canManualSms) {
      setManualChannel('sms');
    }
  }, [selectedJob, canManualEmail, canManualSms]);

  const sendManualMessage = async () => {
    if (!selectedTag || !manualBody.trim()) {
      setResendMsg('Enter a message before sending.');
      return;
    }
    setManualBusy(true);
    setResendMsg(null);
    try {
      const res = await fetch(API_MANUAL_MESSAGE, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...tokenHeader(),
        },
        cache: 'no-store',
        body: JSON.stringify({
          tag: selectedTag,
          channel: manualChannel,
          subject: manualChannel === 'email' ? manualSubject : '',
          message: manualBody,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setResendMsg(`Sent manual ${manualChannel === 'email' ? 'email' : 'text'} to ${json.destination}.`);
      setManualBody('');
      if (manualChannel === 'email') setManualSubject('');
    } catch (e: any) {
      setResendMsg(`Could not send that message. ${e?.message || 'Check the contact method and try again.'}`);
    } finally {
      setManualBusy(false);
    }
  };
  const quickFacts = selectedJob
    ? [
        { label: 'Last Printed', value: fmtDate(selectedJob.intakeSheetPrintedAt) },
        { label: 'Print Count', value: selectedJob.intakeSheetPrintCount ?? 0 },
        { label: 'Last Updated', value: fmtDate(selectedJob.updatedAt) },
      ]
    : [];
  const balanceStatusText = selectedJob
    ? paymentSummary.toLowerCase().includes('partial')
      ? 'Partial payment'
      : paymentSummary.toLowerCase().includes('unpaid')
        ? 'Collect at pickup'
        : 'Paid in full'
    : '-';
  const summaryFacts = selectedJob
    ? [
        { label: 'Status', value: statusSummary },
        { label: 'Balance', value: pickupQuickView ? (pickupQuickView.due > 0 ? `${money(pickupQuickView.due)} due` : 'Paid') : '-' },
        { label: 'Contact', value: preferredContact },
        { label: 'Last Printed', value: fmtDate(selectedJob.intakeSheetPrintedAt) },
      ]
    : [];
  const nextAction = useMemo(() => {
    if (!selectedJob) return '';
    const status = String(selectedJob.status || '').toLowerCase();
    const due = processingDue(selectedJob) + (specialtyEnabled ? specialtyDue(selectedJob) : 0);
    if (!selectedJob.tag || String(selectedJob.tag).toUpperCase().startsWith('PENDING-')) return 'Assign the permanent tag after reviewing the intake.';
    if (status.includes('called')) return due > 0 ? 'Collect the remaining balance at pickup.' : 'Ready for pickup handoff.';
    if (status.includes('finished') || status.includes('ready')) return 'Contact the customer and move this deer into pickup follow-up.';
    return 'Open the intake record to update statuses, print paperwork, or review instructions.';
  }, [selectedJob, specialtyEnabled]);
  const selectedPrimaryAction = useMemo((): { label: string; kind: PrimaryActionKind } => {
    if (!selectedJob) return { label: canEdit ? 'Open Intake' : 'Open Details', kind: 'open' };
    if (!canEdit) return { label: 'Open Details', kind: 'open' };

    const tag = String(selectedJob.tag || '').trim().toUpperCase();
    const missingTag = !tag || tag.startsWith('PENDING-');
    const status = String(selectedJob.status || '').toLowerCase();
    const hasPickupWork = !!pickupQuickView && (
      !pickupQuickView.processingPickedUp ||
      (canPrintCapeLabel(selectedJob) && !pickupQuickView.capePickedUp) ||
      (pickupQuickView.hasSpecialty && pickupQuickView.specialtyReady && !pickupQuickView.specialtyPickedUp) ||
      (webbsEnabled && selectedJob.webbsOrder && !pickupQuickView.webbsPickedUp)
    );

    if (missingTag) return { label: 'Assign Tag', kind: 'open' };
    if (!selectedJob.intakeSheetPrintedAt) return { label: 'Print Intake', kind: 'print' };
    if (pickupQuickView && pickupQuickView.due > 0) return { label: 'Collect Payment', kind: 'counter' };
    if ((status.includes('called') || status.includes('finished') || status.includes('ready')) && hasPickupWork) {
      return { label: 'Record Pickup', kind: 'counter' };
    }
    return { label: 'Update Intake', kind: 'open' };
  }, [selectedJob, canEdit, pickupQuickView, webbsEnabled]);
  const resultSummary = loading
    ? 'Searching...'
    : !canShowResults
      ? 'Search by tag, name, phone, or confirmation number.'
      : rows.length === 0
        ? 'No matching deer found.'
        : `${rows.length} matching ${rows.length === 1 ? 'deer' : 'deer'} found.`;

  const resendNotification = async (event: ResendEventKey) => {
    if (!selectedTag) return;
    setResendBusy(event);
    setResendMsg(null);
    try {
      const res = await fetch(API_RESEND, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...tokenHeader(),
        },
        cache: 'no-store',
        body: JSON.stringify({ tag: selectedTag, event }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await loadDetails(selectedTag);
      setResendMsg(`Resent ${labelForEvent(event)} by ${json.channel} to ${json.destination}.`);
    } catch (e: any) {
      setResendMsg(`Could not resend that notification. ${e?.message || 'Try again, or send a manual update instead.'}`);
    } finally {
      setResendBusy('');
    }
  };

  const resetNotification = async (event: ResendEventKey) => {
    if (!selectedTag) return;
    const confirmed = window.confirm(`Reset the ${labelForEvent(event)} sent flags for ${selectedTag}? This lets it show as unsent again.`);
    if (!confirmed) return;
    setResetBusy(event);
    setResendMsg(null);
    try {
      const res = await fetch(API_RESET, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...tokenHeader(),
        },
        cache: 'no-store',
        body: JSON.stringify({ tag: selectedTag, event }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await loadDetails(selectedTag);
      setResendMsg(`Reset ${labelForEvent(event)} notification flags.`);
    } catch (e: any) {
      setResendMsg(`Could not reset those notification flags. ${e?.message || 'Try again.'}`);
    } finally {
      setResetBusy('');
    }
  };

  const markUnprinted = async () => {
    if (!selectedTag) return;
    const confirmed = window.confirm(`Mark ${selectedTag} as unprinted so it returns to the print queue?`);
    if (!confirmed) return;
    setPrintMsg(null);
    try {
      const res = await fetch(API_UNPRINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...tokenHeader(),
        },
        cache: 'no-store',
        body: JSON.stringify({ tag: selectedTag }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await loadDetails(selectedTag);
      setPrintMsg('Returned to the print queue.');
    } catch (e: any) {
      setPrintMsg(`Could not send this deer back to the print queue. ${e?.message || 'Try again, or print directly from this page.'}`);
    }
  };

  const recordQuickPayment = async (kind: 'processing' | 'specialty') => {
    if (!selectedJob || !selectedTag) return;
    const due = kind === 'processing' ? processingDue(selectedJob) : specialtyDue(selectedJob);
    if (due <= 0) {
      setPickupActionMsg(`${kind === 'processing' ? 'Processing' : 'Specialty'} is already paid in full.`);
      return;
    }
    const currentPaid = Number(
      kind === 'processing'
        ? (selectedJob.amountPaidProcessing ?? selectedJob.amount_paid_processing ?? 0)
        : (selectedJob.amountPaidSpecialty ?? selectedJob.amount_paid_specialty ?? 0)
    ) || 0;
    setPickupActionBusy(kind);
    setPickupActionMsg(null);
    try {
      await saveJob(
        kind === 'processing'
          ? ({
              tag: selectedTag,
              amountPaidProcessing: currentPaid + due,
              paidProcessing: true,
              paymentMethodProcessing: quickPaymentMethod,
            } as any)
          : ({
              tag: selectedTag,
              amountPaidSpecialty: currentPaid + due,
              paidSpecialty: true,
              paymentMethodSpecialty: quickPaymentMethod,
            } as any)
      );
      await loadDetails(selectedTag);
      setPickupActionMsg(`Marked ${kind} paid in full by ${quickPaymentMethod}.`);
    } catch (e: any) {
      setPickupActionMsg(`Could not update ${kind} payment. ${e?.message || 'Try again.'}`);
    } finally {
      setPickupActionBusy('');
    }
  };

  const markTrackPickedUp = async (track: PickupTrack) => {
    if (!selectedTag) return;
    setPickupActionBusy(`pickup-${track}`);
    setPickupActionMsg(null);
    const now = new Date().toISOString();
    const shared = {
      pickedUpBy: quickPickupBy.trim() || null,
      pickupNotes: quickPickupNotes.trim() || null,
    };
    try {
      if (track === 'meat') {
        await saveJob({ tag: selectedTag, status: 'Picked Up', pickedUpProcessing: true, pickedUpProcessingAt: now, ...shared } as any);
      } else if (track === 'cape') {
        await saveJob({ tag: selectedTag, capingStatus: 'Picked Up', pickedUpCape: true, pickedUpCapeAt: now, ...shared } as any);
      } else if (track === 'specialty') {
        await saveJob({ tag: selectedTag, specialtyStatus: 'Picked Up', ...shared } as any);
      } else {
        await saveJob({ tag: selectedTag, webbsStatus: 'Picked Up', pickedUpWebbs: true, pickedUpWebbsAt: now, ...shared } as any);
      }
      await loadDetails(selectedTag);
      setPickupActionMsg(`Marked ${track === 'meat' ? 'processing' : track} pickup complete.`);
    } catch (e: any) {
      setPickupActionMsg(`Could not mark ${track} pickup. ${e?.message || 'Try again.'}`);
    } finally {
      setPickupActionBusy('');
    }
  };

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="app-kicker">Staff Workflow</div>
            <h1 className="app-title">Search</h1>
            <p className="app-copy">
              Find a deer fast, review the order, print paperwork, send updates, and open the full record when you need to make changes.
            </p>
          </div>
          <div className="app-side-note">
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d8c3a1' }}>
              Quick Tip
            </div>
            <div style={{ color: 'rgba(245,236,216,.9)', lineHeight: 1.55 }}>
              Start with a <b>tag</b>, <b>customer name</b>, <b>phone number</b>, or <b>confirmation number</b>. You can also type <code>@report</code> for ready-to-call or <code>@recall</code> for the pickup queue.
            </div>
          </div>
        </div>
      </section>

      <div className="app-surface-light search-toolbar" style={{ padding: 14 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tag, customer name, phone, or confirmation #"
            aria-label="Search query"
            style={{ flex: 1, minWidth: 240 }}
          />
          <button className="btn" type="submit">Search</button>
          <div className="search-toolbar-summary">{resultSummary}</div>
        </form>
      </div>

      {selectedJob ? (
        <div className="app-surface-light search-mobile-selected">
          <div className="search-mobile-selected-top">
            <div>
              <div className="search-mobile-selected-kicker">Selected Deer</div>
              <div className="search-mobile-selected-title">{selectedJob.customer || selectedTag}</div>
              <div className="search-mobile-selected-meta">
                {selectedTag ? `Tag ${selectedTag}` : 'No tag assigned'}
                {pickupQuickView ? ` | ${pickupQuickView.pickupState}` : ''}
              </div>
            </div>
            <div className={`search-mobile-balance-chip ${pickupQuickView && pickupQuickView.due > 0 ? 'warn' : 'ok'}`}>
              {pickupQuickView ? (pickupQuickView.due > 0 ? `${money(pickupQuickView.due)} due` : 'Paid') : '-'}
            </div>
          </div>
          <div className="search-mobile-selected-actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (selectedPrimaryAction.kind === 'print') {
                  selectedTag && void printTag(selectedTag);
                  return;
                }
                if (selectedPrimaryAction.kind === 'counter') {
                  setDetailTab('counter');
                  return;
                }
                openSelectedRecord();
              }}
              disabled={!selectedTag || (selectedPrimaryAction.kind === 'print' && printing === selectedTag)}
            >
              {selectedPrimaryAction.kind === 'print' && printing === selectedTag ? 'Preparing...' : selectedPrimaryAction.label}
            </button>
            <button className="btn secondary mobile-only-inline" type="button" onClick={() => setMobileMatchesOpen((prev) => !prev)}>
              {mobileMatchesOpen ? 'Hide Matches' : 'Show Matches'}
            </button>
          </div>
        </div>
      ) : null}

      {!canShowResults && (
        <div className="app-surface-light searchEmptyState">
          <div className="searchEmptyKicker">Ready To Search</div>
          <div className="searchEmptyTitle">Find a deer by whatever you have.</div>
          <div className="searchEmptyText">
            Type a tag, customer name, phone number, or confirmation number. Matching deer will appear here.
          </div>
          <div className="searchEmptyChips">
            <span>Tag</span>
            <span>Name</span>
            <span>Phone</span>
            <span>Confirmation</span>
          </div>
        </div>
      )}

      {canShowResults && (
        <div className="search-layout">
          <section className="search-results-col" id="search-results">
            <div className="app-surface-light results-summary-card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.72 }}>Results</div>
              <div style={{ fontSize: 17, fontWeight: 900, marginTop: 2 }}>
                {resultSummary}
              </div>
              {selectedJob ? (
                <button
                  type="button"
                  className="btn secondary search-mobile-toggle"
                  onClick={() => setMobileMatchesOpen((prev) => !prev)}
                >
                  {mobileMatchesOpen ? 'Hide Match List' : 'Show Match List'}
                </button>
              ) : null}
            </div>
            {loading && <div className="app-surface-light" style={{ padding: 16, color: '#334155' }}>Loading...</div>}
            {err && <div className="app-surface-light" style={{ padding: 16, borderColor: '#ef4444', color: '#7f1d1d' }}>Error: {err}</div>}

            {!loading && !err && (
              <div className="app-surface-light search-results-card" style={{ padding: 0 }}>
                <table className="table search-results-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 88 }}>Tag</th>
                      <th>Customer</th>
                      <th style={{ width: 122 }}>Phone</th>
                      <th style={{ width: 104 }}>Drop-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <div className="searchEmptyState compact">
                            <div className="searchEmptyTitle">No matching deer found.</div>
                            <div className="searchEmptyText">Check the spelling or try a phone number, confirmation number, or shorter part of the name.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr
                        key={r.tag}
                        onClick={() => void loadDetails(r.tag!)}
                        onDoubleClick={() => openTag(r.tag!, (r as any).publicToken)}
                        className={`search-result-row ${r.tag === selectedTag ? 'selected' : ''}`}
                      >
                        <td className="search-tag-cell"><strong><HighlightText text={r.tag || '-'} query={q} /></strong></td>
                        <td className="search-customer-cell">
                          <div className="search-customer-name"><HighlightText text={r.customer || '-'} query={q} /></div>
                          <div className="search-confirmation-line">
                            {r.confirmation ? <>Confirmation <HighlightText text={r.confirmation} query={q} /></> : 'No confirmation recorded'}
                          </div>
                          <div className="search-row-badges">
                            {rowBadges(r as any).map((badge) => (
                              <span key={`${r.tag}-${badge}`} className="search-row-badge">{badge}</span>
                            ))}
                          </div>
                        </td>
                        <td className="search-phone-cell"><HighlightText text={r.phone || '-'} query={q} /></td>
                        <td>{formatDisplayDate(r.dropoff || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={`search-results-mobile ${mobileMatchesOpen ? '' : 'collapsed'}`}>
                  {rows.length === 0 ? (
                    <div className="searchEmptyState compact">
                      <div className="searchEmptyTitle">No matching deer found.</div>
                      <div className="searchEmptyText">Check the spelling or try a phone number, confirmation number, or shorter part of the name.</div>
                    </div>
                  ) : (
                    rows.map((r) => (
                      <button
                        key={`mobile-${r.tag}`}
                        type="button"
                        onClick={() => void loadDetails(r.tag!)}
                        onDoubleClick={() => openTag(r.tag!, (r as any).publicToken)}
                        className={`search-result-mobile-card ${r.tag === selectedTag ? 'selected' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', opacity: 0.66 }}>Tag</div>
                            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}><HighlightText text={r.tag || '-'} query={q} /></div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', opacity: 0.66 }}>Drop-off</div>
                            <div style={{ marginTop: 2, fontWeight: 700 }}>{formatDisplayDate(r.dropoff || '')}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <div style={{ fontWeight: 800 }}><HighlightText text={r.customer || '-'} query={q} /></div>
                          <div className="muted" style={{ fontSize: 13 }}><HighlightText text={r.phone || '-'} query={q} /></div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.confirmation ? <>Confirmation <HighlightText text={r.confirmation} query={q} /></> : 'No confirmation recorded'}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {rowBadges(r as any).map((badge) => (
                              <span key={`mobile-${r.tag}-${badge}`} style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#eef2ff', color: '#334155' }}>{badge}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="search-preview-col">
            <div className="app-surface-light search-preview-card" style={{ padding: 18, display: 'grid', gap: 14 }}>
              <div className="selectedSummary">
                <div className="selectedSummaryTop">
                  <div>
                    <div className="selectedSummaryKicker">Selected Deer</div>
                    <div className="selectedSummaryTitle">{selectedJob?.customer || selectedTag || 'Select a deer'}</div>
                    <div className="selectedSummaryMeta">
                      {selectedTag ? `Tag ${selectedTag}` : 'Select a deer'}
                      {selectedJob?.confirmation ? ` | Confirmation ${selectedJob.confirmation}` : ''}
                    </div>
                  </div>
                  {pickupQuickView ? (
                    <div className={`selectedBalanceBadge ${pickupQuickView.due > 0 ? 'warn' : 'ok'}`}>
                      {pickupQuickView.due > 0 ? `${money(pickupQuickView.due)} due` : 'Paid'}
                    </div>
                  ) : null}
                </div>

                {selectedJob ? (
                  <>
                    <div className="selectedSummaryFacts">
                      {summaryFacts.map((fact) => (
                        <div className="selectedSummaryFact" key={fact.label}>
                          <div className="selectedSummaryFactLabel">{fact.label}</div>
                          <div className="selectedSummaryFactValue">{fact.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="nextActionCard">
                      <div className="nextActionLabel">Next Best Action</div>
                      <div className="nextActionText">{nextAction}</div>
                    </div>

                    <div className="selectedPrimaryActions">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          if (selectedPrimaryAction.kind === 'print') {
                            selectedTag && void printTag(selectedTag);
                            return;
                          }
                          if (selectedPrimaryAction.kind === 'counter') {
                            setDetailTab('counter');
                            return;
                          }
                          openSelectedRecord();
                        }}
                        disabled={!selectedTag || (selectedPrimaryAction.kind === 'print' && printing === selectedTag)}
                      >
                        {selectedPrimaryAction.kind === 'print' && printing === selectedTag ? 'Preparing...' : selectedPrimaryAction.label}
                      </button>
                      {selectedPrimaryAction.kind !== 'open' ? (
                        <button className="btn secondary" type="button" onClick={openSelectedRecord} disabled={!selectedTag}>
                          {canEdit ? 'Open Intake' : 'Open Details'}
                        </button>
                      ) : null}
                      {selectedPrimaryAction.kind !== 'print' ? (
                        <button className="btn secondary" type="button" onClick={() => selectedTag && void printTag(selectedTag)} disabled={!selectedTag || printing === selectedTag}>
                          {printing === selectedTag ? 'Preparing...' : 'Print Intake'}
                        </button>
                      ) : null}
                      {canEdit && selectedPrimaryAction.kind !== 'counter' ? (
                        <button className="btn secondary" type="button" onClick={() => setDetailTab('counter')}>
                          Counter
                        </button>
                      ) : null}
                    </div>

                    <details className="printOptionsDisclosure">
                      <summary>
                        <span>Print Options</span>
                        <span>{selectedJob.intakeSheetPrintCount ? `${selectedJob.intakeSheetPrintCount} printed` : 'Labels and reprint tools'}</span>
                      </summary>
                      <div className="printOptionsList">
                        <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'deer')} disabled={!selectedTag || printing === selectedTag}>
                          Deer Label
                        </button>
                        {canPrintAntlerLabel(selectedJob) ? (
                          <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'deer-antler')} disabled={!selectedTag || printing === selectedTag}>
                            Deer + Antler
                          </button>
                        ) : null}
                        {canPrintAntlerLabel(selectedJob) ? (
                          <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'antler')} disabled={!selectedTag || printing === selectedTag}>
                            Antler Tag
                          </button>
                        ) : null}
                        {canEdit && selectedJob?.intakeSheetPrintedAt ? (
                          <button className="btn secondary" type="button" onClick={() => void markUnprinted()} disabled={!selectedJob?.intakeSheetPrintedAt}>
                            Mark Unprinted
                          </button>
                        ) : null}
                      </div>
                    </details>
                    {printMsg ? <div className={`statusFeedback ${printMsg.startsWith('Could not') ? 'err' : 'ok'}`}>{printMsg}</div> : null}
                  </>
                ) : null}
              </div>

              {detailLoading ? <div className="muted">Loading details...</div> : null}
              {detailErr ? <div className="card" style={{ borderColor: '#ef4444' }}>Error: {detailErr}</div> : null}

              {!selectedJob && !detailLoading && !detailErr ? (
                <div className="muted" style={{ padding: '8px 0' }}>
                  Choose a result on the left to see contact details, print history, and available actions.
                </div>
              ) : null}

              {selectedJob ? (
                <>
                  <div className="detailTabs" role="tablist" aria-label="Selected deer details">
                    {visibleDetailTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={detailTab === tab.key}
                        className={`detailTab ${detailTab === tab.key ? 'active' : ''}`}
                        onClick={() => setDetailTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {detailTab === 'counter' ? (
                    <div className="detailTabPanel">
                      {pickupQuickView ? (
                        <DetailBox title="Counter">
                          <div className="pickupQuickGrid">
                            <div className="pickupQuickCard">
                              <div className="pickupQuickLabel">Total due</div>
                              <div className="pickupQuickValue">{money(pickupQuickView.due)}</div>
                              <div className="pickupQuickSub">
                                {pickupQuickView.due > 0 ? 'Collect at pickup' : 'Nothing left to collect'}
                              </div>
                            </div>
                            <div className="pickupQuickCard">
                              <div className="pickupQuickLabel">Pickup stage</div>
                              <div className="pickupQuickValue">{pickupQuickView.pickupState}</div>
                              <div className="pickupQuickSub">
                                {pickupQuickView.processingPickedUp ? 'Processing already picked up' : 'Still waiting on handoff'}
                              </div>
                            </div>
                          </div>

                          <div className={`pickupChecklistSummary ${pickupWarnCount > 0 ? 'warn' : pickupWaitCount > 0 ? 'wait' : 'ok'}`}>
                            <div>
                              <div className="pickupChecklistSummaryLabel">Before customer leaves</div>
                              <div className="pickupChecklistSummaryText">{pickupChecklistSummary}</div>
                            </div>
                            <div className="pickupChecklistSummaryCount">
                              {pickupWarnCount > 0 ? `${pickupWarnCount} left` : 'Clear'}
                            </div>
                          </div>

                          <div className="pickupChecklist" aria-label="Pickup counter checklist">
                            {pickupChecklist.map((item) => (
                              <div className={`pickupChecklistItem ${item.tone}`} key={item.key}>
                                <div className="pickupChecklistMain">
                                  <div className="pickupChecklistTitle">{item.label}</div>
                                  <div className="pickupChecklistDetail">{item.detail}</div>
                                </div>
                                <div className="pickupChecklistState">{item.value}</div>
                              </div>
                            ))}
                          </div>

                          <details className="compactDisclosure">
                            <summary>
                              <span>Payment and pickup details</span>
                              <span>{balanceStatusText}</span>
                            </summary>
                            <div className="pickupQuickBreakdown">
                              <div><strong>Status:</strong> {statusSummary}</div>
                              <div><strong>Balance status:</strong> {balanceStatusText}</div>
                              <div><strong>Processing due:</strong> {money(pickupQuickView.procDue)}</div>
                              {specialtyEnabled ? <div><strong>Specialty due:</strong> {money(pickupQuickView.specDue)}</div> : null}
                              <div><strong>Processing paid:</strong> {money(Number(selectedJob.amountPaidProcessing ?? selectedJob.amount_paid_processing ?? 0))}</div>
                              {specialtyEnabled ? <div><strong>Specialty paid:</strong> {money(Number(selectedJob.amountPaidSpecialty ?? selectedJob.amount_paid_specialty ?? 0))}</div> : null}
                              <div><strong>Processing pickup:</strong> {pickupQuickView.processingPickedUp ? 'Picked up' : 'Not picked up'}</div>
                              <div><strong>Cape pickup:</strong> {pickupQuickView.capePickedUp ? 'Picked up' : 'Not picked up'}</div>
                              {pickupQuickView.hasSpecialty ? <div><strong>Specialty pickup:</strong> {pickupQuickView.specialtyPickedUp ? 'Picked up' : 'Not picked up'}</div> : null}
                              {webbsEnabled && selectedJob.webbsOrder ? <div><strong>Webbs pickup:</strong> {pickupQuickView.webbsPickedUp ? 'Picked up' : 'Not picked up'}</div> : null}
                              <div><strong>Picked up by:</strong> {pickupQuickView.pickedUpBy || 'Not recorded'}</div>
                            </div>

                            {pickupQuickView.pickupNotes ? (
                              <div className="pickupQuickNotes">
                                <strong>Pickup notes:</strong> {pickupQuickView.pickupNotes}
                              </div>
                            ) : null}
                          </details>

                          {canEdit ? (
                            <div className="pickupQuickActions">
                              <div className="pickupQuickActionGrid">
                                <label className="pickupQuickField">
                                  <span>Payment method</span>
                                  <select value={quickPaymentMethod} onChange={(e) => setQuickPaymentMethod(e.target.value as PaymentMethod)}>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="check">Check</option>
                                    <option value="other">Other</option>
                                  </select>
                                </label>
                                <label className="pickupQuickField">
                                  <span>Picked up by</span>
                                  <input value={quickPickupBy} onChange={(e) => setQuickPickupBy(e.target.value)} placeholder="Customer or helper name" />
                                </label>
                              </div>

                              <label className="pickupQuickField">
                                <span>Pickup notes</span>
                                <textarea
                                  rows={2}
                                  value={quickPickupNotes}
                                  onChange={(e) => setQuickPickupNotes(e.target.value)}
                                  placeholder="Optional note for this handoff"
                                />
                              </label>

                              <div className="pickupQuickButtonRow">
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => void recordQuickPayment('processing')}
                                  disabled={pickupActionBusy !== '' || pickupQuickView.procDue <= 0}
                                >
                                  {pickupActionBusy === 'processing' ? 'Saving...' : pickupQuickView.procDue > 0 ? `Mark Processing Paid (${money(pickupQuickView.procDue)})` : 'Processing Paid'}
                                </button>
                                {specialtyEnabled && (selectedJob.specialtyProducts || pickupQuickView.specDue > 0 || Number(selectedJob.priceSpecialty ?? selectedJob.price_specialty ?? 0) > 0) ? (
                                  <button
                                    className="btn"
                                    type="button"
                                    onClick={() => void recordQuickPayment('specialty')}
                                    disabled={pickupActionBusy !== '' || pickupQuickView.specDue <= 0}
                                  >
                                    {pickupActionBusy === 'specialty' ? 'Saving...' : pickupQuickView.specDue > 0 ? `Mark Specialty Paid (${money(pickupQuickView.specDue)})` : 'Specialty Paid'}
                                  </button>
                                ) : null}
                              </div>

                              <div className="pickupQuickButtonRow">
                                <button
                                  className="btn secondary"
                                  type="button"
                                  onClick={() => void markTrackPickedUp('meat')}
                                  disabled={pickupActionBusy !== '' || pickupQuickView.processingPickedUp}
                                >
                                  {pickupActionBusy === 'pickup-meat' ? 'Saving...' : pickupQuickView.processingPickedUp ? 'Processing Picked Up' : 'Mark Processing Picked Up'}
                                </button>
                                {canPrintCapeLabel(selectedJob) ? (
                                  <button
                                    className="btn secondary"
                                    type="button"
                                    onClick={() => void markTrackPickedUp('cape')}
                                    disabled={pickupActionBusy !== '' || pickupQuickView.capePickedUp}
                                  >
                                    {pickupActionBusy === 'pickup-cape' ? 'Saving...' : pickupQuickView.capePickedUp ? 'Cape Picked Up' : 'Mark Cape Picked Up'}
                                  </button>
                                ) : null}
                                {pickupQuickView.hasSpecialty ? (
                                  <button
                                    className="btn secondary"
                                    type="button"
                                    onClick={() => void markTrackPickedUp('specialty')}
                                    disabled={pickupActionBusy !== '' || pickupQuickView.specialtyPickedUp}
                                  >
                                    {pickupActionBusy === 'pickup-specialty' ? 'Saving...' : pickupQuickView.specialtyPickedUp ? 'Specialty Picked Up' : 'Mark Specialty Picked Up'}
                                  </button>
                                ) : null}
                                {webbsEnabled && selectedJob.webbsOrder ? (
                                  <button
                                    className="btn secondary"
                                    type="button"
                                    onClick={() => void markTrackPickedUp('webbs')}
                                    disabled={pickupActionBusy !== '' || pickupQuickView.webbsPickedUp}
                                  >
                                    {pickupActionBusy === 'pickup-webbs' ? 'Saving...' : pickupQuickView.webbsPickedUp ? 'Webbs Picked Up' : 'Mark Webbs Picked Up'}
                                  </button>
                                ) : null}
                              </div>

                              {pickupActionMsg ? <div className={`pickupQuickFeedback ${pickupActionMsg.startsWith('Could not') ? 'err' : 'ok'}`}>{pickupActionMsg}</div> : null}
                            </div>
                          ) : null}
                        </DetailBox>
                      ) : null}
                    </div>
                  ) : null}

                  {detailTab === 'order' ? (
                    <div className="detailTabPanel">
                    <DetailBox title="Order Details">
                      {specialtyEnabled ? <div><strong>Specialty:</strong> {selectedSearchSpecialtyItems.length ? `${selectedSearchSpecialtyItems.length} products selected` : 'Not selected'}</div> : null}
                      <div><strong>Add-ons:</strong> {selectedSearchAddOns.length ? selectedSearchAddOns.map((item) => item.name).join(', ') : 'No add-ons selected'}</div>
                      {selectedSearchSpecialtyItems.length ? (
                        <div style={{ paddingTop: 6 }}>
                          <strong>Specialty items:</strong>
                          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                            {selectedSearchSpecialtyItems.map((item) => (
                              <div key={`${item.key}-${item.pounds}`} style={{ color: '#374151' }}>
                                {item.label}: {item.pounds} lb
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {webbsEnabled && selectedJob.webbsOrder ? (
                        <>
                          <div><strong>Webbs paper form:</strong> {selectedJob.webbsPaperFormCompleted ? 'Completed' : 'Not marked'}</div>
                          <div><strong>Webbs:</strong> {webbsStyleLabel(selectedJob.webbsOrderStyle)}</div>
                        </>
                      ) : null}
                      {selectedJob.pendingDeletedAt ? <div><strong>Pending intake removed:</strong> {fmtDate(selectedJob.pendingDeletedAt)}</div> : null}
                    </DetailBox>
                    </div>
                  ) : null}

                  {detailTab === 'contact' ? (
                    <div className="detailTabPanel">
                    <DetailBox title="Contact">
                      <div><strong>Preferred:</strong> {preferredContact}</div>
                      <div><strong>Phone:</strong> {selectedJob.phone || '-'}</div>
                      <div><strong>Email:</strong> {selectedJob.email || '-'}</div>
                      <div><strong>Drop-off:</strong> {formatDisplayDate(selectedJob.dropoff || '')}</div>
                      <div><strong>Address:</strong> {[selectedJob.address, selectedJob.city, selectedJob.state, selectedJob.zip].filter(Boolean).join(', ') || '-'}</div>
                    </DetailBox>
                    </div>
                  ) : null}

                  {detailTab === 'messages' && canManageNotifications ? (
                    <div className="detailTabPanel">
                      <DetailBox title="Manual Message">
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 180px) 1fr', gap: 10, alignItems: 'center' }}>
                            <strong>Send by</strong>
                            <select
                              value={manualChannel}
                              onChange={(e) => setManualChannel(e.target.value as 'email' | 'sms')}
                              style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }}
                            >
                              <option value="sms" disabled={!canManualSms}>Text Message</option>
                              <option value="email" disabled={!canManualEmail}>Email</option>
                            </select>
                          </div>
                          <div style={{ fontSize: 13, color: '#4b5563' }}>
                            Destination: {manualChannel === 'email' ? (selectedJob.email || 'No email on file') : (selectedJob.phone || 'No phone on file')}
                          </div>
                          {!smsEnabled ? (
                            <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                              Text message sending is turned off in processor settings.
                            </div>
                          ) : !selectedJob.smsConsent ? (
                            <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                              Text message sending is disabled for this deer because the customer has not opted in to SMS.
                            </div>
                          ) : null}
                          {manualChannel === 'email' ? (
                            <label style={{ display: 'grid', gap: 6 }}>
                              <span style={{ fontWeight: 800, color: '#111827' }}>Subject</span>
                              <input
                                value={manualSubject}
                                onChange={(e) => setManualSubject(e.target.value)}
                                placeholder={`Message from ${brandingName}`}
                                style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }}
                              />
                            </label>
                          ) : null}
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontWeight: 800, color: '#111827' }}>Message</span>
                            <textarea
                              rows={4}
                              value={manualBody}
                              onChange={(e) => setManualBody(e.target.value)}
                              placeholder="Type the update you want to send to this customer."
                              style={{ padding: 12, borderRadius: 12, border: '1px solid #d1d5db', background: '#fff', color: '#111827', resize: 'vertical' }}
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => void sendManualMessage()}
                              disabled={manualBusy || !manualBody.trim() || (manualChannel === 'email' ? !canManualEmail : !canManualSms)}
                            >
                              {manualBusy ? 'Sending...' : `Send ${manualChannel === 'email' ? 'Email' : 'Text'}`}
                            </button>
                          </div>
                        </div>
                      </DetailBox>
                    </div>
                  ) : null}

                  {detailTab === 'history' ? (
                    <div className="detailTabPanel">
                      <div className="quickFactGrid">
                        {quickFacts.map((fact) => (
                          <div className="quickFact" key={fact.label}>
                            <div className="quickFactLabel">{fact.label}</div>
                            <div className="quickFactValue">{fact.value}</div>
                          </div>
                        ))}
                      </div>

                      <DetailBox title="Notification History">
                        <div className="quickFactGrid">
                          <div className="quickFact">
                            <div className="quickFactLabel">Last Notification</div>
                            <div className="quickFactValue">{fmtDate(latestNotificationAt)}</div>
                          </div>
                          <div className="quickFact">
                            <div className="quickFactLabel">Last Drop-Off Message</div>
                            <div className="quickFactValue">{fmtDate(selectedJob.dropoffSmsSentAt || selectedJob.dropoffEmailSentAt)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {notificationRows.map((row) => (
                            <div key={row.label} style={{ border: '1px solid #d1d5db', borderRadius: 12, background: '#ffffff', padding: 12, display: 'grid', gap: 8, color: '#111827' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 900, color: '#111827' }}>{row.label}</div>
                                {(row.email || row.sms) ? (
                                  <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', background: '#ecfdf5', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: 999 }}>
                                    Sent
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: 999 }}>
                                    No confirmed send
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                  <span style={{ color: '#4b5563', fontWeight: 700 }}>Email</span>
                                  <span style={{ color: '#111827', textAlign: 'right' }}>{fmtDate(row.email)}</span>
                                </div>
                                {smsEnabled ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <span style={{ color: '#4b5563', fontWeight: 700 }}>SMS</span>
                                    <span style={{ color: '#111827', textAlign: 'right' }}>{fmtDate(row.sms)}</span>
                                  </div>
                                ) : null}
                              </div>
                              {canManageNotifications ? (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="btn"
                                    onClick={() => void resendNotification(eventKeyForLabel(row.label))}
                                    disabled={!selectedTag || !!resendBusy || !!resetBusy}
                                  >
                                    {resendBusy === eventKeyForLabel(row.label) ? 'Sending...' : 'Resend'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => void resetNotification(eventKeyForLabel(row.label))}
                                    disabled={!selectedTag || !!resetBusy}
                                  >
                                    {resetBusy === eventKeyForLabel(row.label) ? 'Resetting...' : 'Reset Flags'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </DetailBox>
                    </div>
                  ) : null}

                  {resendMsg ? <div className={`statusFeedback ${resendMsg.startsWith('Could not') ? 'err' : 'ok'}`}>{resendMsg}</div> : null}
                </>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <div className="print-only">
        {printMode === 'sheet' && printJob ? (
          <PrintSheet
            job={printJob}
            webbsEnabled={webbsEnabled}
            smsEnabled={smsEnabled}
            specialtyEnabled={specialtyEnabled}
            cutOptions={cutOptions}
            pricing={pricing}
            specialtyCatalog={specialtyCatalog}
          />
        ) : null}
        {printMode === 'deer' && printJob ? <ThermalLabelSheet job={printJob} type="deer" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
        {printMode === 'antler' && printJob ? <ThermalLabelSheet job={printJob} type="antler" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
        {printMode === 'deer-antler' && printJob ? <ThermalLabelSheet job={printJob} type="deer-antler" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
      </div>

      {labelPreviewJob && labelPreviewMode ? (
        <div className="label-print-source" ref={labelPreviewRef} aria-hidden="true">
          <ThermalLabelSheet
            job={labelPreviewJob}
            type={labelPreviewMode}
            brandingName={brandingName}
            brandingLogoUrl={brandingLogoUrl}
          />
        </div>
      ) : null}

      <style jsx>{`
        .print-only {
          display: none;
        }

        .label-print-source {
          position: fixed;
          top: 0;
          left: -10000px;
          width: 3.5in;
          height: auto;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          z-index: -1;
        }

        .search-toolbar-summary {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255,255,255,.72);
          font-weight: 700;
        }

        .searchEmptyState {
          padding: 18px;
          color: #334155;
          display: grid;
          gap: 8px;
        }

        .searchEmptyState.compact {
          padding: 16px;
        }

        .searchEmptyKicker {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .07em;
          text-transform: uppercase;
          color: #64748b;
        }

        .searchEmptyTitle {
          font-size: 18px;
          font-weight: 950;
          color: #0f172a;
          line-height: 1.25;
        }

        .searchEmptyText {
          color: #475569;
          line-height: 1.5;
        }

        .searchEmptyChips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding-top: 2px;
        }

        .searchEmptyChips span {
          padding: 5px 9px;
          border-radius: 999px;
          background: #eef2ff;
          color: #334155;
          font-size: 12px;
          font-weight: 900;
        }

        .search-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.95fr);
          gap: 16px;
          align-items: start;
        }

        .search-results-col {
          min-width: 0;
        }

        .results-summary-card {
          background: rgba(21,20,19,.92);
        }

        .search-results-mobile {
          display: none;
        }

        .search-mobile-toggle,
        .mobile-only-inline {
          display: none;
        }

        .search-mobile-selected {
          display: none;
        }

        .search-result-mobile-card {
          width: 100%;
          display: grid;
          gap: 10px;
          text-align: left;
          padding: 14px;
          border: 0;
          border-top: 1px solid rgba(255,255,255,.08);
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .search-result-mobile-card.selected {
          background: #dcfce7;
          color: #111827;
          box-shadow: inset 5px 0 0 #2f7d42;
        }

          .search-results-card {
            max-height: calc(100vh - 300px);
            overflow: auto;
          }

          .results-summary-card {
            display: grid;
            gap: 8px;
          }

        .search-result-row {
          cursor: pointer;
          color: #f8fafc;
          transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
        }

        .search-result-row td {
          padding-top: 9px;
          padding-bottom: 9px;
          vertical-align: top;
          background: transparent;
          color: inherit;
          transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
        }

        .search-result-row:hover td {
          background: rgba(255,247,235,.08);
          color: #fff7e8;
        }

        .search-result-row:hover td:first-child {
          box-shadow: inset 4px 0 0 #c88a3d;
        }

        .search-result-row.selected td {
          background: #dcfce7;
          color: #111827;
        }

        .search-result-row.selected td:first-child {
          box-shadow: inset 6px 0 0 #2f7d42;
        }

        .search-tag-cell {
          width: 88px;
          font-size: 14px;
          line-height: 1.3;
          word-break: break-word;
        }

        .search-customer-cell {
          width: 1%;
        }

        .search-customer-name {
          font-weight: 900;
          font-size: 12px;
          line-height: 1.05;
          max-width: 210px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .search-confirmation-line {
          font-size: 10px;
          opacity: 0.78;
          margin-top: 1px;
          line-height: 1.25;
        }

        .search-row-badges {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .search-row-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 999px;
          background: #eef2ff;
          color: #334155;
          line-height: 1.2;
        }

        .search-result-row.selected .search-row-badge {
          background: rgba(15,23,42,.08);
          color: #1f2937;
        }

        .search-result-row:hover .search-row-badge {
          background: rgba(255,255,255,.18);
          color: #f8fafc;
        }

        .search-phone-cell {
          white-space: nowrap;
          font-size: 14px;
        }

        .search-preview-card {
          position: sticky;
          top: 88px;
          max-height: calc(100vh - 110px);
          overflow: auto;
        }

        .selectedSummary {
          display: grid;
          gap: 12px;
        }

        .selectedSummaryTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .selectedSummaryKicker,
        .nextActionLabel,
        .selectedSummaryFactLabel,
        .quickFactLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #64748b;
        }

        .selectedSummaryTitle {
          font-size: 23px;
          font-weight: 950;
          line-height: 1.12;
          margin-top: 4px;
          color: #0f172a;
        }

        .selectedSummaryMeta {
          margin-top: 4px;
          color: #475569;
          font-size: 13px;
          line-height: 1.4;
        }

        .selectedBalanceBadge {
          flex: 0 0 auto;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid #dbe4ee;
          background: #f8fafc;
          color: #334155;
          font-weight: 900;
          white-space: nowrap;
        }

        .selectedBalanceBadge.warn {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #9a3412;
        }

        .selectedBalanceBadge.ok {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .selectedSummaryFacts,
        .quickFactGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
          gap: 8px;
        }

        .selectedSummaryFact,
        .quickFact {
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          padding: 10px 11px;
          background: #ffffff;
          color: #111827;
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .selectedSummaryFactValue,
        .quickFactValue {
          font-weight: 900;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }

        .nextActionCard {
          padding: 12px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #dbe4ee;
          color: #0f172a;
          display: grid;
          gap: 4px;
        }

        .nextActionText {
          font-weight: 900;
          line-height: 1.38;
        }

        .selectedPrimaryActions,
        .printOptionsList {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .printOptionsDisclosure,
        .compactDisclosure {
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          background: #ffffff;
          color: #111827;
        }

        .printOptionsDisclosure summary,
        .compactDisclosure summary {
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          font-weight: 900;
          color: #0f172a;
        }

        .printOptionsDisclosure summary span:last-child,
        .compactDisclosure summary span:last-child {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
        }

        .printOptionsDisclosure[open] summary,
        .compactDisclosure[open] summary {
          border-bottom: 1px solid #e5eaf1;
        }

        .printOptionsList {
          padding: 10px 12px 12px;
        }

        .compactDisclosure .pickupQuickBreakdown,
        .compactDisclosure .pickupQuickNotes {
          margin: 10px 12px 12px;
        }

        .detailTabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 4px;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          background: #f8fafc;
        }

        .detailTab {
          border: 0;
          border-radius: 10px;
          padding: 8px 10px;
          background: transparent;
          color: #475569;
          font-weight: 900;
          cursor: pointer;
        }

        .detailTab:hover {
          background: #eaf2ed;
          color: #0f172a;
        }

        .detailTab.active {
          background: #2f7d42;
          color: #ffffff;
        }

        .detailTabPanel {
          display: grid;
          gap: 12px;
        }

        .pickupQuickGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }

        .pickupQuickCard {
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          padding: 12px;
          background: #ffffff;
          display: grid;
          gap: 6px;
        }

        .pickupQuickLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #64748b;
        }

        .pickupQuickValue {
          font-size: 20px;
          font-weight: 950;
          color: #0f172a;
        }

        .pickupQuickSub {
          color: #475569;
          font-size: 13px;
          line-height: 1.45;
        }

        .pickupChecklistSummary {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          padding: 12px;
          background: #f8fafc;
        }

        .pickupChecklistSummary.warn {
          border-color: #fed7aa;
          background: #fff7ed;
        }

        .pickupChecklistSummary.wait {
          border-color: #dbe4ee;
          background: #f8fafc;
        }

        .pickupChecklistSummary.ok {
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .pickupChecklistSummaryLabel {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: #64748b;
        }

        .pickupChecklistSummaryText {
          margin-top: 4px;
          color: #0f172a;
          font-weight: 900;
          line-height: 1.35;
        }

        .pickupChecklistSummaryCount {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 7px 10px;
          background: #ffffff;
          border: 1px solid rgba(15,23,42,.12);
          color: #0f172a;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .pickupChecklist {
          display: grid;
          gap: 8px;
        }

        .pickupChecklistItem {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          border: 1px solid #dbe4ee;
          border-left-width: 5px;
          border-radius: 12px;
          padding: 10px 11px;
          background: #ffffff;
        }

        .pickupChecklistItem.ok {
          border-left-color: #22c55e;
        }

        .pickupChecklistItem.warn {
          border-left-color: #f59e0b;
          background: #fffaf0;
        }

        .pickupChecklistItem.wait {
          border-left-color: #94a3b8;
          background: #f8fafc;
        }

        .pickupChecklistMain {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .pickupChecklistTitle {
          color: #0f172a;
          font-weight: 950;
          line-height: 1.25;
        }

        .pickupChecklistDetail {
          color: #475569;
          font-size: 13px;
          line-height: 1.35;
        }

        .pickupChecklistState {
          border-radius: 999px;
          padding: 6px 9px;
          background: #f1f5f9;
          color: #0f172a;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .pickupChecklistItem.warn .pickupChecklistState {
          background: #ffedd5;
          color: #9a3412;
        }

        .pickupChecklistItem.ok .pickupChecklistState {
          background: #dcfce7;
          color: #166534;
        }

        .pickupQuickBreakdown {
          display: grid;
          gap: 6px;
          color: #334155;
        }

        .pickupQuickNotes {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #dbe4ee;
          background: #f8fafc;
          color: #334155;
          line-height: 1.5;
        }

        .pickupQuickActions {
          display: grid;
          gap: 10px;
          padding-top: 4px;
        }

        .pickupQuickActionGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        .pickupQuickField {
          display: grid;
          gap: 6px;
          color: #334155;
          font-weight: 700;
        }

        .pickupQuickField span {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #64748b;
        }

        .pickupQuickField input,
        .pickupQuickField select,
        .pickupQuickField textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #d6dee8;
          background: #fff;
          color: #0f172a;
        }

        .pickupQuickButtonRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pickupQuickFeedback {
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 700;
        }

        .pickupQuickFeedback.ok,
        .statusFeedback.ok {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .pickupQuickFeedback.err,
        .statusFeedback.err {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .statusFeedback {
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.4;
        }

        .notificationHistoryDisclosure {
          display: grid;
          gap: 10px;
          border: 1px solid #d1d5db;
          border-radius: 14px;
          padding: 12px 14px;
          background: #f8fafc;
          color: #111827;
        }

        .notificationHistoryDisclosure summary {
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          font-weight: 900;
          font-size: 16px;
        }

        .notificationHistoryDisclosure[open] summary {
          margin-bottom: 10px;
        }

        .notificationHistorySummary {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          .search-layout {
            grid-template-columns: 1fr;
          }

          .search-preview-col {
            order: -1;
          }

          .search-results-col {
            order: 2;
          }

          .search-toolbar-summary {
            width: 100%;
            margin-left: 0;
          }

          .search-results-card {
            max-height: none;
            overflow: visible;
          }

          .search-preview-card {
            position: static;
            max-height: none;
            overflow: visible;
          }
        }

        @media (max-width: 760px) {
          .search-mobile-toggle,
          .mobile-only-inline {
            display: inline-flex;
            justify-content: center;
          }

          .search-mobile-selected {
            display: grid;
            gap: 10px;
            position: sticky;
            top: 10px;
            z-index: 7;
            padding: 14px;
            margin-bottom: 10px;
            border: 1px solid #dbe4ee;
          }

          .search-mobile-selected-top {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: start;
          }

          .search-mobile-selected-kicker {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .06em;
            text-transform: uppercase;
            color: #64748b;
          }

          .search-mobile-selected-title {
            font-size: 20px;
            font-weight: 950;
            color: #0f172a;
            margin-top: 4px;
          }

          .search-mobile-selected-meta {
            color: #475569;
            margin-top: 4px;
            line-height: 1.45;
          }

          .search-mobile-balance-chip {
            padding: 8px 10px;
            border-radius: 999px;
            font-weight: 900;
            white-space: nowrap;
            border: 1px solid #dbe4ee;
            background: #f8fafc;
            color: #334155;
          }

          .search-mobile-balance-chip.warn {
            border-color: #fed7aa;
            background: #fff7ed;
            color: #9a3412;
          }

          .search-mobile-balance-chip.ok {
            border-color: #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .search-mobile-selected-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .pickupChecklistItem {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .pickupChecklistSummary {
            flex-direction: column;
            align-items: stretch;
          }

          .search-results-mobile.collapsed {
            display: none;
          }

          .results-summary-card {
            margin-bottom: 8px;
          }

          .search-results-table {
            display: none;
          }

          .search-results-mobile {
            display: block;
          }

          .search-preview-card {
            top: 12px;
          }
        }

        @media print {
          main > :not(.print-only) {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .label-print-source {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function fmtDate(v: any) {
  return formatDisplayDateTime(v == null ? undefined : String(v));
}

function labelForEvent(event: string) {
  return RESEND_EVENTS.find((item) => item.key === event)?.label || event;
}

function eventKeyForLabel(label: string): ResendEventKey {
  return RESEND_EVENTS.find((item) => item.label === label)?.key || 'dropoff_tagged';
}

function webbsStyleLabel(style: string | null | undefined) {
  if (style === 'whole_deer_percent') return 'Whole deer by percentages';
  if (style === 'paper_form') return 'Filled out on paper form';
  return 'Products by pounds';
}

function DetailBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 14, padding: 14, background: '#f8fafc', color: '#111827', display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 900, fontSize: 16, color: '#111827' }}>{title}</div>
      <div style={{ display: 'grid', gap: 4, color: '#111827' }}>{children}</div>
    </div>
  );
}

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

