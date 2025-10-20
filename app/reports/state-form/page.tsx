// app/reports/state-form/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchStateformPayload,
  appendTagToStateform,
  type StateformEntry,
  type StateformPayload,
} from '@/lib/stateform-data';

const CAPACITY = 43; // page holds 18 + 25

type SizeKey = 'lg' | 'xl' | 'full';
const SIZE_TO_CLASS: Record<SizeKey, string> = {
  lg:   'h-[900px] max-w-[1100px]',
  xl:   'h-[1100px] max-w-[1300px]',
  full: 'h-[1400px] max-w-[1600px]',
};

export default function StateFormReportPage() {
  const [payload, setPayload] = useState<StateformPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Tag input (single or multi)
  const [tagInput, setTagInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState<{done:number,total:number} | null>(null);

  // Version ticks when we want to refresh the PDF frame
  const [refreshKey, setRefreshKey] = useState(0);

  // PDF preview URL (cache-busted on the client only)
  const [previewUrl, setPreviewUrl] = useState<string>('/api/stateform/render?dry=1');

  // Preview sizing + auto-refresh
  const [size, setSize] = useState<SizeKey>('xl');
  const [auto, setAuto] = useState(false);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  const entries: StateformEntry[] = useMemo(
    () => (Array.isArray(payload?.entries) ? payload!.entries : []),
    [payload]
  );
  const used = entries.length;
  const left = Math.max(0, CAPACITY - used);
  const pct = Math.min(100, Math.round((used / CAPACITY) * 100));

  function bumpPreview() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    // Build a cache-busted URL only on the client (after hydration)
    const u = `/api/stateform/render?dry=1&_=${Date.now()}-${refreshKey}`;
    setPreviewUrl(u);
  }, [refreshKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetchStateformPayload(true); // dry=1 (preview)
      setPayload(p);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    load();
  }, [load]);

  // Auto refresh every 20s
  useEffect(() => {
    if (!auto) {
      if (autoRef.current) clearInterval(autoRef.current as any);
      autoRef.current = null;
      return;
    }
    autoRef.current = setInterval(async () => {
      await load();
      bumpPreview();
    }, 20000);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current as any);
      autoRef.current = null;
    };
  }, [auto, load]);

  async function onAdd() {
    const raw = tagInput.trim();
    if (!raw) return;

    // Allow multiple tags separated by comma/space/newline
    const tags = Array.from(
      new Set(
        raw
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );

    setAdding(true);
    setAddProgress({ done: 0, total: tags.length });
    setErr(null);
    try {
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        await appendTagToStateform(t);
        setAddProgress({ done: i + 1, total: tags.length });
      }
      setTagInput('');
      await load();
      bumpPreview();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setAdding(false);
      setTimeout(() => setAddProgress(null), 1000);
    }
  }

  async function onRefresh() {
    await load();
    bumpPreview();
  }

  async function onCommitAndPrint() {
    if (!entries.length) return;
    const ok = window.confirm(
      `Commit and print this page?\n\n` +
      `- Rows will be burned into the PDF (dry=0)\n` +
      `- The staging sheet will be cleared up to the page capacity\n` +
      `- Next page number will increment`
    );
    if (!ok) return;

    const url = `/api/stateform/render?dry=0&_=${Date.now()}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    // Reload UI after a moment so cleared rows + next page # show
    setTimeout(async () => {
      await load();
      bumpPreview();
    }, 900);
  }

  // Enter to add
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!adding) onAdd();
    }
  }

  return (
    <div className="px-5 py-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add by Tag (paste one or many; Enter to add)"
          className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm w-[520px]"
        />
        <button
          onClick={onAdd}
          disabled={adding || !tagInput.trim()}
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

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="accent-emerald-600"
            />
            Auto-refresh (20s)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Preview size:
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as SizeKey)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1"
            >
              <option value="lg">Large</option>
              <option value="xl">XL</option>
              <option value="full">Full</option>
            </select>
          </label>
        </div>
      </div>

      {/* Status/header card */}
      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div className="text-zinc-200">
            <div className="text-[13px] uppercase tracking-wide text-zinc-400">Year • Page #</div>
            <div className="text-lg font-semibold">
              {payload?.pageYear ?? '—'} • {payload?.pageNumber ?? '—'}
            </div>
          </div>
          <div className="text-zinc-200">
            <div className="text-[13px] uppercase tracking-wide text-zinc-400">Processor</div>
            <div className="font-medium">
              {payload?.processorName || '—'}
            </div>
            <div className="text-sm text-zinc-400">
              {payload?.processorStreet} • {payload?.processorCity} {payload?.processorZip} • {payload?.processorLocation} • {payload?.processorCounty} • {payload?.processorPhone}
            </div>
          </div>
          <div className="ml-auto min-w-[260px]">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-400">Staged</span>
              <span className="font-semibold text-zinc-200">{used}/{CAPACITY}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-600"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-zinc-400">{left} row{left === 1 ? '' : 's'} left</div>
          </div>
        </div>
        {addProgress && (
          <div className="mt-3 text-sm text-zinc-300">
            Adding tags… {addProgress.done}/{addProgress.total}
          </div>
        )}
        {loading && <div className="mt-3 text-sm text-zinc-400">Loading…</div>}
        {!!err && <div className="mt-3 text-sm text-red-400 break-all">Error: {err}</div>}
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* LEFT: staged table */}
        <div className="w-full">
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            {/* Sticky header */}
            <div className="grid grid-cols-[72px_72px_1fr_1.4fr_1fr_100px_90px_80px_80px_150px] bg-zinc-900 text-zinc-200 text-[13px] font-semibold px-3 py-2 sticky top-0 z-10">
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

            <div className="max-h-[calc(100vh-340px)] overflow-auto divide-y divide-zinc-800">
              {entries.map((e, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[72px_72px_1fr_1.4fr_1fr_100px_90px_80px_80px_150px] px-3 py-2 text-[14px] ${
                    i % 2 ? 'bg-zinc-950/40' : ''
                  }`}
                >
                  <div className="tabular-nums">{e.dateIn || ''}</div>
                  <div className="tabular-nums">{e.dateOut || ''}</div>
                  <div className="truncate">{e.name || ''}</div>
                  <div className="truncate">{e.address || ''}</div>
                  <div className="truncate tabular-nums">{e.phone || ''}</div>
                  <div className="truncate">{e.sex || ''}</div>
                  <div className="truncate">{e.whereKilled || ''}</div>
                  <div className="truncate">{e.howKilled || ''}</div>
                  <div className="truncate">{e.donated || ''}</div>
                  <div className="truncate">{e.confirmation || ''}</div>
                </div>
              ))}
              {!entries.length && !loading && !err && (
                <div className="px-3 py-4 text-sm text-zinc-400">No staged entries yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: PDF preview */}
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
            key={refreshKey}
            data={previewUrl}
            type="application/pdf"
            className={`w-full ${SIZE_TO_CLASS[size]} rounded-lg border border-zinc-700 shadow`}
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

