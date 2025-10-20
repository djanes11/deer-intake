
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = {
  totalUnprinted: number;
  currentRows: number;
  pageRows: number;
  idsOnPage: string[];
  entries: any[];
};

export default function StateFormScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [ver, setVer] = useState(0);
  const poll = useRef<any>(null);

  const refresh = async () => {
    const r = await fetch("/api/stateform/status", { cache: "no-store" });
    const j = (await r.json()) as Status;
    setStatus(j);
  };

  useEffect(() => {
    refresh();
    poll.current = setInterval(refresh, 8000);
    return () => clearInterval(poll.current);
  }, []);

  useEffect(() => {
    if (!status || !autoPrint) return;
    if (status.currentRows === status.pageRows && status.pageRows > 0) {
      const batchId = `batch_${Date.now()}`;
      window.open(`/api/stateform/pdf?_=${Date.now()}`, "_blank");
      fetch("/api/stateform/mark-printed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: status.idsOnPage, batchId }),
      }).then(() => {
        setTimeout(refresh, 1500);
        setVer(v => v + 1);
      });
    }
  }, [status, autoPrint]);

  const previewUrl = useMemo(() => `/api/stateform/pdf?_=${ver}`, [ver]);

  if (!status) return <main style={{ padding: 16 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h2>Indiana State Form (19433 R7)</h2>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <strong>{status.currentRows}</strong> / {status.pageRows} on current sheet •{" "}
          <strong>{status.totalUnprinted}</strong> in queue
        </div>
        <label style={{ marginLeft: "auto", display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
          Auto‑print when full
        </label>
        <button onClick={() => setVer(v => v + 1)}>Rebuild Preview</button>
        <button onClick={() => window.open(`/api/stateform/pdf?_=${Date.now()}`, "_blank")}>
          Print full sheet now
        </button>
        <button
          onClick={async () => {
            if (!status.idsOnPage.length) return;
            const batchId = `manual_${Date.now()}`;
            window.open(`/api/stateform/pdf?_=${Date.now()}`, "_blank");
            await fetch("/api/stateform/mark-printed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: status.idsOnPage, batchId }),
            });
            setTimeout(refresh, 1500);
          }}
          disabled={!status.idsOnPage.length}
        >
          Print current (partial)
        </button>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <iframe key={previewUrl} src={previewUrl} style={{ width: "100%", height: 900, border: 0 }} />
      </div>
    </main>
  );
}
