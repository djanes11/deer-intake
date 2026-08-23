'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { getJob as fetchJobFromApi, tokenHeader } from '@/lib/api';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import { openBrowserPrintPreview } from '@/app/lib/browserPrint';
import { DEFAULT_SITE_PRICING, normalizePricing } from '@/lib/pricing';
import { defaultSpecialtyCatalog, normalizeSpecialtyCatalog, type SpecialtyCatalogItem } from '@/lib/specialtyCatalog';

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
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [printJobs, setPrintJobs] = useState<AnyRec[]>([]);
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [specialtyEnabled, setSpecialtyEnabled] = useState(true);
  const [pricing, setPricing] = useState(DEFAULT_SITE_PRICING);
  const [specialtyCatalog, setSpecialtyCatalog] = useState<SpecialtyCatalogItem[]>(defaultSpecialtyCatalog(DEFAULT_SITE_PRICING));
  const [cutOptions, setCutOptions] = useState(normalizeCutOptionSettings({}));

  const refresh = async () => {
    setErr('');
    setLoading(true);
    try {
      const data = await fetchQueue();
      setRows(data);
      setSelectedTags((prev) => {
        const available = new Set(data.map((row) => String(row.tag || '').trim()).filter(Boolean));
        return new Set(Array.from(prev).filter((tag) => available.has(tag)));
      });
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
        const nextPricing = normalizePricing(j?.settings?.pricing ?? j?.settings);
        const nextSpecialtyEnabled = j?.settings?.features?.specialtyEnabled !== false;
        setPricing(nextPricing);
        setSpecialtyEnabled(nextSpecialtyEnabled);
        setSpecialtyCatalog(nextSpecialtyEnabled ? normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, nextPricing) : []);
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
    setPrintJobs([]);
    try {
      const job = await loadJob(normalized);
      if (!job) throw new Error(`Could not load intake sheet for tag ${normalized}.`);
      setPrintJobs([job]);

      await markPrinted(normalized);
      setRows((prev) => prev.filter((row) => String(row.tag || '') !== normalized));
      setSelectedTags((prev) => {
        const next = new Set(prev);
        next.delete(normalized);
        return next;
      });

      openBrowserPrintPreview(() => {
        setPrinting('');
        setPrintJobs([]);
      });
    } catch (e: any) {
      setErr(String(e?.message || e));
      setPrinting('');
      setPrintJobs([]);
    }
  };

  const visibleTags = useMemo(
    () => rows.map((row) => String(row.tag || '').trim()).filter(Boolean),
    [rows]
  );
  const selectedVisibleTags = useMemo(
    () => visibleTags.filter((tag) => selectedTags.has(tag)),
    [visibleTags, selectedTags]
  );
  const allSelected = visibleTags.length > 0 && selectedVisibleTags.length === visibleTags.length;

  const toggleSelected = (tag: string, selected: boolean) => {
    const normalized = String(tag || '').trim();
    if (!normalized || printing) return;
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (selected) next.add(normalized);
      else next.delete(normalized);
      return next;
    });
  };

  const toggleAll = (selected: boolean) => {
    if (printing) return;
    setSelectedTags(selected ? new Set(visibleTags) : new Set());
  };

  const printSelected = async () => {
    const tags = selectedVisibleTags;
    if (!tags.length) return;
    setErr('');
    setPrinting('__batch__');
    setPrintJobs([]);
    try {
      const jobs: AnyRec[] = [];
      for (const tag of tags) {
        const job = await loadJob(tag);
        if (!job) throw new Error(`Could not load intake sheet for tag ${tag}.`);
        jobs.push(job);
      }

      setPrintJobs(jobs);

      for (const tag of tags) {
        await markPrinted(tag);
      }

      const printed = new Set(tags);
      setRows((prev) => prev.filter((row) => !printed.has(String(row.tag || '').trim())));
      setSelectedTags(new Set());

      openBrowserPrintPreview(() => {
        setPrinting('');
        setPrintJobs([]);
      });
    } catch (e: any) {
      setErr(String(e?.message || e));
      setPrinting('');
      setPrintJobs([]);
    }
  };

  const header = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Print Queue</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.72 }}>
          Intake sheets that have not been marked printed yet.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{ opacity: 0.75 }}>{rows.length} waiting</div>
        <button
          onClick={printSelected}
          disabled={loading || !!printing || selectedVisibleTags.length === 0}
          className="btn"
        >
          {printing === '__batch__'
            ? 'Preparing Print...'
            : selectedVisibleTags.length
              ? `Print Selected (${selectedVisibleTags.length})`
              : 'Print Selected'}
        </button>
        <button onClick={refresh} disabled={loading} className="btn">
          {loading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="form-card print-queue">
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        {header}

        {err ? (
          <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 8 }}>
            {err}
          </div>
        ) : null}

        <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: '#f7f7f7', borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Unprinted Intake Sheets</div>
                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
                  Printing from here will mark the job as printed and remove it from this queue.
                </div>
              </div>
              {rows.length ? (
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    disabled={!!printing}
                  />
                  Select all
                </label>
              ) : null}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
              {selectedVisibleTags.length ? `${selectedVisibleTags.length} selected` : 'Select one or more sheets to batch print.'}
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
              const tag = String(r.tag || '').trim();
              const isPrinting = printing === tag;
              const checked = selectedTags.has(tag);
              return (
                <div
                  key={tag}
                  style={{ display: 'grid', gap: 12, padding: '16px', borderTop: '1px solid #eee', background: isPrinting ? '#fafaf9' : '#fff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        gap: 12,
                        alignItems: 'start',
                        minWidth: 0,
                        flex: '1 1 420px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleSelected(tag, e.target.checked)}
                        disabled={!!printing}
                        aria-label={`Select intake sheet for tag ${tag || 'unknown'}`}
                        style={{ marginTop: 8 }}
                      />
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
                    </label>
                  </div>

                  <div className="queue-actions">
                    <button className="btn" onClick={() => printTag(tag)} disabled={!!printing && !isPrinting}>
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
        {printJobs.map((job, index) => (
          <div
            key={`${String(job?.tag ?? job?.Tag ?? index)}-${index}`}
            className="batch-print-job"
          >
            <PrintSheet
              job={job}
              webbsEnabled={webbsEnabled}
              smsEnabled={smsEnabled}
              specialtyEnabled={specialtyEnabled}
              cutOptions={cutOptions}
              pricing={pricing}
              specialtyCatalog={specialtyCatalog}
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        .queue-actions {
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(220px, 280px);
          align-items: center;
        }
        .print-only {
          display: none;
        }
        @media (max-width: 720px) {
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
          .batch-print-job + .batch-print-job {
            break-before: page !important;
            page-break-before: always !important;
          }
        }
      `}</style>
    </div>
  );
}
