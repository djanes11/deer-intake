'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { getJob as fetchJobFromApi, tokenHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Row = {
  id?: string;
  tag?: string; // will be PENDING-....
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

export default function MissingTagsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  const [assigning, setAssigning] = useState<string>(''); // pendingTag being updated
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // pendingTag -> newTag draft

  const [selectedTag, setSelectedTag] = useState<string>(''); // real tag after assignment
  const [selectedJob, setSelectedJob] = useState<AnyRec | null>(null);
  const [jobErr, setJobErr] = useState<string>('');

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

  useEffect(() => {
    refresh();
  }, []);

  const count = rows.length;

  const openJob = async (tag: string) => {
    setSelectedTag(tag);
    setSelectedJob(null);
    setJobErr('');
    try {
      const j = await fetchJobFromApi(tag);
      setSelectedJob(j as AnyRec);
    } catch (e: any) {
      setJobErr(String(e?.message || e));
    }
  };

  const doAssign = async (row: Row) => {
    const pendingTag = row.tag || '';
    const draftKey = pendingTag || row.id || '';
    const raw = drafts[draftKey] ?? '';
    const newTag = digitsOnly(raw);

    if (!/^\d{5,}$/.test(newTag)) {
      setErr('Enter a valid tag number (digits only).');
      return;
    }

    setErr('');
    setAssigning(draftKey);
    try {
      await assignTag({ pendingTag, jobId: row.id, tag: newTag });

      // Remove this row from list immediately
      setRows((prev) => prev.filter((r) => r.id !== row.id));

      // Optionally auto-open print sheet
      await openJob(newTag);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setAssigning('');
    }
  };

  const header = useMemo(() => {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Missing Tag Report</div>
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
    <div className="form-card">
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        {header}

        {err ? (
          <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 8 }}>
            {err}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 12 }}>
          {/* Left: queue */}
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', background: '#f7f7f7', borderBottom: '1px solid #e5e5e5' }}>
              <div style={{ fontWeight: 700 }}>Overnight Deer Waiting For Tags</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
                Assign the real tag number, then preview and print the intake sheet.
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 12 }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 12 }}>No missing tags 🎯</div>
            ) : (
              rows.map((r) => {
                const pendingTag = r.tag || '';
                const draftKey = pendingTag || r.id || '';
                const isBusy = assigning === draftKey;

                return (
                  <div
                    key={pendingTag || r.id || Math.random()}
                    style={{
                      display: 'grid',
                      gap: 12,
                      padding: '14px 16px',
                      borderTop: '1px solid #eee',
                      background: isBusy ? '#fafaf9' : '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) auto auto', gap: 10, alignItems: 'center' }}>
                      <input
                        value={drafts[draftKey] ?? ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [draftKey]: e.target.value }))}
                        placeholder="Enter actual deer tag"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15 }}
                        disabled={isBusy || !r.id}
                      />
                      <button
                        className="btn"
                        onClick={() => doAssign(r)}
                        disabled={isBusy || !r.id}
                        style={{ whiteSpace: 'nowrap', minWidth: 94 }}
                      >
                        {isBusy ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          const draft = digitsOnly(drafts[draftKey] ?? '');
                          if (/^\d{5,}$/.test(draft)) openJob(draft);
                        }}
                        disabled={!/^\d{5,}$/.test(digitsOnly(drafts[draftKey] ?? ''))}
                        style={{ whiteSpace: 'nowrap', minWidth: 94 }}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: preview */}
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Job Preview</div>
            {selectedTag ? (
              <div style={{ marginBottom: 10, opacity: 0.8 }}>
                Tag: <span style={{ fontFamily: 'monospace' }}>{selectedTag}</span>
              </div>
            ) : (
              <div style={{ marginBottom: 10, opacity: 0.8 }}>Assign a tag to preview/print.</div>
            )}

            {jobErr ? (
              <div style={{ background: '#f8d7da', border: '1px solid #f5c2c7', padding: 10, borderRadius: 8 }}>
                {jobErr}
              </div>
            ) : null}

            {selectedJob ? <PrintSheet job={selectedJob} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
