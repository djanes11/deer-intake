// app/reports/state-form/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  listDraft,
  upsertLine,
  deleteLine,
  clearDraft,
  appendFromTag,
  currentStateformStatus,
} from "@/lib/stateform/client";

type Line = {
  lineNo: number;
  tag?: string;
  dateIn?: string;
  dateOut?: string;
  name?: string;
  address?: string;
  phone?: string;
  sex?: string;
  whereKilled?: string;
  howKilled?: string;
  donated?: string;
  confirmation?: string;
  _empty?: boolean;
};

function Cell({
  value,
  onChange,
  placeholder,
  className,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={`w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white ${className || ""}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function StateFormEditorPage() {
  const [rows, setRows] = useState<Line[]>([]);
  const [status, setStatus] = useState<{
    pageDraft: number;
    count: number;
    capacity: number;
  } | null>(null);
  const [tag, setTag] = useState("");
  const saveTimer = useRef<number | null>(null);

  async function refresh() {
    try {
      const [ls, st] = await Promise.all([
        listDraft().catch(() => null),
        currentStateformStatus().catch(() => null),
      ]);

      const safeRows: Line[] = Array.isArray(ls?.rows) ? (ls!.rows as Line[]) : [];
      setRows(safeRows);

      if (st) {
        const p =
          (st as any).pageDraft ??
          (st as any).pageNumber ??
          1;
        setStatus({
          pageDraft: p,
          count: (st as any).count ?? 0,
          capacity: (st as any).capacity ?? 44,
        });
      }

      // Force iframe refresh with cache-buster
      const iframe = document.getElementById("preview") as HTMLIFrameElement | null;
      if (iframe) iframe.src = `/api/stateform/render?dry=1&_=${Date.now()}`;
    } catch {
      // leave current state on total failure
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const save = (lineNo: number, patch: Partial<Line>) => {
    const next = (rows ?? []).map((r) => (r.lineNo === lineNo ? { ...r, ...patch } : r));
    setRows(next);

    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === "lineNo" || k === "_empty") continue;
      payload[k] = v;
    }

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      upsertLine(lineNo, payload)
        .then(refresh)
        .catch(() => {});
    }, 300) as unknown as number;
  };

  const onAdd = async () => {
    if (!tag.trim()) return;
    await appendFromTag(tag.trim()).catch(() => {});
    setTag("");
    refresh();
  };

  const onDelete = async (lineNo: number) => {
    await deleteLine(lineNo).catch(() => {});
    refresh();
  };

  const onClear = async () => {
    if (!confirm("Clear all 44 rows in the draft page?")) return;
    await clearDraft().catch(() => {});
    refresh();
  };

  const onManualPrint = async () => {
    // opens new tab with the flushed PDF
    window.open(`/api/stateform/render?dry=0&_=${Date.now()}`, "_blank");
    setTimeout(refresh, 1200);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-extrabold text-white">
        Indiana State Form 19433 — Draft Editor
      </h1>

      {/* Top: stats + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: controls / stats */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl shadow p-4 bg-neutral-900 text-white">
            <div className="text-sm opacity-80">Current Draft Page</div>
            <div className="text-3xl font-semibold">
              {status?.pageDraft ?? "…"}
            </div>

            <div className="mt-4 text-sm opacity-80">Staged rows</div>
            <div className="text-2xl">
              {status?.count ?? 0} / {status?.capacity ?? 44}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Scan/enter Tag to add"
                className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 w-full text-white"
              />
              <button
                onClick={onAdd}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
              >
                Add
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={onManualPrint}
                className="flex-1 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
              >
                Print (flush)
              </button>
              <button
                onClick={onClear}
                className="flex-1 px-3 py-2 rounded bg-red-600 hover:bg-red-500"
              >
                Clear
              </button>
            </div>

            <p className="mt-2 text-xs opacity-70">
              Print will lock, write history, bump page, and clear rows.
            </p>

            <div className="mt-4">
              <a
                href="/api/stateform/render?dry=1"
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
              >
                Open Large Preview
              </a>
            </div>
          </div>
        </div>

        {/* Right: big preview */}
        <div className="lg:col-span-2 min-w-0">
          <div className="rounded-2xl overflow-hidden shadow border border-neutral-700 bg-black min-h-[85vh]">
            <iframe
              id="preview"
              title="State Form Preview"
              className="w-full h-[85vh] block"
              style={{ width: "100%", height: "85vh", display: "block" }}
            />
          </div>
        </div>
      </div>

      {/* Bottom: grid editor */}
      <div className="rounded-2xl shadow p-4 bg-neutral-900 text-white overflow-auto">
        <div className="mb-2 text-sm opacity-80">
          Edit any cell; changes auto-save. Date format: <code>mm/dd/yy</code>.
        </div>

        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 text-[11px] md:text-xs font-semibold opacity-80 mb-2">
          <div>#</div>
          <div>Tag</div>
          <div>Date In</div>
          <div>Date Out</div>
          <div>Name</div>
          <div>Address</div>
          <div>Phone</div>
          <div>Sex</div>
          <div>Where Killed</div>
          <div>How</div>
          <div>Donated</div>
          <div>Confirm #</div>
        </div>

        {(rows ?? []).map((r) => (
          <div
            key={r.lineNo}
            className="grid grid-cols-12 gap-2 mb-2 items-center"
          >
            <div className="text-center text-xs md:text-sm">{r.lineNo}</div>
            <Cell value={r.tag} onChange={(v) => save(r.lineNo, { tag: v })} />
            <Cell
              value={r.dateIn}
              onChange={(v) => save(r.lineNo, { dateIn: v })}
              placeholder="mm/dd/yy"
            />
            <Cell
              value={r.dateOut}
              onChange={(v) => save(r.lineNo, { dateOut: v })}
              placeholder="mm/dd/yy"
            />
            <Cell
              value={r.name}
              onChange={(v) => save(r.lineNo, { name: v })}
            />
            <Cell
              value={r.address}
              onChange={(v) => save(r.lineNo, { address: v })}
            />
            <Cell
              value={r.phone}
              onChange={(v) => save(r.lineNo, { phone: v })}
            />
            <Cell
              value={r.sex}
              onChange={(v) => save(r.lineNo, { sex: v })}
              placeholder="BUCK/DOE/ANTLERLESS"
            />
            <Cell
              value={r.whereKilled}
              onChange={(v) => save(r.lineNo, { whereKilled: v })}
              placeholder="County, IN"
            />
            <Cell
              value={r.howKilled}
              onChange={(v) => save(r.lineNo, { howKilled: v })}
              placeholder="gun/arch/veh"
            />
            <Cell
              value={r.donated}
              onChange={(v) => save(r.lineNo, { donated: v })}
              placeholder="Y/N"
            />
            <div className="flex items-center gap-2">
              <Cell
                value={r.confirmation}
                onChange={(v) => save(r.lineNo, { confirmation: v })}
              />
              <button
                onClick={() => onDelete(r.lineNo)}
                className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                title="Delete line"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
