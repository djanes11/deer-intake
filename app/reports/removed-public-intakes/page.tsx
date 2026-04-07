'use client';

import { useEffect, useState } from 'react';
import { tokenHeader } from '@/lib/api';

type Row = {
  id?: string | null;
  tag?: string | null;
  confirmation?: string | null;
  customer?: string | null;
  phone?: string | null;
  dropoff?: string | null;
  pendingDeletedAt?: string | null;
};

const API_REMOVED = '/api/v2/reports/removed-pending';
const API_RESTORE = '/api/v2/reports/restore-pending';

async function parseJsonSafe(r: Response) {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { __raw: t };
  }
}

export default function RemovedPublicIntakesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);

  const refresh = async () => {
    setErr('');
    setLoading(true);
    try {
      const r = await fetch(API_REMOVED, {
        cache: 'no-store',
        headers: tokenHeader(),
      });
      const data = await parseJsonSafe(r);
      if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
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

  const restore = async (row: Row) => {
    const jobId = String(row.id || '').trim();
    if (!jobId) return;
    const label = row.customer || row.confirmation || 'this public intake';
    const confirmed = window.confirm(`Restore ${label} to the active public intake queue?`);
    if (!confirmed) return;

    setBusy(jobId);
    setErr('');
    try {
      const r = await fetch(API_RESTORE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...tokenHeader() },
        cache: 'no-store',
        body: JSON.stringify({ jobId }),
      });
      const data = await parseJsonSafe(r);
      if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
      setRows((prev) => prev.filter((item) => String(item.id || '') !== jobId));
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="form-card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Removed Public Intakes</h1>
          <div className="muted" style={{ marginTop: 6 }}>
            Public no-shows removed from the active queue. Restore one here if it was removed by mistake.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="muted">{rows.length} removed</div>
          <button className="btn" type="button" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 8 }}>
          {err}
        </div>
      ) : null}

      {!canEdit ? (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: 10, borderRadius: 8, color: '#3730a3', fontWeight: 700 }}>
          Read-only access: you can review removed intakes here, but restoring them requires Staff or Admin access.
        </div>
      ) : null}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 800 }}>Recently Removed No-Shows</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            These are hidden from normal search and the active tag queue.
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>Loading...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>No removed public intakes right now.</div>
            <div className="muted" style={{ marginTop: 4 }}>You are all caught up.</div>
          </div>
        ) : (
          rows.map((row, idx) => {
            const id = String(row.id || '');
            return (
              <div
                key={id || `${row.tag}-${idx}`}
                style={{ padding: 16, borderTop: idx === 0 ? '0' : '1px solid #eef2f7', display: 'grid', gap: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{row.customer || 'Unnamed Customer'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                        Conf {row.confirmation || '-'}
                      </span>
                      <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 13 }}>
                        {row.phone || 'No phone'}
                      </span>
                      <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f3f4f6', fontSize: 13 }}>
                        Dropped off {fmtShortDate(row.dropoff)}
                      </span>
                      <span style={{ padding: '4px 8px', borderRadius: 999, background: '#fff7ed', color: '#9a3412', fontSize: 13, fontWeight: 700 }}>
                        Removed {fmtDateTime(row.pendingDeletedAt)}
                      </span>
                    </div>
                  </div>
                  <button className="btn" type="button" onClick={() => void restore(row)} disabled={!canEdit || busy === id}>
                    {busy === id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function fmtShortDate(v: string | null | undefined) {
  if (!v) return '-';
  return String(v).slice(0, 10);
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}
