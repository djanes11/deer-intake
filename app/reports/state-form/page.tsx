// app/reports/state-form/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appendTagToStateform, fetchStateformPayload } from '@/lib/stateform-data';

type Entry = {
  dateIn?: string; dateOut?: string; name?: string; address?: string; phone?: string;
  sex?: string; whereKilled?: string; howKilled?: string; donated?: string; confirmation?: string;
};

export default function StateFormReportPage() {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  async function refresh() {
    try {
      setLoading(true);
      const p = await fetchStateformPayload(true);
      setPayload(p);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function addTag() {
    const t = tag.trim();
    if (!t) return;
    try {
      setLoading(true);
      await appendTagToStateform(t);
      setTag('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to add tag');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const entries: Entry[] = useMemo(() => (payload?.entries || []) as Entry[], [payload]);

  const commitAndPrint = () => {
    window.open('/api/stateform/render?dry=0', '_blank');
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Add by Tag (optional)"
            className="border rounded px-3 py-2 bg-white text-black w-48"
          />
          <button onClick={addTag} className="px-3 py-2 rounded bg-black text-white border border-white/20">
            Add
          </button>
          <button onClick={refresh} className="px-3 py-2 rounded bg-black text-white border border-white/20">
            Refresh
          </button>
          <button onClick={commitAndPrint} className="ml-auto px-3 py-2 rounded bg-emerald-700 text-white">
            Commit & Print
          </button>
        </div>

        <div className="text-sm opacity-80">
          <div>Year: <b>{payload?.pageYear ?? '—'}</b> • Page #: <b>{payload?.pageNumber ?? '—'}</b></div>
          <div>
            {payload?.processorName} • {payload?.processorLocation} • {payload?.processorCounty}<br/>
            {payload?.processorStreet}, {payload?.processorCity} {payload?.processorZip} • {payload?.processorPhone}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black text-white">
              <tr>
                <th className="p-2 text-left">Date In</th>
                <th className="p-2 text-left">Date Out</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Address</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">Sex</th>
                <th className="p-2 text-left">Where</th>
                <th className="p-2 text-left">How</th>
                <th className="p-2 text-left">Donated</th>
                <th className="p-2 text-left">Confirm #</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-100 text-black">
                  <td className="p-2">{e.dateIn}</td>
                  <td className="p-2">{e.dateOut}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{e.address}</td>
                  <td className="p-2">{e.phone}</td>
                  <td className="p-2">{e.sex}</td>
                  <td className="p-2">{e.whereKilled}</td>
                  <td className="p-2">{e.howKilled}</td>
                  <td className="p-2">{e.donated}</td>
                  <td className="p-2">{e.confirmation}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td className="p-4 text-center text-gray-500" colSpan={10}>No staged entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}
        {loading && <div className="text-sm opacity-70">Loading…</div>}
      </div>

      <div className="min-h-[70vh] border rounded">
        {/* Live PDF preview */}
        <object data="/api/stateform/render?dry=1" type="application/pdf" className="w-full h-[70vh]">
          <p className="p-4">PDF preview failed to load. <a href="/api/stateform/render?dry=1" className="underline">Open preview</a>.</p>
        </object>
      </div>
    </div>
  );
}
