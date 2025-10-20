// app/reports/state-form/page.tsx
"use client";
import { useEffect, useState } from "react";
import { appendFromTag, currentStateformStatus } from "@/lib/stateform/client";

type Status = {
  pageNumber: number;
  count: number;
  capacity: number;
};

export default function StateFormPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tag, setTag] = useState("");

  async function refresh() {
    const s = await currentStateformStatus();
    setStatus(s);
    const iframe = document.getElementById("preview") as HTMLIFrameElement | null;
    if (iframe) {
      // Bust cache
      iframe.src = `/api/stateform/render?dry=1&_=${Date.now()}`;
    }
  }

  useEffect(() => { refresh(); }, []);

  async function onAppend() {
    if (!tag.trim()) return;
    await appendFromTag(tag.trim());
    setTag("");
    refresh();
  }

  async function onManualPrint() {
    const url = `/api/stateform/render?dry=0&_=${Date.now()}`;
    window.open(url, "_blank");
    // After print, refresh status (buffer is cleared server-side)
    setTimeout(refresh, 1500);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Indiana State Form 19433 — Staging & Print</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl shadow p-4 bg-neutral-900 text-white">
            <div className="text-sm opacity-80">Current Page Number</div>
            <div className="text-3xl font-semibold">{status?.pageNumber ?? "…"}</div>
            <div className="mt-4 text-sm opacity-80">Staged rows</div>
            <div className="text-2xl">{status?.count ?? 0} / {status?.capacity ?? 44}</div>
            <div className="mt-4 flex gap-2">
              <input
                value={tag}
                onChange={(e)=>setTag(e.target.value)}
                placeholder="Scan/enter Tag to stage"
                className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 w-full"
              />
              <button onClick={onAppend} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500">Add</button>
            </div>
            <button onClick={onManualPrint} className="mt-4 w-full px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">
              Manual Print Now
            </button>
            <p className="mt-2 text-xs opacity-70">
              When the buffer reaches 44 entries, printing also happens automatically server-side.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden shadow border border-neutral-200 bg-white">
            <iframe id="preview" title="State Form Preview" className="w-full h-[80vh]" />
          </div>
        </div>
      </div>
    </div>
  );
}
