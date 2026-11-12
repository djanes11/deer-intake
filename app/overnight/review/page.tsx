'use client';

import { NEEDS_TAG_COLUMNS, normRow, needsTagPayment, processingDue, sortNeedsTagRows, type Row, type NeedsTagSortKey } from '@/lib/needsTagQueue';
import { formatDisplayDateTime } from '@/lib/dateFormat';
import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import ThermalLabelSheet, { canPrintAntlerLabel, type ThermalLabelPrintMode } from '@/app/components/ThermalLabelSheet';
import { confirmIntakePrint, openBrowserPrintPreview } from '@/app/lib/browserPrint';
import { getJob as fetchJobFromApi, tokenHeader } from '@/lib/api';
import { normalizeCutOptionSettings } from '@/lib/cutOptions';
import { DEFAULT_SITE_PRICING, normalizePricing } from '@/lib/pricing';
import { defaultSpecialtyCatalog, normalizeSpecialtyCatalog, type SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import { identifierSettingsFromPublicCopy, normalizeTagInput, tagInputMode, validateTag } from '@/lib/identifiers';

export const dynamic = 'force-dynamic';

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
  const [sortKey, setSortKey] = useState<NeedsTagSortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const sortedRows = useMemo(() => sortNeedsTagRows(rows, sortKey, sortDirection), [rows, sortKey, sortDirection]);
  function changeSort(key: NeedsTagSortKey) {
    if (sortKey === key) setSortDirection(v => v === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  }
  const [err, setErr] = useState('');

  const [assigning, setAssigning] = useState('');
  const [deleting, setDeleting] = useState('');
  const [printing, setPrinting] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [selectedTag, setSelectedTag] = useState('');
  const [selectedJob, setSelectedJob] = useState<AnyRec | null>(null);
  const [jobErr, setJobErr] = useState('');
  const [printMode, setPrintMode] = useState<'' | 'sheet' | ThermalLabelPrintMode>('');
  const [brandingName, setBrandingName] = useState('Wild Game Butcher Board');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('/wgbb-logo.png');
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [specialtyEnabled, setSpecialtyEnabled] = useState(true);
  const [pricing, setPricing] = useState(DEFAULT_SITE_PRICING);
  const [specialtyCatalog, setSpecialtyCatalog] = useState<SpecialtyCatalogItem[]>(defaultSpecialtyCatalog(DEFAULT_SITE_PRICING));
  const [cutOptions, setCutOptions] = useState(normalizeCutOptionSettings({}));
  const [identifierSettings, setIdentifierSettings] = useState(() => identifierSettingsFromPublicCopy(null));
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);

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
    const normalized = normalizeTagInput(String(job?.tag ?? job?.Tag ?? fallbackTag), identifierSettings);
    setSelectedTag(normalized);
    setSelectedJob(job);
    setJobErr('');
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    fetch('/api/staff/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setBrandingName(String(j?.settings?.branding?.name || 'Wild Game Butcher Board'));
        setBrandingLogoUrl(String(j?.settings?.branding?.logoUrl || '/wgbb-logo.png'));
        setWebbsEnabled(j?.settings?.features?.webbsEnabled !== false);
        setSmsEnabled(j?.settings?.features?.smsEnabled !== false);
        const nextPricing = normalizePricing(j?.settings?.pricing ?? j?.settings);
        const nextSpecialtyEnabled = j?.settings?.features?.specialtyEnabled !== false;
        setPricing(nextPricing);
        setSpecialtyEnabled(nextSpecialtyEnabled);
        setSpecialtyCatalog(nextSpecialtyEnabled ? normalizeSpecialtyCatalog(j?.settings?.specialtyCatalog, nextPricing) : []);
        setCutOptions(normalizeCutOptionSettings(j?.settings?.cutOptions));
        setIdentifierSettings(identifierSettingsFromPublicCopy(j?.settings?.publicCopy));
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

  const canEdit = staffRole === 'admin' || staffRole === 'staff';

  const count = rows.length;

  const loadJob = async (tag: string) => {
    const normalized = normalizeTagInput(tag, identifierSettings);
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
    const normalized = normalizeTagInput(tag, identifierSettings);
    if (!normalized) return;

    setErr('');
    setPrinting(normalized);

    try {
      let job = selectedJob;
      const currentTag = normalizeTagInput(String(selectedJob?.tag ?? selectedJob?.Tag ?? ''), identifierSettings);
      if (!job || currentTag !== normalized) {
        job = await loadJob(normalized);
      }
      if (!job) return;

      setPrintMode('sheet');
      try {
        if (await confirmIntakePrint()) await markPrinted(normalized);
      } finally {
        setPrintMode('');
        setPrinting('');
      }
    } catch (e: any) {
      setJobErr(String(e?.message || e));
      setPrinting('');
    }
  };

  const printAssignedLabel = async (tag: string, type: ThermalLabelPrintMode) => {
    const normalized = normalizeTagInput(tag, identifierSettings);
    if (!normalized) return;

    setErr('');
    setPrinting(normalized);

    try {
      let job = selectedJob;
      const currentTag = normalizeTagInput(String(selectedJob?.tag ?? selectedJob?.Tag ?? ''), identifierSettings);
      if (!job || currentTag !== normalized) {
        job = await loadJob(normalized);
      }
      if (!job) return;

      setPrintMode(type);
      openBrowserPrintPreview(() => {
        setPrintMode('');
        setPrinting('');
      });
    } catch (e: any) {
      setJobErr(String(e?.message || e));
      setPrinting('');
    }
  };

  const doAssign = async (row: Row) => {
    const pendingTag = row.tag || '';
    const draftKey = pendingTag || row.id || '';
    const newTag = normalizeTagInput(drafts[draftKey] ?? '', identifierSettings);

    const tagError = validateTag(newTag, identifierSettings);
    if (tagError) {
      setErr(tagError);
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
      await refresh();
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
                {canPrintAntlerLabel(selectedJob) ? (
                  <button className="btn secondary" onClick={() => void printAssignedLabel(selectedTag, 'antler')} disabled={!!printing}>
                    Antler Tag
                  </button>
                ) : null}
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

        {!canEdit ? (
          <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: 10, borderRadius: 8, color: '#3730a3', fontWeight: 700 }}>
            Read-only access: you can review and print these public intakes, but assigning real tags or removing no-shows requires Staff or Admin access.
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

          <div className="queue-sort-controls">
            <label>Sort by <select value={sortKey} onChange={e => { setSortKey(e.target.value as NeedsTagSortKey); setSortDirection('asc'); }}>{NEEDS_TAG_COLUMNS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <button type="button" className="sort-button" onClick={() => setSortDirection(v => v === 'asc' ? 'desc' : 'asc')}>{sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</button>
          </div>
          <div className="queue-scroll">
          {!loading && rows.length > 0 && <div className="queue-columns queue-head">
            {NEEDS_TAG_COLUMNS.map(([key, label]) => <div key={key}>
              <button type="button" className="sort-button" aria-label={label + (sortKey === key ? ', sorted ' + (sortDirection === 'asc' ? 'ascending' : 'descending') : ', sort ascending')} onClick={() => changeSort(key)}>{label} {sortKey === key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</button>
            </div>)}
          </div>}
          {loading ? (
            <div style={{ padding: 16 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>No overnight deer are waiting for tags.</div>
              <div style={{ marginTop: 4, opacity: 0.72 }}>You are caught up for now.</div>
            </div>
          ) : (
            sortedRows.map((r) => {
              const pendingTag = r.tag || '';
              const draftKey = pendingTag || r.id || '';
              const isBusy = assigning === draftKey;
              const isDeleting = deleting === r.id;
              const draft = normalizeTagInput(drafts[draftKey] ?? '', identifierSettings);
              const canUseDraft = !validateTag(draft, identifierSettings);
              return (
                <div
                  key={r.id || pendingTag}
                  className="queue-row"
                  style={{
                    display: 'grid',
                    gap: 12,
                    padding: '16px',
                    borderTop: '1px solid #eee',
                    background: isBusy ? '#fafaf9' : '#fff',
                  }}
                >
                  <div className="queue-columns queue-details">
                    <div><span className="cell-label">Customer</span><strong>{r.customer_name || 'Unnamed Customer'}</strong></div>
                    <div><span className="cell-label">Confirmation</span>{r.confirmation || '-'}</div>
                    <div><span className="cell-label">Phone</span>{r.phone || '-'}</div>
                    <div><span className="cell-label">Dropped off</span>{displayDate(r.dropoff_date)}</div>
                    <div><span className="cell-label">Status</span>{r.status || 'Dropped Off'}</div>
                    <div><span className="cell-label">Processing type</span>{r.processType || '-'}</div>
                    <div><span className="cell-label">Webb’s</span><span className={r.webbs ? 'queue-badge webbs' : ''}>{r.webbs ? 'Yes' : 'No'}</span></div>
                    <div><span className="cell-label">Processing payment</span><span className={'queue-badge ' + (processingDue(r) > 0 ? 'unpaid' : 'paid')}>{needsTagPayment(r)}</span>{processingDue(r) > 0 && <div className="queue-due">${processingDue(r).toFixed(2)} due</div>}</div>
                    <div><span className="cell-label">Submitted</span>{r.created_at ? formatDisplayDateTime(r.created_at) : '-'}</div>
                  </div>

                  <div className="queue-actions">
                    <input
                      value={drafts[draftKey] ?? ''}
                      onChange={(e) => setDrafts((p) => ({ ...p, [draftKey]: normalizeTagInput(e.target.value, identifierSettings) }))}
                      placeholder={identifierSettings.tagPlaceholder || 'Enter actual deer tag'}
                      inputMode={tagInputMode(identifierSettings)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15 }}
                      disabled={!canEdit || isBusy || isDeleting || !r.id}
                    />
                    <div className="queue-action-buttons">
                      <button className="btn btn-compact" onClick={() => doAssign(r)} disabled={!canEdit || isBusy || isDeleting || !r.id}>
                        {isBusy ? 'Saving...' : 'Assign Tag'}
                      </button>
                      <button
                        className="btn btn-compact btn-danger"
                        onClick={() => doDelete(r)}
                        disabled={!canEdit || isBusy || isDeleting || !r.id}
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
      </div>

      <div className="print-only">
        {printMode === 'sheet' && selectedJob ? (
          <PrintSheet
            job={selectedJob}
            webbsEnabled={webbsEnabled}
            smsEnabled={smsEnabled}
            specialtyEnabled={specialtyEnabled}
            cutOptions={cutOptions}
            pricing={pricing}
            specialtyCatalog={specialtyCatalog}
          />
        ) : null}
        {printMode === 'deer' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="deer" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
        {printMode === 'antler' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="antler" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
        {printMode === 'deer-antler' && selectedJob ? <ThermalLabelSheet job={selectedJob} type="deer-antler" brandingName={brandingName} brandingLogoUrl={brandingLogoUrl} /> : null}
      </div>

      <style jsx>{`
        .queue-scroll { overflow-x: auto; min-width: 0; max-width: 100%; }
        .queue-columns { display: grid; grid-template-columns: minmax(160px, 1fr) 150px 130px 105px 100px 140px 65px 135px 150px; gap: 10px; align-items: start; }
        .queue-row, .queue-head { min-width: 1247px; box-sizing: border-box; }
        .queue-head { padding: 12px 16px; background: #f3f4f6; font-weight: 700; }
        .queue-details > div { min-width: 0; overflow-wrap: anywhere; }
        .cell-label { display: none; }
        .queue-sort-controls { padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
        .sort-button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: left; padding: 0; }
        .sort-button:focus-visible { outline: 2px solid #367d45; outline-offset: 3px; }
        .queue-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .queue-badge.paid { background: #dcfce7; color: #166534; }
        .queue-badge.unpaid { background: #ffedd5; color: #9a3412; }
        .queue-badge.webbs { background: #dbeafe; color: #1e40af; }
        .queue-due { margin-top: 4px; font-size: 13px; }
        @media (max-width: 720px) {
          .queue-row { min-width: 0; }
          .queue-head { display: none; }
          .queue-details { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .queue-details > div:first-child { grid-column: 1 / -1; font-size: 20px; }
          .cell-label { display: block; font-size: 11px; font-weight: 700; opacity: 0.7; margin-bottom: 4px; }
        }

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
