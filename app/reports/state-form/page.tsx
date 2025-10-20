'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchStateformPayload,
  setStateformPageNumber,
} from '@/lib/stateform-data';

const CAPACITY = 43;

export default function StateFormReportPage() {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [auto, setAuto] = useState(true);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  // Stable initial value for SSR, cache-bust after mount
  const [previewUrl, setPreviewUrl] = useState('/api/stateform/render?dry=1');
  useEffect(() => {
    setPreviewUrl(`/api/stateform/render?dry=1&_=${Date.now()}-${refreshKey}`);
  }, [refreshKey]);

  const used = payload?.entries?.length ?? 0;
  const left = Math.max(0, CAPACITY - used);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetchStateformPayload(true); // dry preview
      setPayload(p);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!auto) {
      if (timer.current) clearInterval(timer.current as any);
      timer.current = null;
      return;
    }
    timer.current = setInterval(async () => {
      await load();
      setRefreshKey(k => k + 1);
    }, 20000);
    return () => {
      if (timer.current) clearInterval(timer.current as any);
      timer.current = null;
    };
  }, [auto, load]);

  async function refresh() {
    await load();
    setRefreshKey(k => k + 1);
  }

  async function commitAndPrint() {
    if (!used) return;
    const ok = window.confirm(
      `Commit and print this page?\n\n- dry=0 render\n- clear staged rows up to capacity\n- bump page number`
    );
    if (!ok) return;
    const url = `/api/stateform/render?dry=0&_=${Date.now()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(refresh, 900);
  }

  async function adjustPage(delta: number) {
    const current = Number(payload?.pageNumber || 1);
    const next = Math.max(1, current + delta);
    try {
      await setStateformPageNumber(next);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function setPageFromPrompt() {
    const current = String(payload?.pageNumber ?? 1);
    const input = window.prompt('Set page number to:', current);
    if (!input) return;
    const num = Number(input);
    if (!Number.isFinite(num) || num < 1) return;
    try {
      await setStateformPageNumber(num);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="px-5 py-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={refresh}
          className="px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-sm"
        >
          Refresh
        </button>
        <button
          onClick={commitAndPrint}
          disabled={!used}
          className="px-3 py-2 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm"
        >
          Commit & Print
        </button>

        <div className="h-6 w-px bg-zinc-700 mx-2" />

        <span className="text-sm text-zinc-400">Page #</span>
        <button
          onClick={() => adjustPage(-1)}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          −
        </button>
        <span className="px-2 tabular-nums text-zinc-200 text-sm">
          {payload?.pageNumber ?? '—'}
        </span>
        <button
          onClick={() => adjustPage(+1)}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          +
        </button>
        <button
          onClick={setPageFromPrompt}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          Set…
        </button>

        <div className="h-6 w-px bg-zinc-700 mx-2" />

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="accent-emerald-600"
          />
          Auto-refresh (20s)
        </label>
      </div>

      {/* Status strip */}
      <div className="mb-3 text-sm text-zinc-300">
        Year • Page #: <span className="font-semibold">{payload?.pageYear ?? '—'} • {payload?.pageNumber ?? '—'}</span>
        <span className="mx-3">•</span>
        Staged <span className="font-semibold">{used}/{CAPACITY}</span>
        <span className="mx-3">•</span>
        {left} row{left === 1 ? '' : 's'} left
        {loading && <span className="mx-3 text-zinc-400">Loading…</span>}
        {err && <span className="mx-3 text-red-400">Error: {err}</span>}
      </div>

      {/* Big preview (fills most of the viewport) */}
      <div className="flex justify-center">
        <div className="w-full">
          <div className="mb-2 text-sm text-zinc-400">
            Preview •{' '}
            <a href={previewUrl} target="_blank" rel="noreferrer" className="underline hover:no-underline">
              open full size
            </a>
          </div>
          <object
            key={refreshKey}
            data={previewUrl}
            type="application/pdf"
            className="w-full h-[85vh] rounded-lg border border-zinc-700 shadow"
          >
            <div className="p-4 text-sm">
              PDF preview not supported.{' '}
              <a className="underline" href={previewUrl} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
              .
            </div>
          </object>
        </div>
      </div>
    </div>
  );
}
