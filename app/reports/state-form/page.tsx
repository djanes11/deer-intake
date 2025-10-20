// app/reports/state-form/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import PdfPreview from "../../components/PdfPreview";
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

const sexOptions = [
  { label: "—", value: "" },
  { label: "BUCK", value: "BUCK" },
  { label: "DOE", value: "DOE" },
  { label: "ANTLERLESS", value: "ANTLERLESS" },
];
const donatedOptions = [
  { label: "—", value: "" },
  { label: "Y", value: "Y" },
  { label: "N", value: "N" },
];

function mmddyy(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function TextCell({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-neutral-500"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectCell({
  value,
  onChange,
  options,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function StateFormEditorPage() {
  const [rows, setRows] = useState<Line[]>([]);
  const [status, setStatus] = useState<{ pageDraft: number; count: number; capacity: number } | null>(null);
  const [tag, setTag] = useState("");
  const [previewSrc, setPreviewSrc] = useState("/api/stateform/render?dry=1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function bumpPreview() {
    setPreviewSrc(`/api/stateform/render?dry=1&_=${Date.now()}`);
  }

  async function refreshAll() {
    setBusy(true);
    setError(null);
    try {
      const [ls, st] = await Promise.all([listDraft(), currentStateformStatus()]);
      const safeRows: Line[] = Array.isArray(ls?.rows) ? (ls!.rows as Line[]) : [];
      setRows(safeRows);
      if (st) {
        const p = (st as any).pageDraft ?? (st as any).pageNumber ?? 1;
        setStatus({ pageDraft: p, count: (st as any).count ?? 0, capacity: (st as any).capacity ?? 44 });
      }
      bumpPreview();
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const save = (lineNo: number, patch: Partial<Line>) => {
    const next = (rows ?? []).map((r) => (r.lineNo === lineNo ? { ...r, ...patch } : r));
    setRows(next);

    // normalize dates to mm/dd/yy on the client too
    if (patch.dateIn) {
      const m = patch.dateIn.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (m) {
        const mm = m[1].padStart(2, "0");
        const dd = m[2].padStart(2, "0");
        const yy = m[3].slice(-2);
        patch.dateIn = `${mm}/${dd}/${yy}`;
      }
    }
    if (patch.dateOut) {
      const m = patch.dateOut.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (m) {
        const mm = m[1].padStart(2, "0");
        const dd = m[2].padStart(2, "0");
        const yy = m[3].slice(-2);
        patch.dateOut = `${mm}/${dd}/${yy}`;
      }
    }

    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === "lineNo" || k === "_empty") continue;
      payload[k] = v;
    }

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      upsertLine(lineNo, payload)
        .then(() => bumpPreview())
        .catch(() => setError("Failed to save change"));
    }, 200) as unknown as number;
  };

  const onAdd = async () => {
    if (!tag.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await appendFromTag(tag.trim());
      setTag("");
      await refreshAll();

      // if backend returns lineNo, scroll to that row
      const ln = (res && (res.lineNo || res.line || res.index)) as number | undefined;
      if (ln && rowRefs.current[ln]) {
        rowRefs.current[ln]!.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch {
      setError("Could not add by tag");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (lineNo: number) => {
    setBusy(true);
    setError(null);
    try {
      await deleteLine(lineNo);
      await refreshAll();
    } catch {
      setError("Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    if (!confirm("Clear all 44 rows on the current draft page?")) return;
    setBusy(true);
    setError(null);
    try {
      await clearDraft();
      await refreshAll();
    } catch {
      setError("Clear failed");
    } finally {
      setBusy(false);
    }
  };

  const onManualPrint = async () => {
    window.open(`/api/stateform/render?dry=0&_=${Date.now()}`, "_blank");
    setTimeout(refreshAll, 1200);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-extrabold text-white">Indiana State Form 19433 — Draft Editor</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onManualPrint}
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          disabled={busy}
        >
          Print (flush)
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
          disabled={busy}
        >
          Clear Page
        </button>

        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Scan or enter Tag to add"
          className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white flex-1 min-w-[240px]
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          disabled={busy}
        >
          Add
        </button>

        <div className="text-sm text-neutral-300 ml-auto">
          Page {status?.pageDraft ?? "…"} — {status?.count ?? 0}/{status?.capacity ?? 44} staged
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 text-sm">{error}</div>
      )}

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden shadow border border-neutral-700 bg-black w-full min-h-[80vh]">
        <PdfPreview src={previewSrc} />
      </div>

      {/* Grid editor */}
      <div className="rounded-2xl shadow bg-neutral-900 text-white overflow-auto">
        <div className="sticky top-0 z-10 p-3 bg-neutral-900 border-b border-neutral-800">
          <div className="text-sm opacity-80">
            Edit any cell; changes auto-save. Date helpers are available for Date In/Out.
          </div>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-13 gap-2 px-4 pt-3 text-[11px] md:text-xs font-semibold opacity-80">
          <div>#</div>
          <div>Tag</div>
          <div className="col-span-2">Date In</div>
          <div className="col-span-2">Date Out</div>
          <div>Name</div>
          <div>Address</div>
          <div>Phone</div>
          <div>Sex</div>
          <div>Where</div>
          <div>How</div>
          <div>Donated</div>
          <div>Confirm #</div>
        </div>

        <div className="px-4 pb-4">
          {(rows ?? []).map((r) => (
            <div
              key={r.lineNo}
              ref={(el) => (rowRefs.current[r.lineNo] = el)}
              className="grid grid-cols-13 gap-2 py-2 items-center border-b border-neutral-800/60 hover:bg-neutral-800/40"
            >
              <div className="text-center text-xs md:text-sm">{r.lineNo}</div>

              <TextCell value={r.tag} onChange={(v) => save(r.lineNo, { tag: v })} />

              {/* Date In with helpers */}
              <div className="col-span-2 flex gap-2">
                <TextCell
                  value={r.dateIn}
                  onChange={(v) => save(r.lineNo, { dateIn: v })}
                  placeholder="MM/DD/YY"
                />
                <div className="flex gap-1">
                  <button
                    className="px-2 py-1 rounded bg-neutral-700 text-xs"
                    onClick={() => save(r.lineNo, { dateIn: mmddyy(new Date()) })}
                  >
                    Today
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-neutral-700 text-xs"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      save(r.lineNo, { dateIn: mmddyy(d) });
                    }}
                  >
                    Yest
                  </button>
                </div>
              </div>

              {/* Date Out with helpers */}
              <div className="col-span-2 flex gap-2">
                <TextCell
                  value={r.dateOut}
                  onChange={(v) => save(r.lineNo, { dateOut: v })}
                  placeholder="MM/DD/YY"
                />
                <div className="flex gap-1">
                  <button
                    className="px-2 py-1 rounded bg-neutral-700 text-xs"
                    onClick={() => save(r.lineNo, { dateOut: mmddyy(new Date()) })}
                  >
                    Today
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-neutral-700 text-xs"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      save(r.lineNo, { dateOut: mmddyy(d) });
                    }}
                  >
                    Yest
                  </button>
                </div>
              </div>

              <TextCell value={r.name} onChange={(v) => save(r.lineNo, { name: v })} />
              <TextCell value={r.address} onChange={(v) => save(r.lineNo, { address: v })} />
              <TextCell value={r.phone} onChange={(v) => save(r.lineNo, { phone: v })} />

              <SelectCell value={r.sex} onChange={(v) => save(r.lineNo, { sex: v })} options={sexOptions} />

              <TextCell
                value={r.whereKilled}
                onChange={(v) => save(r.lineNo, { whereKilled: v })}
                placeholder="Harrison, IN"
              />
              <TextCell
                value={r.howKilled}
                onChange={(v) => save(r.lineNo, { howKilled: v })}
                placeholder="gun/arch/veh"
              />

              <SelectCell
                value={r.donated}
                onChange={(v) => save(r.lineNo, { donated: v })}
                options={donatedOptions}
              />

              <div className="flex items-center gap-2">
                <TextCell
                  value={r.confirmation}
                  onChange={(v) => save(r.lineNo, { confirmation: v })}
                />
                <button
                  onClick={() => onDelete(r.lineNo)}
                  className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                  title="Delete line"
                  disabled={busy}
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
