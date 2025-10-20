"use client";

import { useEffect, useRef, useState } from "react";

/**
 * No-sidebar PDF preview using pdf.js (legacy API + local .mjs worker)
 * - Loads only on client (avoids SSR issues)
 * - Points to /pdf.worker.min.mjs (the file you have)
 * - Disables range/stream for Next.js responses
 */
export default function PdfPreview({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<any>(null); // PDFDocumentProxy
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.15);
  const [err, setErr] = useState<string | null>(null);

  // Load/reload on src
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      setNumPages(0);
      setPageNum(1);
      pdfRef.current = null;

      // Use legacy build API (works broadly), worker is your local .mjs
      const { getDocument, GlobalWorkerOptions }: any = await import(
        "pdfjs-dist/legacy/build/pdf"
      );

      // Point to the local module worker you have
      GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const loadingTask = getDocument({
        url: src,
        disableRange: true,
        disableStream: true,
      });

      try {
        const doc = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = doc;
        setNumPages(doc.numPages || 0);
        setPageNum(1);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load PDF");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Render current page
  useEffect(() => {
    (async () => {
      const doc = pdfRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;

      const n = Math.max(1, Math.min(pageNum, doc.numPages));
      try {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e: any) {
        setErr(e?.message || "Failed to render page");
      }
    })();
  }, [pageNum, scale]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded disabled:opacity-50"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
        >
          −
        </button>
        <span className="text-sm text-neutral-300">Zoom {(scale * 100).toFixed(0)}%</span>
        <button
          className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded"
          onClick={() => setScale((s) => Math.min(3, s + 0.1))}
        >
          +
        </button>

        <div className="ml-4 flex items-center gap-2">
          <button
            className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded disabled:opacity-50"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((n) => Math.max(1, n - 1))}
          >
            Prev
          </button>
          <span className="text-sm text-neutral-300">
            {numPages ? `${pageNum} / ${numPages}` : "…"}
          </span>
          <button
            className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded disabled:opacity-50"
            disabled={!numPages || pageNum >= numPages}
            onClick={() => setPageNum((n) => Math.min(numPages || 1, n + 1))}
          >
            Next
          </button>
        </div>

        {!!err && <span className="ml-4 text-sm text-red-400">{err}</span>}
      </div>

      <div className="rounded-2xl overflow-hidden shadow border border-neutral-700 bg-black w-full">
        <canvas ref={canvasRef} className="block w-full h-auto" />
      </div>
    </div>
  );
}
