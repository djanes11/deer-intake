'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintCapeLabel, type ThermalLabelType } from '@/app/components/ThermalLabelSheet';
import type { Job } from '@/lib/api';
import { getJob, searchJobs, tokenHeader } from '@/lib/api';

const API_RESEND = '/api/v2/reports/resend-notification';
const API_RESET = '/api/v2/reports/reset-notification';
const API_UNPRINT = '/api/v2/reports/mark-unprinted';
const API_MARK = '/api/v2/reports/mark-printed';
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
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [brandingName, setBrandingName] = useState('Wild Game Butcher Board');
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
    router.push(`/intake?tag=${encodeURIComponent(tag)}`);
  };

  const loadDetails = async (tag: string) => {
    if (!tag) return;
    setSelectedTag(tag);
    setDetailLoading(true);
    setDetailErr(null);
    setResendMsg(null);
    setPrintMsg(null);
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
    const proc = selectedJob.paidProcessing ? 'Processing paid' : 'Processing unpaid';
    const spec = selectedJob.specialtyProducts
      ? selectedJob.paidSpecialty
        ? 'Specialty paid'
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
    <main>
      <h1>Search</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
        Type a <b>tag</b>, <b>name</b>, <b>phone</b>, or status text. Shortcuts: <code>@report</code> (ready to call) | <code>@recall</code> (called).
      </p>

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. 12345 or Jane Doe or (555) 123-4567"
            aria-label="Search query"
            style={{ flex: 1 }}
          />
          <button className="btn" type="submit">Search</button>
        </form>
      </div>

      {!canShowResults && (
        <div className="card" style={{ padding: 14 }}>
          Start typing to search...
        </div>
      )}

      {canShowResults && (
        <div className="search-layout">
          <section className="search-results-col">
            {loading && <div className="card">Loading...</div>}
            {err && <div className="card" style={{ borderColor: '#ef4444' }}>Error: {err}</div>}

            {!loading && !err && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%' }}>
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
                        <td>{r.customer || '-'}</td>
                        <td>{r.phone || '-'}</td>
                        <td>{r.dropoff || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="search-preview-col">
            <div className="card search-preview-card" style={{ padding: 16, display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.04em' }}>Preview</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{selectedJob?.customer || selectedTag || 'Select a deer'}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {selectedTag ? `Tag ${selectedTag}` : 'Click a result row to load details'}
                    {selectedJob?.confirmation ? ` | Confirmation ${selectedJob.confirmation}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" type="button" onClick={() => selectedTag && openTag(selectedTag)} disabled={!selectedTag}>
                    Open Intake
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

              {detailLoading ? <div className="muted">Loading details...</div> : null}
              {detailErr ? <div className="card" style={{ borderColor: '#ef4444' }}>Error: {detailErr}</div> : null}

              {!selectedJob && !detailLoading && !detailErr ? (
                <div className="muted" style={{ padding: '8px 0' }}>
                  Choose a result on the left to see contact details, print history, and resend controls.
                </div>
              ) : null}

              {selectedJob ? (
                <>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <DetailBox title="Contact">
                      <div><strong>Preferred:</strong> {preferredContact}</div>
                      <div><strong>Phone:</strong> {selectedJob.phone || '-'}</div>
                      <div><strong>Email:</strong> {selectedJob.email || '-'}</div>
                      <div><strong>Status:</strong> {selectedJob.status || '-'}</div>
                    </DetailBox>

                    <DetailBox title="Payment & Print">
                      <div><strong>Payment:</strong> {paymentSummary}</div>
                      <div><strong>Last printed:</strong> {fmtDate(selectedJob.intakeSheetPrintedAt)}</div>
                      <div><strong>Print count:</strong> {selectedJob.intakeSheetPrintCount ?? 0}</div>
                      <div><strong>Last updated:</strong> {fmtDate(selectedJob.updatedAt)}</div>
                      <div style={{ paddingTop: 6 }}>
                        <button className="btn" type="button" onClick={() => void markUnprinted()} disabled={!selectedJob.intakeSheetPrintedAt}>
                          Mark Unprinted
                        </button>
                      </div>
                      {printMsg ? <div className="muted" style={{ fontSize: 13 }}>{printMsg}</div> : null}
                    </DetailBox>

                    <DetailBox title={webbsEnabled ? 'Webbs & Specialty' : 'Specialty'}>
                      {webbsEnabled ? (
                        <>
                          <div><strong>Webbs paper form:</strong> {selectedJob.webbsPaperFormCompleted ? 'Completed' : 'Not marked'}</div>
                          <div><strong>Webbs:</strong> {selectedJob.webbsOrder ? webbsStyleLabel(selectedJob.webbsOrderStyle) : 'No Webbs order'}</div>
                        </>
                      ) : null}
                      <div><strong>Specialty:</strong> {selectedJob.specialtyProducts ? 'Selected' : 'Not selected'}</div>
                    </DetailBox>

                    <DetailBox title="Last Actions">
                      <div><strong>Last notification:</strong> {fmtDate(latestNotificationAt)}</div>
                      <div><strong>Last drop-off text/email:</strong> {fmtDate(selectedJob.dropoffSmsSentAt || selectedJob.dropoffEmailSentAt)}</div>
                      <div><strong>Pending intake removed:</strong> {fmtDate(selectedJob.pendingDeletedAt)}</div>
                    </DetailBox>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>Notification History</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {notificationRows.map((row) => (
                        <div key={row.label} style={{ border: '1px solid #d1d5db', borderRadius: 12, background: '#ffffff', padding: 12, display: 'grid', gap: 8, color: '#111827' }}>
                          <div style={{ fontWeight: 900, color: '#111827' }}>{row.label}</div>
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
        {printMode === 'sheet' && printJob ? <PrintSheet job={printJob} /> : null}
        {printMode === 'deer' && printJob ? <ThermalLabelSheet job={printJob} type="deer" brandingName={brandingName} /> : null}
        {printMode === 'cape' && printJob ? <ThermalLabelSheet job={printJob} type="cape" brandingName={brandingName} /> : null}
        {printMode === 'package' && printJob ? <ThermalLabelSheet job={printJob} type="package" brandingName={brandingName} /> : null}
      </div>

      <style jsx>{`
        .print-only {
          display: none;
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

        .search-results-col :global(.card) {
          max-height: calc(100vh - 220px);
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

          .search-results-col :global(.card) {
            max-height: none;
            overflow: visible;
          }

          .search-preview-card {
            position: static;
            max-height: none;
            overflow: visible;
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
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
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
