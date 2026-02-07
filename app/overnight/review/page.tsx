'use client';

import { useEffect, useMemo, useState } from 'react';
import PrintSheet from '@/app/components/PrintSheet';
import { getJob as fetchJobFromApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Row = {
  id?: string;
  tag?: string; // will be PENDING-....
  confirmation?: string;
  customer?: string;
  phone?: string;
  dropoff?: string;
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

// Name | Conf | Phone | Drop-off | Status | Pending Tag | Assign | Open
const GRID = '1.4fr 1.1fr 1.0fr 0.8fr 0.9fr 1.2fr 1.2fr 0.7fr';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { __raw: t };
  }
}

const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');

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
    customer: String(r?.customer ?? ''),
    phone: String(r?.phone ?? ''),
    dropoff: String(r?.dropoff ?? ''),
    status: String(r?.status ?? ''),
    webbs: normBool(r?.webbs),
    paidProcessing: normBool(r?.paid_processing ?? r?.paidProcessing),
    processType: String(r?.process_type ?? r?.processType ?? ''),
    priceProcessing: Number(r?.price_processing ?? r?.priceProcessing ?? 0) || 0,
    created_at: String(r?.created_at ?? ''),
  };
}

async function fetchMissing(limit = 500): Promise<Row[]> {
  const r = await fetch(`${API_MISSING}?limit=${limit}`, { cache: 'no-store' });
  const data = await parseJsonSafe(r);
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map(normRow);
}

async function assignTag(pendingTag: string, tag: string) {
  const r = await fetch(API_ASSIGN, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ pendingTag, tag }),
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

  const doAssign = async (pendingTag: string) => {
    const raw = drafts[pendingTag] ?? '';
    const newTag = digitsOnly(raw);

    if (!/^\d{5,}$/.test(newTag)) {
      setErr('Enter a valid tag number (digits only).');
      return;
    }

    setErr('');
    setAssigning(pendingTag);
    try {
      await assignTag(pendingTag, newTag);

      // Remove this row from list immediately
      setRows((prev) => prev.filter((r) => r.tag !== pendingTag));

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

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
          {/* Left: table */}
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 8,
                padding: '10px 12px',
                fontWeight: 700,
                background: '#f7f7f7',
              }}
            >
              <div>Name</div>
              <div>Conf</div>
              <div>Phone</div>
              <div>Drop-off</div>
              <div>Status</div>
              <div>Pending Tag</div>
              <div>Assign Tag</div>
              <div>Open</div>
            </div>

            {loading ? (
              <div style={{ padding: 12 }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 12 }}>No missing tags 🎯</div>
            ) : (
              rows.map((r) => {
                const pendingTag = r.tag || '';
                const isBusy = assigning === pendingTag;

                return (
                  <div
                    key={pendingTag || r.id || Math.random()}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: GRID,
                      gap: 8,
                      padding: '10px 12px',
                      borderTop: '1px solid #eee',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.customer || '-'}</div>
                    <div style={{ fontFamily: 'monospace' }}>{r.confirmation || '-'}</div>
                    <div style={{ fontFamily: 'monospace' }}>{r.phone || '-'}</div>
                    <div>{r.dropoff || '-'}</div>
                    <div>{r.status || '-'}</div>
                    <div style={{ fontFamily: 'monospace' }}>{pendingTag || '-'}</div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={drafts[pendingTag] ?? ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [pendingTag]: e.target.value }))}
                        placeholder="e.g. 12345"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
                        disabled={isBusy || !pendingTag}
                      />
                      <button
                        className="btn"
                        onClick={() => doAssign(pendingTag)}
                        disabled={isBusy || !pendingTag}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {isBusy ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    <div>
                      <button
                        className="btn"
                        onClick={() => {
                          const draft = digitsOnly(drafts[pendingTag] ?? '');
                          if (/^\d{5,}$/.test(draft)) openJob(draft);
                        }}
                        disabled={!/^\d{5,}$/.test(digitsOnly(drafts[pendingTag] ?? ''))}
                      >
                        Open
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
