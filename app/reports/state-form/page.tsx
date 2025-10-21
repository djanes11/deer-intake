'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchStateformPayload, setStateformPageNumber } from '@/lib/stateform-data';

const CAPACITY = 43;

type ZoomPreset = 'fit' | '110' | '125' | '150';

function pdfHash(zoom: ZoomPreset) {
  if (zoom === 'fit') return '#page=1&zoom=page-fit';
  return `#page=1&zoom=${zoom}`;
}

export default function StateFormReportPage() {
  // data
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // viewer
  const [zoom, setZoom] = useState<ZoomPreset>('fit');
  const [refreshKey, setRefreshKey] = useState(0); // forces iframe reload
  const [src, setSrc] = useState('/api/stateform/render?dry=1');

  // auto refresh
  const [auto, setAuto] = useState(true);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const used = payload?.entries?.length ?? 0;
  const left = Math.max(0, CAPACITY - used);
  const pageNumber = Number(payload?.pageNumber || 1);

  // ----- fetch
  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetchStateformPayload(true);
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

  // auto-refresh
  useEffect(() => {
    if (!auto) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(async () => {
      await load();
      setRefreshKey((k) => k + 1);
    }, 20000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [auto, load]);

  // rebuild iframe src when zoom or refreshKey changes
  useEffect(() => {
    setSrc(`/api/stateform/render?dry=1&_=${Date.now()}-${refreshKey}${pdfHash(zoom)}`);
  }, [zoom, refreshKey]);

  // ----- actions
  async function refresh() {
    await load();
    setRefreshKey((k) => k + 1);
  }

  async function commitPage() {
    if (!used) return;
    const ok = window.confirm(
      `Commit this page?\n\nThis will remove up to ${Math.min(used, CAPACITY)} staged row(s), bump the page number, and print.`
    );
    if (!ok) return;
    try {
      const res = await fetch('/api/stateform/commit', { method: 'POST' });
      if (!res.ok) throw new Error(`Commit failed: ${res.status}`);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function stepPage(delta: number) {
    const next = Math.max(1, pageNumber + delta);
    try {
      await setStateformPageNumber(next);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function setPageManual() {
    const input = window.prompt('Set page number:', String(pageNumber));
    if (!input) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 1) return;
    try {
      await setStateformPageNumber(n);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // height tuned to look good without feeling cramped
  const viewerHeight = useMemo(() => {
    // ~75% of viewport on large screens; minimum for smaller screens
    if (typeof window === 'undefined') return 720;
    const vh = Math.max(600, Math.floor(window.innerHeight * 0.75));
    return vh;
  }, [typeof window]);

  return (
    <div className="px-6 py-6">
      {/* Tiny status line (no clutter) */}
      <div className="mb-3 text-zinc-300">
        <div className="text-lg font-semibold">Page {pageNumber}</div>
        <div className="text-sm text-zinc-400">
          Staged {used}/{CAPACITY} <span className="text-zinc-500">({left} left)</span>
          {loading && <span className="ml-3 text-zinc-400">Loading…</span>}
          {err && <span className="ml-3 text-red-400">Error: {err}</span>}
        </div>
      </div>

      {/* Toolbar (matches rest of app) */}
      <div className="mb-3 flex flex-wrap items-center gap-3 bg-zinc-900/70 border border-zinc-700/70 rounded-lg px-3 py-2">
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-sm"
        >
          Refresh
        </button>
        <button
          onClick={commitPage}
          disabled={!used}
          className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm"
        >
          Commit Page
        </button>

        <div className="h-6 w-px bg-zinc-700/60 mx-1" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Page #</span>
          <button
            onClick={() => stepPage(-1)}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
            aria-label="Previous page"
          >
            −
          </button>
          <span className="px-2 tabular-nums text-zinc-200 text-sm">{pageNumber}</span>
          <button
            onClick={() => stepPage(+1)}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
            aria-label="Next page"
          >
            +
          </button>
          <button
            onClick={setPageManual}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
          >
            Set…
          </button>
        </div>

        <div className="h-6 w-px bg-zinc-700/60 mx-1" />

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Zoom
          <select
            value={zoom}
            onChange={(e) => setZoom(e.target.value as ZoomPreset)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
          >
            <option value="fit">Fit page</option>
            <option value="110">110%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
          </select>
        </label>

        <div className="h-6 w-px bg-zinc-700/60 mx-1" />

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

      {/* Viewer card (centered, no overlay) */}
      <div className="w-full flex justify-center">
        <div
          className="w-full max-w-[1400px] rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
          style={{ overflow: 'hidden' }}
        >
          <iframe
            key={refreshKey}
            src={src}
            title="State form PDF"
            style={{
              display: 'block',
              width: '100%',
              height: viewerHeight,
              background: '#0b0b0b',
              border: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

