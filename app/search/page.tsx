'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrintSheet from '@/app/components/PrintSheet';
import type { Job } from '@/lib/api';
import { getJob, searchJobs } from '@/lib/api';

export default function SearchPage() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState('');
  const [printJob, setPrintJob] = useState<Record<string, any> | null>(null);
  const debounced = useDebounced(q, 300);

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

  const printTag = async (tag: string) => {
    if (!tag) return;
    setPrinting(tag);
    setErr(null);
    try {
      const res = await getJob(tag);
      const job = (res?.job || null) as Record<string, any> | null;
      if (!job) throw new Error('Could not load intake sheet for printing.');
      setPrintJob(job);
      setTimeout(() => {
        window.print();
        setPrinting('');
      }, 150);
    } catch (e: any) {
      setErr(e?.message || 'Print failed');
      setPrinting('');
    }
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
        <>
          {loading && <div className="card">Loading...</div>}
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
                    <th style={{ width: 190 }} />
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
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                          <button
                            type="button"
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              void printTag(r.tag!);
                            }}
                            disabled={printing === r.tag}
                          >
                            {printing === r.tag ? 'Preparing...' : 'Print'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="print-only">{printJob ? <PrintSheet job={printJob} /> : null}</div>

      <style jsx>{`
        .print-only {
          display: none;
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

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
