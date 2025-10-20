// app/reports/state-form/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { listDraft, upsertLine, deleteLine, clearDraft, appendFromTag, currentStateformStatus } from "@/lib/stateform/client";

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

function Cell({value, onChange, placeholder, className}:{value?:string,onChange:(v:string)=>void,placeholder?:string,className?:string}){
  return (
    <input
      className={`w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white ${className||""}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e)=>onChange(e.target.value)}
    />
  );
}

export default function StateFormEditorPage(){
  const [rows, setRows] = useState<Line[]>([]);
  const [status, setStatus] = useState<{pageDraft:number; count:number; capacity:number} | null>(null);
  const [tag, setTag] = useState("");
  const saveTimer = useRef<number | null>(null);

  async function refresh(){
    try {
      const [ls, st] = await Promise.all([
        listDraft().catch(() => null),
        currentStateformStatus().catch(() => null),
      ]);
      const safeRows: Line[] = Array.isArray(ls?.rows) ? ls!.rows : [];
      setRows(safeRows);
      if (st && typeof st.pageDraft !== "undefined") setStatus(st);
      const iframe = document.getElementById("preview") as HTMLIFrameElement | null;
      if (iframe) iframe.src = `/api/stateform/render?dry=1&_=${Date.now()}`;
    } catch {
      // leave rows as-is on total failure
    }
  }

  useEffect(()=>{ refresh(); }, []);

  const save = (lineNo:number, patch:Partial<Line>) => {
    const next = (rows ?? []).map(r => r.lineNo === lineNo ? { ...r, ...patch } : r);
    setRows(next);
    const payload:any = {};
    for (const [k,v] of Object.entries(patch)) {
      if (k === "lineNo" || k === "_empty") continue;
      payload[k] = v;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      upsertLine(lineNo, payload).then(refresh).catch(() => {});
    }, 300) as unknown as number;
  };

  const onAdd = async () => {
    if (!tag.trim()) return;
    await appendFromTag(tag.trim()).catch(()=>{});
    setTag("");
    refresh();
  };

  const onDelete = async (lineNo:number) => {
    await deleteLine(lineNo).catch(()=>{});
    refresh();
  };

  const onClear = async () => {
    if (!confirm("Clear all 44 rows in the draft page?")) return;
    await clearDraft().catch(()=>{});
    refresh();
  };

  const onManualPrint = async () => {
    window.open(`/api/stateform/render?dry=0&_=${Date.now()}`, "_blank");
    setTimeout(refresh, 1200);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-extrabold text-white">Indiana State Form 19433 — Draft Editor</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl shadow p-4 bg-neutral-900 text-white">
            <div className="text-sm opacity-80">Current Draft Page</div>
            <div className="text-3xl font-semibold">{status?.pageDraft ?? "…"}</div>
            <div className="mt-4 text-sm opacity-80">Staged rows</div>
            <div className="text-2xl">{status?.count ?? 0} / {status?.capacity ?? 44}</div>

            <div className="mt-4 flex gap-2">
              <input
                value={tag}
                onChange={(e)=>setTag(e.target.value)}
                placeholder="Scan/enter Tag to add"
                className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 w-full text-white"
              />
              <button onClick={onAdd} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500">Add</button>
            </div>

            <div className="mt-2 flex gap-2">
              <button onClick={onManualPrint} className="flex-1 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Print (flush)</button>
              <button onClick={onClear} className="flex-1 px-3 py-2 rounded bg-red-600 hover:bg-red-500">Clear</button>
            </div>
            <p className="mt-2 text-xs opacity-70">Print will lock, write history, bump page, clear rows.</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden shadow border border-neutral-700 bg-black">
            <iframe id="preview" title="State Form Preview" className="w-full h-[75vh]" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl shadow p-4 bg-neutral-900 text-white overflow-auto">
        <div className="mb-2 text-sm opacity-80">Edit any cell; changes auto-save.</div>
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold opacity-80 mb-2">
          <div>#</div><div>Tag</div><div>Date In</div><div>Date Out</div><div>Name</div><div>Address</div><div>Phone</div><div>Sex</div><div>Where Killed</div><div>How</div><div>Donated</div><div>Confirm #</div>
        </div>
        {(rows ?? []).map((r)=> (
          <div key={r.lineNo} className="grid grid-cols-12 gap-2 mb-2 items-center">
            <div className="text-center">{r.lineNo}</div>
            <Cell value={r.tag} onChange={(v)=>save(r.lineNo,{tag:v})} />
            <Cell value={r.dateIn} onChange={(v)=>save(r.lineNo,{dateIn:v})} placeholder="mm/dd/yy" />
            <Cell value={r.dateOut} onChange={(v)=>save(r.lineNo,{dateOut:v})} placeholder="mm/dd/yy" />
            <Cell value={r.name} onChange={(v)=>save(r.lineNo,{name:v})} />
            <Cell value={r.address} onChange={(v)=>save(r.lineNo,{address:v})} />
            <Cell value={r.phone} onChange={(v)=>save(r.lineNo,{phone:v})} />
            <Cell value={r.sex} onChange={(v)=>save(r.lineNo,{sex:v})} placeholder="BUCK/DOE/ANTLERLESS" />
            <Cell value={r.whereKilled} onChange={(v)=>save(r.lineNo,{whereKilled:v})} placeholder="County, IN" />
            <Cell value={r.howKilled} onChange={(v)=>save(r.lineNo,{howKilled:v})} placeholder="gun/arch/veh" />
            <Cell value={r.donated} onChange={(v)=>save(r.lineNo,{donated:v})} placeholder="Y/N" />
            <div className="flex items-center gap-2">
              <Cell value={r.confirmation} onChange={(v)=>save(r.lineNo,{confirmation:v})} />
              <button onClick={()=>onDelete(r.lineNo)} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs">Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
