// app/reports/state-form/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchStateformPayload,
  appendTagToStateform,
  type StateformEntry,
  type StateformPayload,
} from '@/lib/stateform-data';

export default function StateFormReportPage() {
  const [payload, setPayload] = useState<StateformPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tag, setTag] = useState('');
  const [adding, setAdding] = useState(false);

  // Version ticks when we want to refresh the PDF
  const [refreshKey, setRefreshKey] = useState(0);

  // IMPORTANT: do NOT put Date.now() in JSX; build the URL after mount.
  const [previewUrl, setPreviewUrl] = useState<string>('/api/stateform/render?dry=1');

  useEffect(() => {
    // Build a cache-busted URL only on the client (after hydration)
    const u = `/api/stateform/render?dry=1&_=${Date.now()}-${refreshKey}`;
    setPreviewUrl(u);
  }, [refreshKey]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetchStateformPayload(true); // dry=1 (preview only)
      setPayload(p);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load (no Date.now() here)
    load();
  }, []);

  function bumpPreview() {
    setRefreshKey((k) => k + 1);
  }

  async function onAdd() {
    const t = tag.trim();
    if (!t) return;
    setAdding(true);
    setErr(null);
    try {
      await appendTagToStateform(t);
      setTag('');
      await load();
      bumpPreview(); // refresh the PDF frame
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setAdding(false);
    }
  }

  async function onRefresh() {
    await load();
    bumpPreview();
  }

  async function onCommitAndPrint() {
    // Open final PDF in new tab and consume rows (dry=0)
    const url = `/api/stateform/render?dry=0&_=${Date.now()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    // Reload UI after a moment so cleared rows + next page # show
    setTimeout(async () => {
      await load();
      bumpPreview();
    }, 800);
  }

  const entries: StateformEntry[] = Array.isArray(payload?.entries) ? payload!.entries : [];

  return (
    <div className="px-5 py-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Add by Tag (optional)"
          className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm w-64"
        />
        <button
          onClick={onAdd}
          disabled={adding || !tag.trim()}
          className="px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-sm"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
        <button
          onClick={onRefresh}
          className="px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-sm"
        >
          Refresh
        </button>
        <button
          onClick={onCommitAndPrint}
          disabled={!entries.length}
          className="px-3 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm"
        >
          Commit & Print
        </button>
      </div>

      {/* Header / status */}
      <div className="text-sm text-zinc-300 mb-3">
        <div>
          Year: <span className="font-semibold">{payload?.pageYear ?? '—'}</span>{' '}
          • Page #: <span className="font-semibold">{payload?.pageNumber ?? '—'}</span>
        </div>
        <div className="mt-1">
          {payload?.processorName} • {payload?.processorLocation} • {payload?.processorCounty}
        </div>
        <div>
          {payload?.processorStreet} • {payload?.processorCity} {payload?.processorZip} • {payload?.processorPhone}
        </div>
      </div>

      {/* Layout: table left, big PDF preview right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* LEFT: staged entries */}
        <div>
          <div className="grid grid-cols-[92px_92px_1fr_1.3fr_1fr_120px_80px_70px_70px_140px] gap-x-4 text-zinc-200 text-[15px] font-semibold mb-2">
            <div>Date In</div>
            <div>Date Out</div>
            <div>Name</div>
            <div>Address</div>
            <div>Phone</div>
            <div>Sex</div>
            <div>Where</div>
            <div>How</div>
            <div>Donated</div>
            <div>Confirm #</div>
          </div>

          {loading && <div className="text-sm text-zinc-400">Loading…</div>}
          {!!err && <div className="text-sm text-red-400 break-all">Error: {err}</div>}
          {!loading && !entries.length && !err && (
            <div className="text-sm text-zinc-400">No staged entries yet.</div>
          )}

          <div className="space-y-3">
            {entries.map((e, i) => (
              <div
                key={i}
                className="grid grid-cols-[92px_92px_1fr_1.3fr_1fr_120px_80px_70px_70px_140px] gap-x-4 text-zinc-100 text-[15px]"
              >
                <div className="tabular-nums">{e.dateIn || ''}</div>
                <div className="tabular-nums">{e.dateOut || ''}</div>
                <div className="truncate">{e.name || ''}</div>
                <div className="truncate">{e.address || ''}</div>
                <div className="truncate">{e.phone || ''}</div>
                <div className="truncate">{e.sex || ''}</div>
                <div className="truncate">{e.whereKilled || ''}</div>
                <div className="truncate">{e.howKilled || ''}</div>
                <div className="truncate">{e.donated || ''}</div>
                <div className="truncate">{e.confirmation || ''}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: PDF preview (big) */}
        <div className="w-full">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm text-zinc-400">Preview</span>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline hover:no-underline"
            >
              Open full size
            </a>
          </div>

          <object
            key={refreshKey}                 // force reload when we bump
            data={previewUrl}
            type="application/pdf"
            className="w-full h-[900px] max-w-[1200px] rounded-lg border border-zinc-700 shadow"
          >
            <div className="p-4 text-sm">
              PDF preview not supported in this browser.{' '}
              <a className="underline" href={previewUrl} target="_blank" rel="noreferrer">
                Open the PDF in a new tab
              </a>
              .
            </div>
          </object>
        </div>
      </div>
    </div>
  );
}
