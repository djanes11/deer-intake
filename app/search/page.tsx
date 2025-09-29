'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { searchJobs } from '@/lib/api';

type Row = {
  row?: number;
  tag: string;
  customer?: string; // sometimes "Customer Name"
  name?: string;     // sometimes "Customer"
  phone?: string;
  status?: string;
  dropoff?: string;
  url?: string;      // optional deep-link from backend
};

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);

  // keep it simple: require 2+ chars before searching
  const debouncedQ = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setErr('');
      if (debouncedQ.length < 2) {
        setRows([]);
        return;
      }
      try {
        setLoading(true);
        // explicit object call matches our helper -> /api/gas/search
        const res = await searchJobs({ q: debouncedQ, limit: 50, offset: 0 });
        if (!res?.ok) {
          setErr(res?.error || 'Search failed');
          setRows([]);
        } else {
          setRows((res.rows || []) as Row[]);
        }
      } catch (e: any) {
        setErr(e?.message || 'Search failed');
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  return (
    <div className="wrap">
      <h2>Search</h2>

      <div className="bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by tag, name, or phone…"
          aria-label="Search"
        />
        <div className="hint">Type at least 2 characters</div>
      </div>

      {err && <div className="err">{err}</div>}
      {loading && <div className="muted">Searching…</div>}
      {!loading && !err && debouncedQ && rows.length === 0 && (
        <div className="muted">No matches.</div>
      )}

      {rows.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Drop-off</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tag = r.tag;
              const customer = r.customer || r.name || '—';
              // open the butcher-friendly intake by default
              const href = `/intake?tag=${encodeURIComponent(r.tag)}`;
              return (
                <tr key={`${tag}-${r.row ?? i}`}>
                  <td>{tag}</td>
                  <td>{customer}</td>
                  <td>{r.phone || ''}</td>
                  <td>{r.status || ''}</td>
                  <td>{r.dropoff || ''}</td>
                  <td><Link href={href}>Open</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <style jsx>{`
        .wrap { max-width: 900px; margin: 16px auto; padding: 12px; font-family: Arial, sans-serif; }
        h2 { margin: 0 0 8px; }
        .bar { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; margin-bottom: 10px; }
        input { width: 100%; padding: 8px 10px; border: 1px solid #d8e3f5; border-radius: 8px; }
        .hint { font-size: 12px; color: #6b7280; }
        .muted { color: #6b7280; font-size: 14px; margin-top: 8px; }
        .err { color: #b91c1c; margin-top: 8px; }
        .tbl { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: middle; }
        thead th { background: #f3f4f6; }
        tbody tr:hover { background: #fafafa; }
      `}</style>
    </div>
  );
}

