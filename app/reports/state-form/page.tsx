'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchStateformPayload, setStateformPageNumber } from '@/lib/stateform-data';
import { tokenQuery } from '@/lib/api';

const CAPACITY = 43;
type ZoomPreset = 'fit' | '110' | '125' | '150';

function pdfHash(zoom: ZoomPreset) {
  if (zoom === 'fit') return '#page=1&zoom=page-fit';
  return `#page=1&zoom=${zoom}`;
}

function withToken(url: string) {
  const query = tokenQuery();
  if (!query) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

export default function StateFormReportPage() {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomPreset>('fit');
  const [refreshKey, setRefreshKey] = useState(0);
  const [src, setSrc] = useState(withToken('/api/stateform/render?dry=1'));
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [auto, setAuto] = useState(true);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const totalEntries = payload?.totalEntries ?? payload?.entries?.length ?? 0;
  const totalSheets = payload?.totalSheets ?? Math.max(1, Math.ceil(totalEntries / CAPACITY));
  const pageNumber = Number((payload?.pageNumberStart ?? payload?.pageNumber) || 1);
  const endPageNumber = pageNumber + Math.max(0, totalSheets - 1);
  const canSetPage = (staffRole === 'admin' || staffRole === 'staff') && !!payload?.canSetPageNumber;
  const formLabel = String(payload?.formLabel || 'State Form');
  const reportPeriodLabel = String(payload?.reportPeriodLabel || '');

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

  useEffect(() => {
    fetch('/api/admin/staff-context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setStaffRole((json?.processor?.role as 'admin' | 'staff' | 'readonly' | null) || null);
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    setSrc(withToken(`/api/stateform/render?dry=1&_=${Date.now()}-${refreshKey}`) + pdfHash(zoom));
  }, [zoom, refreshKey]);

  async function refresh() {
    await load();
    setRefreshKey((k) => k + 1);
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

  const viewerHeight = useMemo(() => {
    if (typeof window === 'undefined') return 720;
    return Math.max(600, Math.floor(window.innerHeight * 0.75));
  }, []);

  return (
    <div className="px-6 py-6">
      <div className="mb-3 text-zinc-300">
        <div className="text-lg font-semibold">{formLabel}</div>
        <div className="text-sm text-zinc-400">
          {totalEntries} entr{totalEntries === 1 ? 'y' : 'ies'} across {totalSheets} sheet{totalSheets === 1 ? '' : 's'}
          {reportPeriodLabel ? <span className="text-zinc-500"> {reportPeriodLabel}</span> : null}
          {payload?.canSetPageNumber ? <span className="text-zinc-500"> Pages {pageNumber}-{endPageNumber}</span> : null}
          {loading && <span className="ml-3 text-zinc-400">Loading...</span>}
          {err && <span className="ml-3 text-red-400">Error: {err}</span>}
        </div>
      </div>

      {!canSetPage && staffRole === 'readonly' && payload?.canSetPageNumber ? (
        <div className="mb-3 text-sm font-semibold text-indigo-300">
          Read-only access: you can review and download the state form, but changing the page number requires Staff or Admin access.
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3 bg-zinc-900/70 border border-zinc-700/70 rounded-lg px-3 py-2">
        <button onClick={refresh} className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-sm">
          Refresh
        </button>
        <a href={withToken('/api/stateform/render?download=1')} className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-sm">
          Download PDF
        </a>
        <a
          href={withToken('/api/stateform/render')}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
        >
          Open PDF
        </a>

        {payload?.canSetPageNumber ? (
          <>
            <div className="h-6 w-px bg-zinc-700/60 mx-1" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Page #</span>
              <button
                onClick={() => stepPage(-1)}
                disabled={!canSetPage}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
                aria-label="Previous page"
              >
                -
              </button>
              <span className="px-2 tabular-nums text-zinc-200 text-sm">{pageNumber}</span>
              <button
                onClick={() => stepPage(+1)}
                disabled={!canSetPage}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
                aria-label="Next page"
              >
                +
              </button>
              <button
                onClick={setPageManual}
                disabled={!canSetPage}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
              >
                Set...
              </button>
            </div>
          </>
        ) : null}

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
