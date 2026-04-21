'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintCapeLabel, type ThermalLabelType } from '@/app/components/ThermalLabelSheet';
import type { Job } from '@/lib/api';
import { getJob, saveJob, searchJobs, tokenHeader } from '@/lib/api';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { specialtyBreakdown } from '@/lib/specialty';
import { filterVisibleAddOnItems, normalizeJobAddOnItems } from '@/lib/processorCatalog';

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
  const due =
    Math.max(0, Number(row.priceProcessing ?? row.price_processing ?? 0) - Number(row.amountPaidProcessing ?? row.amount_paid_processing ?? 0)) +
    Math.max(0, Number(row.priceSpecialty ?? row.price_specialty ?? 0) - Number(row.amountPaidSpecialty ?? row.amount_paid_specialty ?? 0));
  if (due > 0) badges.push('Unpaid');
  return badges;
}

function processingDue(row: Record<string, any> | null | undefined) {
  if (!row) return 0;
  return Math.max(0, Number(row.priceProcessing ?? row.price_processing ?? 0) - Number(row.amountPaidProcessing ?? row.amount_paid_processing ?? 0));
}

function specialtyDue(row: Record<string, any> | null | undefined) {
  if (!row) return 0;
  return Math.max(0, Number(row.priceSpecialty ?? row.price_specialty ?? 0) - Number(row.amountPaidSpecialty ?? row.amount_paid_specialty ?? 0));
}

