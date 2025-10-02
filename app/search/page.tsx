'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/api';
import { searchJobs } from '@/lib/api';

export default function SearchPage() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounced = useDebounced(q, 300);

  // Only search when there is a non-empty query
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
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const openTag = (tag: string) => {
    if (!tag) return;
    router.push(`/intake?tag=${encodeURIComponent(tag)}`);
  };

  const canShowResults = q.trim().length > 0;

  return (
    <main>
      <h1>Search</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
        Type a <b>tag</b>, <b>name</b>, <b>phone</b>, or status text. Shortcuts: <code>@report</code> (ready to call) · <code>@recall</code> (called).
      </p>

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // no-op; we already debounce on type
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

      {/* Before typing, keep the page clean */}
      {!canShowResults && (
        <div className="card" style={{ padding: 14 }}>
          Start typing to search…
        </div>
      )}

      {/* Results / states only render after user typed something */}
      {canShowResults && (
        <>
          {loading && <div className="card">Loading…</div>}
          {err && <div className="card" style={{ borderColor: '#ef4444' }}>Error: {err}</div>}

          {!loading && !err && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Tag</th>
                    <th>Customer</th>
                    <th style={{ width: 160 }}>Phone</th>
                    <th style={{ width: 140 }}>Drop-off</th>
                    <th>Status</th>
                    <th>Caping</th>
                    <th>Webbs</th>
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 14 }}>No results.</td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr
                      key={r.tag}
                      onDoubleClick={() => openTag(r.tag!)}
                      style={{ cursor: 'pointer' }}
                      title="Double-click to open"
                    >
                      <td><strong>{r.tag}</strong></td>
                      <td>{r.customer || '—'}</td>
                      <td>{r.phone || '—'}</td>
                      <td>{r.dropoff || '—'}</td>
                      <td>{r.status || '—'}</td>
                      <td>{r.capingStatus || '—'}</td>
                      <td>{r.webbsStatus || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTag(r.tag!);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ---- tiny hook: debounce any string value ---- */
function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}


