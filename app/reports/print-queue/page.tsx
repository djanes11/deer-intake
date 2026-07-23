'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { getJob as fetchJobFromApi, tokenHeader } from '@/lib/api';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';

export const dynamic = 'force-dynamic';

type Row = {
  tag?: string | null;
  confirmation?: string | null;
  customer?: string | null;
  phone?: string | null;
  dropoff?: string | null;
  status?: string | null;
};

type AnyRec = Record<string, any>;

const API_QUEUE = '/api/v2/reports/print-queue';
const API_MARK = '/api/v2/reports/mark-printed';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { __raw: t };
  }
}

async function fetchQueue(): Promise<Row[]> {
  const r = await fetch(API_QUEUE, {
    cache: 'no-store',
    headers: tokenHeader(),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return Array.isArray(data?.rows) ? data.rows : [];
}

async function markPrinted(tag: string) {
  const r = await fetch(API_MARK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tokenHeader() },
    cache: 'no-store',
    body: JSON.stringify({ tag }),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export default function PrintQueuePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [printing, setPrinting] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedJob, setSelectedJob] = useState<AnyRec | null>(null);
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [specialtyEnabled, setSpecialtyEnabled] = useState(true);
  const [cutOptions, setCutOptions] = useState(normalizeCutOptionSettings({}));

  const refresh = async () => {
    setErr('');
    setLoading(true);
    try {
      const data = await fetchQueue();
      setRows(data);
      if (selectedTag && !data.some((row) => String(row.tag || '') === selectedTag)) {
        setSelectedTag('');
        setSelectedJob(null);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    fetch('/api/staff/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
        setSmsEnabled(j?.settings?.features?.smsEnabled !== false);
        setSpecialtyEnabled(j?.settings?.features?.specialtyEnabled !== false);
        setCutOptions(normalizeCutOptionSettings(j?.settings?.cutOptions));
      })
      .catch(() => {});
  }, []);

  const loadJob = async (tag: string) => {
    const normalized = String(tag || '').trim();
    if (!normalized) return null;
    try {
      const resp = await fetchJobFromApi(normalized);
      const job = (resp?.job || null) as AnyRec | null;
      if (!job) throw new Error('Could not load intake sheet.');
      setSelectedTag(normalized);
      setSelectedJob(job);
      return job;
    } catch (e: any) {
      setErr(String(e?.message || e));
      return null;
    }
  };

  const printTag = async (tag: string) => {
    const normalized = String(tag || '').trim();
    if (!normalized) return;
    setErr('');
    setPrinting(normalized);
    try {
      let job = selectedJob;
      const currentTag = String(selectedJob?.tag ?? selectedJob?.Tag ?? '').trim();
      if (!job || currentTag !== normalized) {
        job = await loadJob(normalized);
      }
      if (!job) return;

      await markPrinted(normalized);
      setRows((prev) => prev.filter((row) => String(row.tag || '') !== normalized));

      setTimeout(() => {
        window.print();
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setPrinting('');
    }
  };

  const header = useMemo(() => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Print Queue</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.72 }}>
          Intake sheets that have not been marked printed yet.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ opacity: 0.75 }}>{rows.length} waiting</div>
        <button onClick={refresh} disabled={loading} className="btn">
          Refresh
        </button>
      </div>
    </div>
  ), [rows.length, loading]);

  return (
    <div className="form-card print-queue">
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        {header}

        {selectedTag ? (
          <div className="selected-print-card" style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid #d7eadb', borderRadius: 12, background: '#f4fbf4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Selected For Print</div>
                <div style={{ marginTop: 4, fontSize: 15 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedTag}</span>
                  {selectedJob?.customer || selectedJob?.customer_name ? (
                    <span style={{ opacity: 0.75 }}> for {selectedJob.customer || selectedJob.customer_name}</span>
                  ) : null}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#3f5f43', lineHeight: 1.4 }}>
                  Next: refresh the sheet if needed, then print it once. Printing from this page removes it from the queue.
                </div>
              </div>
              <div className="selected-print-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => loadJob(selectedTag)} disabled={!!printing}>
                  Refresh Sheet
                </button>
                <button className="btn" onClick={() => printTag(selectedTag)} disabled={!!printing}>
                  {printing === selectedTag ? 'Preparing Print...' : 'Print & Mark Printed'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {err ? (
          <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 8 }}>
            {err}
          </div>
        ) : null}

        <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: '#f7f7f7', borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ fontWeight: 700 }}>Unprinted Intake Sheets</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
              Printing from here will mark the job as printed and remove it from this queue.
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 16 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>No intake sheets are waiting to be printed.</div>
              <div style={{ marginTop: 4, opacity: 0.72, lineHeight: 1.45 }}>
                You are caught up for now. New intake sheets will appear here after staff saves an order that has not been printed yet.
              </div>
            </div>
          ) : (
            rows.map((r) => {
              const tag = String(r.tag || '');
              const isPrinting = printing === tag;
              return (
                <div
                  key={tag}
                  style={{ display: 'grid', gap: 12, padding: '16px', borderTop: '1px solid #eee', background: isPrinting ? '#fafaf9' : '#fff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                        {r.customer || 'Unnamed Customer'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                          Tag {tag || '-'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                          Conf {r.confirmation || '-'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                          {r.phone || 'No phone'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontSize: 13 }}>
                          Dropped off {String(r.dropoff || '').slice(0, 10) || '-'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#eef6ee', color: '#2f6f3f', fontSize: 13, fontWeight: 600 }}>
                          {r.status || 'Dropped Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="queue-next">Next: load the sheet to review it, then print once and remove it from the queue.</div>

                  <div className="queue-actions">
                    <button className="btn" onClick={() => loadJob(tag)} disabled={isPrinting}>
                      Load Sheet
                    </button>
                    <button className="btn" onClick={() => printTag(tag)} disabled={isPrinting}>
                      {isPrinting ? 'Preparing Print...' : 'Print & Mark Printed'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="print-only">
        {selectedJob ? (
          <PrintSheet
            job={selectedJob}
            webbsEnabled={webbsEnabled}
            smsEnabled={smsEnabled}
            specialtyEnabled={specialtyEnabled}
            cutOptions={cutOptions}
          />
        ) : null}
      </div>

      <style jsx>{`
        .selected-print-card {
          box-shadow: 0 8px 18px rgba(47, 111, 63, 0.08);
        }
        .queue-next {
          font-size: 13px;
          font-weight: 700;
          color: #516a56;
          line-height: 1.4;
        }
        .queue-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: 180px 220px;
          align-items: center;
        }
        .print-only {
          display: none;
        }
        @media (max-width: 720px) {
          .selected-print-actions {
            width: 100%;
          }
          .selected-print-actions :global(button),
          .queue-actions {
            grid-template-columns: 1fr;
          }
          .queue-actions :global(button) {
            width: 100%;
          }
        }
        @media print {
          .print-queue > :not(.print-only) {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