function totalDue(row: Record<string, any> | null | undefined) {
  return processingDue(row) + specialtyDue(row);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

type PaymentMethod = 'cash' | 'card' | 'check' | 'other';
type PickupTrack = 'meat' | 'cape' | 'webbs';

export default function SearchPage() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState('');
  const [printJob, setPrintJob] = useState<Record<string, any> | null>(null);
  const [printMode, setPrintMode] = useState<'' | 'sheet' | ThermalLabelType>('');
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
  const [brandingName, setBrandingName] = useState('Wild Game Butcher Board');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [mobileMatchesOpen, setMobileMatchesOpen] = useState(true);
  const [quickPickupBy, setQuickPickupBy] = useState('');
  const [quickPickupNotes, setQuickPickupNotes] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<PaymentMethod>('cash');
  const [pickupActionBusy, setPickupActionBusy] = useState('');
  const [pickupActionMsg, setPickupActionMsg] = useState<string | null>(null);
  const debounced = useDebounced(q, 300);

  useEffect(() => {
    fetch('/api/staff/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
        setBrandingName(String(j?.settings?.branding?.name || 'Wild Game Butcher Board'));
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
        : `/intake/${encodeURIComponent(tag)}${token ? `?t=${encodeURIComponent(token)}` : ''}`
    );
  };

  const loadDetails = async (tag: string) => {
    if (!tag) return;
    setSelectedTag(tag);
    setMobileMatchesOpen(false);
    setDetailLoading(true);
    setDetailErr(null);
    setResendMsg(null);
    setPrintMsg(null);
    setPickupActionMsg(null);
    setManualSubject('');
    setManualBody('');
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
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(''), 300);
        setPrinting('');
      }, 150);
      if (selectedTag === tag) {
        await loadDetails(tag);
        setPrintMsg('Marked printed. If the printer did not respond, try Print Queue or print again from this page.');
      }
    } catch (e: any) {
      setErr(`Could not print this intake sheet. ${e?.message || 'Try again, or open the intake record and print from there.'}`);
      setPrinting('');
    }
  };

  const printLabel = async (tag: string, type: ThermalLabelType) => {
    if (!tag) return;
    setPrinting(tag);
    setErr(null);
    setPrintMsg(null);
    try {
      const res = await getJob(tag);
      const job = (res?.job || null) as Record<string, any> | null;
      if (!job) throw new Error('Could not load the label details.');
      setPrintJob(job);
      setPrintMode(type);
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(''), 300);
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setErr(`Could not print that label. ${e?.message || 'Try again, or open the intake record and print from there.'}`);
      setPrinting('');
    }
  };

  const preferredContact = useMemo(() => {
    if (!selectedJob) return '-';
    if (selectedJob.prefSMS) return selectedJob.smsConsent ? 'Text (SMS)' : 'Text selected, no consent';
    if (selectedJob.prefEmail) return 'Email';
    if (selectedJob.prefCall) return 'Phone Call';
    return 'Not selected';
  }, [selectedJob]);

  const paymentSummary = useMemo(() => {
    if (!selectedJob) return '-';
    const procDue = processingDue(selectedJob);
    const specDue = specialtyDue(selectedJob);
    const procMethod = String(selectedJob.paymentMethodProcessing ?? selectedJob.payment_method_processing ?? '').trim();
    const specMethod = String(selectedJob.paymentMethodSpecialty ?? selectedJob.payment_method_specialty ?? '').trim();
    const proc = procDue <= 0
      ? `Processing paid${procMethod ? ` (${procMethod})` : ''}`
      : procDue < Number(selectedJob.priceProcessing ?? selectedJob.price_processing ?? 0)
        ? `Processing partial${procMethod ? ` (${procMethod})` : ''}`
        : 'Processing unpaid';
    const spec = selectedJob.specialtyProducts
      ? specDue <= 0
        ? `Specialty paid${specMethod ? ` (${specMethod})` : ''}`
        : specDue < Number(selectedJob.priceSpecialty ?? selectedJob.price_specialty ?? 0)
          ? `Specialty partial${specMethod ? ` (${specMethod})` : ''}`
          : 'Specialty unpaid'
      : null;
    return [proc, spec].filter(Boolean).join(' | ');
  }, [selectedJob]);

  const pickupQuickView = useMemo(() => {
    if (!selectedJob) return null;
    const procDue = processingDue(selectedJob);
    const specDue = specialtyDue(selectedJob);
    const due = procDue + specDue;
    const pickupState = String(selectedJob.status || '').toLowerCase().includes('called')
      ? 'Ready for pickup'
      : String(selectedJob.status || '').toLowerCase().includes('finished') || String(selectedJob.status || '').toLowerCase().includes('ready')
        ? 'Ready to contact'
        : 'Still in process';
    const processingPickedUp = !!(selectedJob.pickedUpProcessing ?? selectedJob.picked_up_processing);
    const capePickedUp = !!(selectedJob.pickedUpCape ?? selectedJob.picked_up_cape);
    const webbsPickedUp = !!(selectedJob.pickedUpWebbs ?? selectedJob.picked_up_webbs);
    const pickedUpBy = String(selectedJob.pickedUpBy ?? selectedJob.picked_up_by ?? '').trim();
    const pickupNotes = String(selectedJob.pickupNotes ?? selectedJob.pickup_notes ?? '').trim();
    return {
      due,
      procDue,
      specDue,
      pickupState,
      processingPickedUp,
      capePickedUp,
      webbsPickedUp,
      pickedUpBy,
      pickupNotes,
    };
  }, [selectedJob]);

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
    ].filter((row) => webbsEnabled || row.label !== 'Webbs Delivered');
  }, [selectedJob, webbsEnabled]);

  const latestNotificationAt = useMemo(() => {
    const values = notificationRows.flatMap((row) => [row.email, row.sms]).filter(Boolean) as string[];
    if (!values.length) return null;
    return values.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [notificationRows]);

  const canShowResults = q.trim().length > 0;
  const canEdit = staffRole === 'admin' || staffRole === 'staff';
  const canManageNotifications = staffRole === 'admin';
  const canManualEmail = !!selectedJob?.email;
  const canManualSms = !!selectedJob?.phone && !!selectedJob?.smsConsent;
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
    if (!selectedJob) return [];
    return specialtyBreakdown(selectedJob).filter((item) => item.pounds > 0);
  }, [selectedJob]);

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
        { label: 'Preferred Contact', value: preferredContact },
        { label: 'Payment', value: paymentSummary },
        { label: 'Last Printed', value: fmtDate(selectedJob.intakeSheetPrintedAt) },
        { label: 'Last Updated', value: fmtDate(selectedJob.updatedAt) },
      ]
    : [];
  const nextAction = useMemo(() => {
    if (!selectedJob) return '';
    const status = String(selectedJob.status || '').toLowerCase();
    const due = totalDue(selectedJob);
    if (!selectedJob.tag || String(selectedJob.tag).toUpperCase().startsWith('PENDING-')) return 'Assign the permanent tag after reviewing the intake.';
    if (status.includes('called')) return due > 0 ? 'Collect the remaining balance at pickup.' : 'Ready for pickup handoff.';
    if (status.includes('finished') || status.includes('ready')) return 'Contact the customer and move this deer into pickup follow-up.';
    return 'Open the intake record to update statuses, print paperwork, or review instructions.';
  }, [selectedJob]);
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
      setPrintMsg('Marked unprinted. This deer will show up in the print queue again.');
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
              paymentMethodProcessing: quickPaymentMethod,
            } as any)
          : ({
              tag: selectedTag,
              amountPaidSpecialty: currentPaid + due,
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
                const rowToken = rows.find((row) => row.tag === selectedTag) as any;
                selectedTag && openTag(selectedTag, selectedJob?.publicToken || selectedJob?.public_token || rowToken?.publicToken);
              }}
              disabled={!selectedTag}
            >
              {canEdit ? 'Open Intake' : 'Open Details'}
            </button>
            <button className="btn secondary mobile-only-inline" type="button" onClick={() => setMobileMatchesOpen((prev) => !prev)}>
              {mobileMatchesOpen ? 'Hide Matches' : 'Show Matches'}
            </button>
          </div>
        </div>
      ) : null}

      {!canShowResults && (
        <div className="app-surface-light" style={{ padding: 16, color: '#334155' }}>
          Start typing above to find a deer.
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
                        <td colSpan={4} style={{ padding: 14 }}>No results. Try a tag number, confirmation number, phone number, or part of the customer name.</td>
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
                    <div style={{ padding: 14 }}>No results. Try a tag number, confirmation number, phone number, or part of the customer name.</div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.04em' }}>Preview</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{selectedJob?.customer || selectedTag || 'Select a deer'}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {selectedTag ? `Tag ${selectedTag}` : 'Select a deer'}
                    {selectedJob?.confirmation ? ` | Confirmation ${selectedJob.confirmation}` : ''}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '.04em' }}>Actions</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const rowToken = rows.find((row) => row.tag === selectedTag) as any;
                        selectedTag && openTag(selectedTag, selectedJob?.publicToken || selectedJob?.public_token || rowToken?.publicToken);
                      }}
                      disabled={!selectedTag}
                    >
                      {canEdit ? 'Open Intake' : 'Open Details'}
                    </button>
                    <button className="btn secondary" type="button" onClick={() => selectedTag && void printTag(selectedTag)} disabled={!selectedTag || printing === selectedTag}>
                      {printing === selectedTag ? 'Preparing...' : 'Print Intake'}
                    </button>
                    <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'deer')} disabled={!selectedTag || printing === selectedTag}>
                      Deer Label
                    </button>
                    {canPrintCapeLabel(selectedJob) ? (
                      <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'cape')} disabled={!selectedTag || printing === selectedTag}>
                        Cape Label
                      </button>
                    ) : null}
                    <button className="btn secondary" type="button" onClick={() => selectedTag && void printLabel(selectedTag, 'package')} disabled={!selectedTag || printing === selectedTag}>
                      Package Label
                    </button>
                  </div>
                </div>
              </div>

              {selectedJob ? (
                <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#0f172a', display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#64748b' }}>Next Best Action</div>
                  <div style={{ fontWeight: 900 }}>{nextAction}</div>
                </div>
              ) : null}

              {detailLoading ? <div className="muted">Loading details...</div> : null}
              {detailErr ? <div className="card" style={{ borderColor: '#ef4444' }}>Error: {detailErr}</div> : null}

              {!selectedJob && !detailLoading && !detailErr ? (
                <div className="muted" style={{ padding: '8px 0' }}>
                  Choose a result on the left to see contact details, print history, and available actions.
                </div>
              ) : null}

              {selectedJob ? (
                <>
                  {pickupQuickView ? (
                    <DetailBox title="Counter Summary">
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

                      <div className="pickupQuickBreakdown">
                        <div><strong>Status:</strong> {statusSummary}</div>
                        <div><strong>Balance status:</strong> {paymentSummary.toLowerCase().includes('partial') ? 'Partial payment on file' : paymentSummary.toLowerCase().includes('unpaid') ? 'Collect at pickup' : 'Paid in full'}</div>
                        <div><strong>Processing due:</strong> {money(pickupQuickView.procDue)}</div>
                        <div><strong>Specialty due:</strong> {money(pickupQuickView.specDue)}</div>
                        <div><strong>Processing paid:</strong> {money(Number(selectedJob.amountPaidProcessing ?? selectedJob.amount_paid_processing ?? 0))}</div>
                        <div><strong>Specialty paid:</strong> {money(Number(selectedJob.amountPaidSpecialty ?? selectedJob.amount_paid_specialty ?? 0))}</div>
                        <div><strong>Processing pickup:</strong> {pickupQuickView.processingPickedUp ? 'Picked up' : 'Not picked up'}</div>
                        <div><strong>Cape pickup:</strong> {pickupQuickView.capePickedUp ? 'Picked up' : 'Not picked up'}</div>
                        <div><strong>Webbs pickup:</strong> {pickupQuickView.webbsPickedUp ? 'Picked up' : 'Not picked up'}</div>
                        <div><strong>Picked up by:</strong> {pickupQuickView.pickedUpBy || 'Not recorded'}</div>
                      </div>

                      {pickupQuickView.pickupNotes ? (
                        <div className="pickupQuickNotes">
                          <strong>Pickup notes:</strong> {pickupQuickView.pickupNotes}
                        </div>
                      ) : null}

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
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void recordQuickPayment('specialty')}
                              disabled={pickupActionBusy !== '' || pickupQuickView.specDue <= 0}
                            >
                              {pickupActionBusy === 'specialty' ? 'Saving...' : pickupQuickView.specDue > 0 ? `Mark Specialty Paid (${money(pickupQuickView.specDue)})` : 'Specialty Paid'}
                            </button>
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

                          {pickupActionMsg ? <div className="pickupQuickFeedback">{pickupActionMsg}</div> : null}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn secondary" type="button" onClick={() => router.push('/reports/called')}>
                          Open Pickup Queue
                        </button>
                        <button className="btn secondary" type="button" onClick={() => router.push('/reports/balances')}>
                          Open Balances
                        </button>
                      </div>
                    </DetailBox>
                  ) : null}

                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      {quickFacts.map((fact) => (
                        <div
                          key={fact.label}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 14,
                            padding: 12,
                            background: '#ffffff',
                            color: '#111827',
                            display: 'grid',
                            gap: 6,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280' }}>{fact.label}</div>
                          <div style={{ fontWeight: 900, lineHeight: 1.4 }}>{fact.value}</div>
                        </div>
                      ))}
                    </div>

                    <DetailBox title="Order Details">
                      <div><strong>Specialty:</strong> {selectedSearchSpecialtyItems.length ? `${selectedSearchSpecialtyItems.length} products selected` : 'Not selected'}</div>
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
                      {webbsEnabled ? (
                        <>
                          <div><strong>Webbs paper form:</strong> {selectedJob.webbsPaperFormCompleted ? 'Completed' : 'Not marked'}</div>
                          <div><strong>Webbs:</strong> {selectedJob.webbsOrder ? webbsStyleLabel(selectedJob.webbsOrderStyle) : 'No Webbs order'}</div>
                        </>
                      ) : null}
                      <div><strong>Pending intake removed:</strong> {fmtDate(selectedJob.pendingDeletedAt)}</div>
                    </DetailBox>

                    <DetailBox title="Contact">
                      <div><strong>Preferred:</strong> {preferredContact}</div>
                      <div><strong>Phone:</strong> {selectedJob.phone || '-'}</div>
                      <div><strong>Email:</strong> {selectedJob.email || '-'}</div>
                      <div><strong>Drop-off:</strong> {formatDisplayDate(selectedJob.dropoff || '')}</div>
                      <div><strong>Address:</strong> {[selectedJob.address, selectedJob.city, selectedJob.state, selectedJob.zip].filter(Boolean).join(', ') || '-'}</div>
                    </DetailBox>

                    <DetailBox title="Manual Message">
                      {!canManageNotifications ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          Only Admin users can send manual customer messages.
                        </div>
                      ) : (
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
                          {!selectedJob.smsConsent ? (
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
                      )}
                    </DetailBox>

                    <DetailBox title="Print Control">
                      <div><strong>Print count:</strong> {selectedJob.intakeSheetPrintCount ?? 0}</div>
                      <div style={{ paddingTop: 6 }}>
                        <button className="btn" type="button" onClick={() => void markUnprinted()} disabled={!selectedJob.intakeSheetPrintedAt}>
                          Mark Unprinted
                        </button>
                      </div>
                      {printMsg ? <div className="muted" style={{ fontSize: 13 }}>{printMsg}</div> : null}
                    </DetailBox>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>Notification History</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div style={{ border: '1px solid #d1d5db', borderRadius: 12, background: '#ffffff', padding: 12, color: '#111827' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280' }}>Last Notification</div>
                        <div style={{ fontWeight: 900, marginTop: 6 }}>{fmtDate(latestNotificationAt)}</div>
                      </div>
                      <div style={{ border: '1px solid #d1d5db', borderRadius: 12, background: '#ffffff', padding: 12, color: '#111827' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280' }}>Last Drop-Off Message</div>
                        <div style={{ fontWeight: 900, marginTop: 6 }}>{fmtDate(selectedJob.dropoffSmsSentAt || selectedJob.dropoffEmailSentAt)}</div>
                      </div>
                    </div>
                    {!canManageNotifications ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Notification timestamps are visible here, but only Admin users can resend messages or reset sent flags.
                      </div>
                    ) : null}
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
                                Not sent yet
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ color: '#4b5563', fontWeight: 700 }}>Email</span>
                              <span style={{ color: '#111827', textAlign: 'right' }}>{fmtDate(row.email)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ color: '#4b5563', fontWeight: 700 }}>SMS</span>
                              <span style={{ color: '#111827', textAlign: 'right' }}>{fmtDate(row.sms)}</span>
                            </div>
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
                  </div>
                  {resendMsg ? <div className="muted" style={{ fontSize: 13 }}>{resendMsg}</div> : null}
                </>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <div className="print-only">
        {printMode === 'sheet' && printJob ? <PrintSheet job={printJob} webbsEnabled={webbsEnabled} /> : null}
        {printMode === 'deer' && printJob ? <ThermalLabelSheet job={printJob} type="deer" brandingName={brandingName} /> : null}
        {printMode === 'cape' && printJob ? <ThermalLabelSheet job={printJob} type="cape" brandingName={brandingName} /> : null}
        {printMode === 'package' && printJob ? <ThermalLabelSheet job={printJob} type="package" brandingName={brandingName} /> : null}
      </div>

      <style jsx>{`
        .print-only {
          display: none;
        }

        .search-toolbar-summary {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255,255,255,.72);
          font-weight: 700;
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
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
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

