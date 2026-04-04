'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintCapeLabel, type ThermalLabelType } from '@/app/components/ThermalLabelSheet';
import { getJob as fetchJobFromApi, tokenHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Row = {
  id?: string;
  tag?: string;
  confirmation?: string;
  customer_name?: string;
  phone?: string;
  dropoff_date?: string;
  status?: string;
  webbs?: boolean;
  paidProcessing?: boolean;
  processType?: string;
  priceProcessing?: number;
  created_at?: string;
};

type AnyRec = Record<string, any>;

const API_MISSING = '/api/v2/reports/missing-tags';
const API_ASSIGN = '/api/v2/reports/assign-tag';
const API_DELETE = '/api/v2/reports/delete-pending';
const API_MARK = '/api/v2/reports/mark-printed';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { __raw: t };
  }
}

const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');
const displayDate = (s?: string) => String(s || '').slice(0, 10) || '-';

function normBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'x';
}

function normRow(r: any): Row {
  return {
    id: r?.id,
    tag: String(r?.tag ?? ''),
    confirmation: String(r?.confirmation ?? ''),
    customer_name: String(r?.customer_name ?? ''),
    phone: String(r?.phone ?? ''),
    dropoff_date: String(r?.dropoff_date ?? ''),
    status: String(r?.status ?? ''),
    webbs: normBool(r?.webbs),
    paidProcessing: normBool(r?.paid_processing ?? r?.paidProcessing),
    processType: String(r?.process_type ?? r?.processType ?? ''),
    priceProcessing: Number(r?.price_processing ?? r?.priceProcessing ?? 0) || 0,
    created_at: String(r?.created_at ?? ''),
  };
}

