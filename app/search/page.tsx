'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintCapeLabel, type ThermalLabelType } from '@/app/components/ThermalLabelSheet';
import type { Job } from '@/lib/api';
import { getJob, searchJobs, tokenHeader } from '@/lib/api';
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
  const debounced = useDebounced(q, 300);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
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
        if (!cancelled) setRows(res.rows || []);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || 'Search failed');
          setRows([]);
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
    }
  }, [rows, selectedTag]);

  const openTag = (tag: string) => {
    if (!tag) return;
    router.push(
      staffRole === 'admin' || staffRole === 'staff'
        ? `/intake?tag=${encodeURIComponent(tag)}`
        : `/intake/${encodeURIComponent(tag)}`
    );
  };

  const loadDetails = async (tag: string) => {
    if (!tag) return;
    setSelectedTag(tag);
    setDetailLoading(true);
    setDetailErr(null);
    setResendMsg(null);
    setPrintMsg(null);
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
        setPrintMsg('Marked printed from search preview.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Print failed');
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
      if (!job) throw new Error('Could not load label details.');
      setPrintJob(job);
      setPrintMode(type);
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(''), 300);
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setErr(e?.message || 'Label print failed');
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
    const procDue = Math.max(0, Number(selectedJob.priceProcessing ?? selectedJob.price_processing ?? 0) - Number(selectedJob.amountPaidProcessing ?? selectedJob.amount_paid_processing ?? 0));
    const specDue = Math.max(0, Number(selectedJob.priceSpecialty ?? selectedJob.price_specialty ?? 0) - Number(selectedJob.amountPaidSpecialty ?? selectedJob.amount_paid_specialty ?? 0));
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
      setResendMsg(e?.message || 'Could not send message.');
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
      setResendMsg(e?.message || 'Resend failed.');
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
      setResendMsg(e?.message || 'Reset failed.');
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
      setPrintMsg(e?.message || 'Could not mark unprinted.');
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

      {!canShowResults && (
        <div className="app-surface-light" style={{ padding: 16, color: '#334155' }}>
          Start typing above to find a deer.
        </div>
      )}

      {canShowResults && (
        <div className="search-layout">
          <section className="search-results-col">
            <div className="app-surface-light results-summary-card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.72 }}>Results</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                {resultSummary}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Click once to preview. Double-click to open the full deer record.
              </div>
            </div>
            {loading && <div className="app-surface-light" style={{ padding: 16, color: '#334155' }}>Loading...</div>}
            {err && <div className="app-surface-light" style={{ padding: 16, borderColor: '#ef4444', color: '#7f1d1d' }}>Error: {err}</div>}

            {!loading && !err && (
              <div className="app-surface-light search-results-card" style={{ padding: 0 }}>
                <table className="table search-results-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Tag</th>
                      <th>Customer</th>
                      <th style={{ width: 135 }}>Phone</th>
                      <th style={{ width: 120 }}>Drop-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 14 }}>No results.</td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr
                        key={r.tag}
                        onClick={() => void loadDetails(r.tag!)}
                        onDoubleClick={() => openTag(r.tag!)}
                        style={{
                          cursor: 'pointer',
                          background: r.tag === selectedTag ? '#dcfce7' : undefined,
                          boxShadow: r.tag === selectedTag ? 'inset 5px 0 0 #2f7d42' : undefined,
                          color: r.tag === selectedTag ? '#111827' : undefined,
                        }}
                        title="Click for preview, double-click to open"
                      >
                        <td><strong>{r.tag}</strong></td>
                        <td>
                          <div style={{ fontWeight: 800 }}>{r.customer || '-'}</div>
                          <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>
                            {r.confirmation ? `Confirmation ${r.confirmation}` : 'No confirmation recorded'}
                          </div>
                        </td>
                        <td>{r.phone || '-'}</td>
                        <td>{formatDisplayDate(r.dropoff || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="search-results-mobile">
                  {rows.length === 0 ? (
                    <div style={{ padding: 14 }}>No results.</div>
                  ) : (
                    rows.map((r) => (
                      <button
                        key={`mobile-${r.tag}`}
                        type="button"
                        onClick={() => void loadDetails(r.tag!)}
                        onDoubleClick={() => openTag(r.tag!)}
                        className={`search-result-mobile-card ${r.tag === selectedTag ? 'selected' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', opacity: 0.66 }}>Tag</div>
                            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{r.tag || '-'}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', opacity: 0.66 }}>Drop-off</div>
                            <div style={{ marginTop: 2, fontWeight: 700 }}>{formatDisplayDate(r.dropoff || '')}</div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <div style={{ fontWeight: 800 }}>{r.customer || '-'}</div>
                          <div className="muted" style={{ fontSize: 13 }}>{r.phone || '-'}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.confirmation ? `Confirmation ${r.confirmation}` : 'No confirmation recorded'}
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
                    {selectedTag ? `Tag ${selectedTag}` : 'Click a result row to load details'}
                    {selectedJob?.confirmation ? ` | Confirmation ${selectedJob.confirmation}` : ''}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '.04em' }}>Actions</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" type="button" onClick={() => selectedTag && openTag(selectedTag)} disabled={!selectedTag}>
                      {canEdit ? 'Open Intake' : 'Open Details'}
                    </button>
                    <button className="btn" type="button" onClick={() => selectedTag && void printTag(selectedTag)} disabled={!selectedTag || printing === selectedTag}>
                      {printing === selectedTag ? 'Preparing...' : 'Print'}
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

              {detailLoading ? <div className="muted">Loading details...</div> : null}
              {detailErr ? <div className="card" style={{ borderColor: '#ef4444' }}>Error: {detailErr}</div> : null}

              {!selectedJob && !detailLoading && !detailErr ? (
                <div className="muted" style={{ padding: '8px 0' }}>
                  Choose a result on the left to see contact details, print history, and available actions.
                </div>
              ) : null}

              {selectedJob ? (
                <>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <DetailBox title="Quick Summary">
                      <div><strong>Status:</strong> {statusSummary}</div>
                      <div><strong>Phone:</strong> {selectedJob.phone || '-'}</div>
                      <div><strong>Email:</strong> {selectedJob.email || '-'}</div>
                      <div><strong>Confirmation:</strong> {selectedJob.confirmation || '-'}</div>
                      <div><strong>Processing paid:</strong> ${Number(selectedJob.amountPaidProcessing ?? selectedJob.amount_paid_processing ?? 0).toFixed(2)}</div>
                      <div><strong>Specialty paid:</strong> ${Number(selectedJob.amountPaidSpecialty ?? selectedJob.amount_paid_specialty ?? 0).toFixed(2)}</div>
                    </DetailBox>

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

        .search-preview-card {
          position: sticky;
          top: 88px;
          max-height: calc(100vh - 110px);
          overflow: auto;
        }

        @media (max-width: 1100px) {
          .search-layout {
            grid-template-columns: 1fr;
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
          .search-results-table {
            display: none;
          }

          .search-results-mobile {
            display: block;
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