async function fetchMissing(limit = 500): Promise<Row[]> {
  const r = await fetch(`${API_MISSING}?limit=${limit}`, {
    cache: 'no-store',
    headers: tokenHeader(),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map(normRow);
}

async function assignTag(opts: { pendingTag?: string; jobId?: string; tag: string }) {
  const r = await fetch(API_ASSIGN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tokenHeader() },
    cache: 'no-store',
    body: JSON.stringify(opts),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

async function deletePending(jobId: string) {
  const r = await fetch(API_DELETE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tokenHeader() },
    cache: 'no-store',
    body: JSON.stringify({ jobId }),
  });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
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

export default function MissingTagsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [assigning, setAssigning] = useState('');
  const [deleting, setDeleting] = useState('');
  const [printing, setPrinting] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [selectedTag, setSelectedTag] = useState('');
  const [selectedJob, setSelectedJob] = useState<AnyRec | null>(null);
  const [jobErr, setJobErr] = useState('');
  const [printMode, setPrintMode] = useState<'' | 'sheet' | ThermalLabelType>('');
  const [brandingName, setBrandingName] = useState('Wild Game Butcher Board');

  const refresh = async () => {
    setErr('');
    setLoading(true);
    try {
      const data = await fetchMissing(1000);
      setRows(data);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const setSelectedFromJob = (job: AnyRec | null, fallbackTag = '') => {
    const normalized = digitsOnly(String(job?.tag ?? job?.Tag ?? fallbackTag));
    setSelectedTag(normalized);
    setSelectedJob(job);
    setJobErr('');
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setBrandingName(String(j?.settings?.branding?.name || 'Wild Game Butcher Board'));
      })
      .catch(() => {});
  }, []);

  const count = rows.length;

  const loadJob = async (tag: string) => {
    const normalized = digitsOnly(tag);
    if (!normalized) return null;
    setSelectedTag(normalized);
    setSelectedJob(null);
    setJobErr('');
    try {
      const resp = await fetchJobFromApi(normalized);
      const job = (resp?.job || null) as AnyRec | null;
      if (!job) {
        throw new Error('Could not load intake sheet for that tag.');
      }
      setSelectedFromJob(job, normalized);
      return job;
    } catch (e: any) {
      setJobErr(String(e?.message || e));
      return null;
    }
  };

  const printAssignedSheet = async (tag: string) => {
    const normalized = digitsOnly(tag);
    if (!normalized) return;

    setErr('');
    setPrinting(normalized);

    try {
      let job = selectedJob;
      const currentTag = digitsOnly(String(selectedJob?.tag ?? selectedJob?.Tag ?? ''));
      if (!job || currentTag !== normalized) {
        job = await loadJob(normalized);
      }
      if (!job) return;

      await markPrinted(normalized);
      setPrintMode('sheet');

      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(''), 300);
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setJobErr(String(e?.message || e));
      setPrinting('');
    }
  };

  const printAssignedLabel = async (tag: string, type: ThermalLabelType) => {
    const normalized = digitsOnly(tag);
    if (!normalized) return;

    setErr('');
    setPrinting(normalized);

    try {
      let job = selectedJob;
      const currentTag = digitsOnly(String(selectedJob?.tag ?? selectedJob?.Tag ?? ''));
      if (!job || currentTag !== normalized) {
        job = await loadJob(normalized);
      }
      if (!job) return;

      setPrintMode(type);
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(''), 300);
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setJobErr(String(e?.message || e));
      setPrinting('');
    }
  };

  const doAssign = async (row: Row) => {
    const pendingTag = row.tag || '';
    const draftKey = pendingTag || row.id || '';
    const newTag = digitsOnly(drafts[draftKey] ?? '');

    if (!/^\d{5,}$/.test(newTag)) {
      setErr('Enter a valid tag number (digits only).');
      return;
    }

    setErr('');
    setAssigning(draftKey);
    try {
      const result = await assignTag({ pendingTag, jobId: row.id, tag: newTag });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      if (result?.job) {
        setSelectedFromJob(result.job as AnyRec, newTag);
      } else {
        await loadJob(newTag);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAssigning('');
    }
  };

  const doDelete = async (row: Row) => {
    if (!row.id) {
      setErr('Missing job id for this overnight record.');
      return;
    }

    const label = row.customer_name || row.confirmation || 'this public intake';
    const confirmed = window.confirm(`Remove ${label} from the public intake queue as a no-show? It will leave the active queue but stay in history.`);
    if (!confirmed) return;

    setErr('');
    setDeleting(row.id);
    try {
      await deletePending(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setDeleting('');
    }
  };

  const header = useMemo(() => {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Public Intake Queue</div>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.72 }}>
            Assign the real deer tag, then print the full intake sheet with the barcode.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ opacity: 0.75 }}>{count} pending</div>
          <button onClick={refresh} disabled={loading} className="btn">
            Refresh
          </button>
        </div>
      </div>
    );
  }, [count, loading]);

  return (
    <div className="form-card overnight-review">
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        {header}

        {selectedTag ? (
          <div
            style={{
              display: 'grid',
              gap: 10,
              padding: 14,
              border: '1px solid #d7eadb',
              borderRadius: 12,
              background: '#f4fbf4',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Last Assigned Tag</div>
                <div style={{ marginTop: 4, fontSize: 15 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedTag}</span>
                  {selectedJob?.customer || selectedJob?.customer_name ? (
                    <span style={{ opacity: 0.75 }}> for {selectedJob.customer || selectedJob.customer_name}</span>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => loadJob(selectedTag)} disabled={!!printing}>
                  Refresh Sheet
                </button>
                <button className="btn" onClick={() => printAssignedSheet(selectedTag)} disabled={!!printing}>
                  {printing === selectedTag ? 'Preparing Print...' : 'Print Full Sheet'}
                </button>
                <button className="btn secondary" onClick={() => void printAssignedLabel(selectedTag, 'deer')} disabled={!!printing}>
                  Deer Label
                </button>
                {canPrintCapeLabel(selectedJob) ? (
                  <button className="btn secondary" onClick={() => void printAssignedLabel(selectedTag, 'cape')} disabled={!!printing}>
                    Cape Label
                  </button>
                ) : null}
                <button className="btn secondary" onClick={() => void printAssignedLabel(selectedTag, 'package')} disabled={!!printing}>
                  Package Label
                </button>
              </div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.72 }}>
              This prints the same intake sheet used at the counter, including the assigned tag and barcode.
            </div>
          </div>
        ) : null}

        {err ? (
          <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 8 }}>
            {err}
          </div>
        ) : null}

        {jobErr ? (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c2c7', padding: 10, borderRadius: 8 }}>
            {jobErr}
          </div>
        ) : null}

        <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', background: '#f7f7f7', borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ fontWeight: 700 }}>Public Intakes Waiting For Real Tags</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
              Assign the real deer tag, then print the full intake sheet with the barcode. Use delete for a no-show that should leave the active queue.
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 16 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>No overnight deer are waiting for tags.</div>
              <div style={{ marginTop: 4, opacity: 0.72 }}>You are caught up for now.</div>
            </div>
          ) : (
            rows.map((r) => {
              const pendingTag = r.tag || '';
              const draftKey = pendingTag || r.id || '';
              const isBusy = assigning === draftKey;
              const isDeleting = deleting === r.id;
              const draft = digitsOnly(drafts[draftKey] ?? '');
              const canUseDraft = /^\d{5,}$/.test(draft);
              return (
                <div
                  key={pendingTag || r.id || Math.random()}
                  style={{
                    display: 'grid',
                    gap: 12,
                    padding: '16px',
                    borderTop: '1px solid #eee',
                    background: isBusy ? '#fafaf9' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                        {r.customer_name || 'Unnamed Customer'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                          Conf {r.confirmation || '-'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                          {r.phone || 'No phone'}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontSize: 13 }}>
                          Dropped off {displayDate(r.dropoff_date)}
                        </span>
                        <span style={{ padding: '4px 8px', borderRadius: 999, background: '#eef6ee', color: '#2f6f3f', fontSize: 13, fontWeight: 600 }}>
                          {r.status || 'Dropped Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="queue-actions">
                    <input
                      value={drafts[draftKey] ?? ''}
                      onChange={(e) => setDrafts((p) => ({ ...p, [draftKey]: e.target.value }))}
                      placeholder="Enter actual deer tag"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15 }}
                      disabled={isBusy || isDeleting || !r.id}
                    />
                    <div className="queue-action-buttons">
                      <button className="btn btn-compact" onClick={() => doAssign(r)} disabled={isBusy || isDeleting || !r.id}>
                        {isBusy ? 'Saving...' : 'Assign Tag'}
                      </button>
                      <button
                        className="btn btn-compact btn-danger"
                        onClick={() => doDelete(r)}
                        disabled={isBusy || isDeleting || !r.id}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="print-only">
        {printMode === 'sheet' && selectedJob ? <PrintSheet job={selectedJob} /> : null}
        {printMode === 'deer' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="deer" brandingName={brandingName} /> : null}
        {printMode === 'cape' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="cape" brandingName={brandingName} /> : null}
        {printMode === 'package' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="package" brandingName={brandingName} /> : null}
      </div>

      <style jsx>{`
        .btn {
          padding: 10px 14px;
          border: 0;
          border-radius: 10px;
          background: #367d45;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .queue-actions {
          display: grid;
          grid-template-columns: minmax(240px, 320px) auto;
          gap: 10px;
          align-items: center;
        }

        .queue-action-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-start;
        }

        .btn-compact {
          padding: 10px 16px;
          min-width: 132px;
          text-align: center;
        }

        .btn-danger {
          background: #7f1d1d;
        }

        .print-only {
          display: none;
        }

        @media (max-width: 900px) {
          .queue-actions {
            grid-template-columns: minmax(0, 1fr) auto;
          }
        }

        @media (max-width: 720px) {
          .queue-actions {
            grid-template-columns: 1fr;
          }

          .queue-action-buttons {
            width: 100%;
          }

          .btn-compact {
            flex: 1;
            min-width: 0;
          }
        }

        @media print {
          .overnight-review > :not(.print-only) {
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
