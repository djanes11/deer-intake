"use client";
import React, { useEffect, useMemo } from "react";

type AnyRec = Record<string, any>;

export interface PrintSheetProps {
  tag?: string;
  job?: AnyRec | null;
}

// ---- Helpers (pure) ----
function jget(job: AnyRec | null | undefined, keys: string[]): string {
  if (!job) return "";
  for (const k of keys) {
    const v = job[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function asPounds(x: any): string {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function moneyNumber(val: any): number {
  if (val instanceof Date) return Number.NaN;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.\-]/g, "").trim();
    if (!cleaned) return Number.NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : Number.NaN;
}

function moneyFormat(n: number): string {
  return Number.isFinite(n) ? "$" + n.toFixed(2) : "$0.00";
}

function normProc(s: any): string {
  s = String(s || "").toLowerCase();
  if (s.includes("cape") && !s.includes("skull")) return "Caped";
  if (s.includes("skull")) return "Skull-Cap";
  if (s.includes("euro")) return "European";
  if (s.includes("standard")) return "Standard Processing";
  return "";
}

function suggestedPrice(proc: any, beef: boolean, webbs: boolean): number {
  const p = normProc(proc);
  let base =
    p === "Caped" ? 150 :
    (["Standard Processing", "Skull-Cap", "European"].includes(p) ? 130 : 0);
  if (!base) return Number.NaN;
  return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}

function normalizedPrice(job: AnyRec | null | undefined): number {
  let n = moneyNumber(job && (job as any).price);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) {
    n = suggestedPrice(job && (job as any).processType, !!(job && (job as any).beefFat), !!(job && (job as any).webbsOrder));
  }
  if (!Number.isFinite(n) || n < 0) n = 0;
  return n;
}

function hasSpecialty(job: AnyRec | null | undefined): boolean {
  const has = !!jget(job, ["specialtyProducts", "Specialty Products", "Would like specialty products"]);
  const ss  = asPounds(jget(job, ["summerSausageLbs", "Summer Sausage (lb)", "summer_sausage_lbs"]));
  const ssc = asPounds(jget(job, ["summerSausageCheeseLbs", "Summer Sausage + Cheese (lb)", "summer_sausage_cheese_lbs"]));
  const jer = asPounds(jget(job, ["slicedJerkyLbs", "Sliced Jerky (lb)", "sliced_jerky_lbs"]));
  return !!(has || ss || ssc || jer);
}

// ---- Component ----
export default function PrintSheet({ tag, job }: PrintSheetProps) {
  const pageCount = useMemo(() => (hasSpecialty(job) ? 2 : 1), [job]);
  const pages = Array.from({ length: pageCount }, (_, i) => i);

  // Barcode rendering (identical to provided HTML behavior)
  useEffect(() => {
    const render = () => {
      try {
        const code = (job && (job as any).tag) ? (job as any).tag : (tag || "");
        const wraps = document.querySelectorAll<HTMLElement>("#barcodeWrap");
        if (!code) {
          wraps.forEach((w) => (w.style.display = "none"));
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const JsBarcode: any = (window as any).JsBarcode;
        if (!JsBarcode) return;
        document.querySelectorAll<SVGSVGElement>("svg#tagBarcode").forEach((svg) => {
         // inside useEffect → render() → JsBarcode options
JsBarcode(svg, code, {
  format: "CODE128",
  lineColor: "#111",
  width: 1.25,
  height: 18,       // was 24 (or 36 earlier) → ~half height
  displayValue: true,
  font: "monospace",
  fontSize: 10,     // was 11; optional tweak to keep proportions nice
  textMargin: 2,
  margin: 0,
});

        });
      } catch (e) {
        console.error("Barcode render error", e);
        document.querySelectorAll<HTMLElement>("#barcodeWrap").forEach((w) => (w.style.display = "none"));
      }
    };
    // load JsBarcode from CDN if needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).JsBarcode) render();
    else {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
      s.onload = render;
      s.onerror = () => {
        console.error("Failed to load JsBarcode");
        document.querySelectorAll<HTMLElement>("#barcodeWrap").forEach((w) => (w.style.display = "none"));
      };
      document.head.appendChild(s);
    }
  }, [job, tag]);

  // Derived fields
  const tagText = (job && (job as any).tag) ? (job as any).tag : (tag || "");
  const priceText = moneyFormat(normalizedPrice(job));
  const addr2 = [job?.city, job?.state, job?.zip].filter(Boolean).join(", ");
  const steakOtherShown = String(job?.steak || "").toLowerCase() === "other" && String(job?.steakOther || "").trim() !== "";
  const specialtyShown = hasSpecialty(job);
  const spec_ss  = asPounds(jget(job, ["summerSausageLbs","Summer Sausage (lb)","summer_sausage_lbs"]));
  const spec_ssc = asPounds(jget(job, ["summerSausageCheeseLbs","Summer Sausage + Cheese (lb)","summer_sausage_cheese_lbs"]));
  const spec_jer = asPounds(jget(job, ["slicedJerkyLbs","Sliced Jerky (lb)","sliced_jerky_lbs"]));

  return (
    <div>
      <style jsx global>{`
        /* ===== Base (on-screen) — unchanged look ===== */
        :root{
          --fs-base:12px; --fs-h:16px; --fs-label:10px; --fs-badge:11px;
          --pad-box:6px; --pad-val:3px 5px; --gap-row:4px; --gap-col:8px;
          --radius:6px; --border:#cfd9ee; --val-border:#e5ecf8;
        }
        *{ box-sizing:border-box; }
        body{ font-family:Arial, sans-serif; color:#111; margin:8px; font-size:var(--fs-base); line-height:1.25; }
        .wrap{ max-width:800px; margin:0 auto; }
        h2{ margin:0 0 6px; font-size:var(--fs-h); }
        .grid{ display:grid; grid-template-columns:repeat(12,1fr); gap:var(--gap-row) var(--gap-col); }
        .col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}
        .box{ border:1px solid var(--border); border-radius:var(--radius); padding:var(--pad-box); break-inside:avoid; page-break-inside:avoid; }
        .row{ display:flex; gap:6px; }
        .label{ font-size:var(--fs-label); color:#334155; font-weight:bold; margin-bottom:2px; }
        .val{ padding:var(--pad-val); border:1px solid var(--val-border); border-radius:calc(var(--radius) - 1px); }
        .check{ font-weight:bold; }
        .hr{ border-top:1px dashed #ccd7ee; margin:6px 0; }
        .money{ font-weight:800; }
        .sig{ margin-top:10px; border-top:1px solid #333; height:1px; }
        #barcodeWrap { margin-top:4px; }
        #tagBarcode  { width:100%; max-width:180px; height:auto; display:block; }

        .noprint{ display:block; }
        .page{ position:relative; margin:0 auto; }
        .sheet{ margin:0; }

        /* ===== Print: bigger fonts, tightened spacing so it still fits ===== */
        @media print{
          @page { size: Letter; margin:6mm; }
          .noprint{ display:none !important; }
          body{ margin:0; }
          .wrap{ margin:0; }

          :root{
            --fs-base:18px;
            --fs-h:20px;
            --fs-label:11.5px;
            --pad-box:1px;
            --pad-val:0 3px;
            --gap-row:5px;
            --gap-col:5px;
          }

          h2{ margin:0 0 4px !important; }
          .row{ gap:4px !important; }
          .hr{ margin:4px 0 !important; }
          .val{ line-height:1.10 !important; }
          #barcodeWrap { margin-top:2mm; }
          #tagBarcode  { max-width:56mm; }

          .page{ page-break-after: always; }
          .page:last-of-type{ page-break-after: auto; }
        }
      `}</style>

      <div id="pages">
        {pages.map((i) => (
          <div className="page" key={i}>
            <div className="wrap sheet">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h2>Deer Intake</h2>
                <div className="noprint"><button onClick={() => window.print()}>Print</button></div>
              </div>

              <div className="grid">
                <div className="col-3 box">
                  <div className="label">Tag #</div>
                  <div className="val" id="p_tag">{job?.tag || tag || ""}</div>
                  <div id="barcodeWrap">
                    <svg id="tagBarcode" role="img" aria-label="Tag barcode"></svg>
                  </div>
                </div>
                <div className="col-3 box"><div className="label">Confirmation #</div><div className="val" id="p_conf">{job?.confirmation || ""}</div></div>
                <div className="col-3 box"><div className="label">Drop-off Date</div><div className="val" id="p_drop">{job?.dropoff || ""}</div></div>
                <div className="col-3 box"><div className="label">Price</div><div className="val money" id="p_price">{priceText}</div></div>
              </div>

              <div className="hr"></div>

              <div className="grid">
                <div className="col-6 box">
                  <div className="label">Customer</div>
                  <div className="val" id="p_name">{job?.customer || ""}</div>
                  <div className="val" id="p_phone">{job?.phone || ""}</div>
                  <div className="val" id="p_email">{job?.email || ""}</div>
                </div>
                <div className="col-6 box">
                  <div className="label">Address</div>
                  <div className="val" id="p_addr1">{job?.address || ""}</div>
                  <div className="val" id="p_addr2">{addr2}</div>
                </div>
              </div>

              <div className="grid" style={{ marginTop: "4px" }}>
                <div className="col-4 box"><div className="label">County Killed</div><div className="val" id="p_county">{job?.county || ""}</div></div>
                <div className="col-4 box"><div className="label">Sex</div><div className="val" id="p_sex">{job?.sex || ""}</div></div>
                <div className="col-4 box"><div className="label">Process Type</div><div className="val" id="p_proc">{job?.processType || ""}</div></div>
              </div>

              <div className="hr"></div>

              <div className="grid">
                <div className="col-6 box">
                  <div className="label">Hind Quarter</div>
                  <div className="val"><span className="check" id="ph_s">{job?.hind && job.hind["Hind - Steak"] ? "✓" : "□"}</span> {" "}Steak</div>
                  <div className="val">
                    <span className="check" id="ph_r">{job?.hind && job.hind["Hind - Roast"] ? "✓" : "□"}</span> {" "}
                    Roast &nbsp; Count: <span id="ph_rc">{(job?.hindRoastCount === "" ? "" : (job?.hindRoastCount ?? ""))}</span>
                  </div>
                  <div className="val"><span className="check" id="ph_g">{job?.hind && job.hind["Hind - Grind"] ? "✓" : "□"}</span> {" "}Grind</div>
                  <div className="val"><span className="check" id="ph_n">{job?.hind && job.hind["Hind - None"] ? "✓" : "□"}</span> {" "}None</div>
                </div>
                <div className="col-6 box">
                  <div className="label">Front Shoulder</div>
                  <div className="val"><span className="check" id="pf_s">{job?.front && job.front["Front - Steak"] ? "✓" : "□"}</span> {" "}Steak</div>
                  <div className="val">
                    <span className="check" id="pf_r">{job?.front && job.front["Front - Roast"] ? "✓" : "□"}</span> {" "}
                    Roast &nbsp; Count: <span id="pf_rc">{(job?.frontRoastCount === "" ? "" : (job?.frontRoastCount ?? ""))}</span>
                  </div>
                  <div className="val"><span className="check" id="pf_g">{job?.front && job.front["Front - Grind"] ? "✓" : "□"}</span> {" "}Grind</div>
                  <div className="val"><span className="check" id="pf_n">{job?.front && job.front["Front - None"] ? "✓" : "□"}</span> {" "}None</div>
                </div>
              </div>

              <div className="grid" style={{ marginTop: "4px" }}>
                <div className="col-3 box"><div className="label">Steak Size</div><div className="val" id="p_steak">{job?.steak || ""}</div></div>
                <div className="col-3 box"><div className="label">Steaks / Pkg</div><div className="val" id="p_pkg">{job?.steaksPerPackage || ""}</div></div>
                <div className="col-3 box"><div className="label">Burger Size</div><div className="val" id="p_burger">{job?.burgerSize || ""}</div></div>
                <div className="col-3 box"><div className="label">Beef Fat</div><div className="val"><span className="check" id="p_beef">{job?.beefFat ? "✓" : "□"}</span> {" "}Add (+$5)</div></div>
              </div>

              {steakOtherShown && (
                <div className="grid" id="steakOtherRow" style={{ marginTop: "4px" }}>
                  <div className="col-3 box"><div className="label">Steak Size (Other)</div><div className="val" id="p_steakOther">{job?.steakOther || ""}</div></div>
                </div>
              )}

              <div className="grid" style={{ marginTop: "4px" }}>
                <div className="col-4 box"><div className="label">Backstrap Prep</div><div className="val" id="p_bs_prep">{job?.backstrapPrep || ""}</div></div>
                <div className="col-4 box"><div className="label">Backstrap Thickness</div><div className="val" id="p_bs_thick">{job?.backstrapThickness || ""}</div></div>
                <div className="col-4 box"><div className="label">Thickness (Other)</div><div className="val" id="p_bs_other">{job?.backstrapThicknessOther || ""}</div></div>
              </div>

              {specialtyShown && (
                <div className="grid" id="specialtyWrap" style={{ marginTop: "4px" }}>
                  <div className="col-12 box">
                    <div className="label">Specialty Products</div>
                    <div className="val"><span className="check" id="p_spec_chk">{"☑"}</span> {" "}Would like specialty products</div>
                    <div className="val">Summer Sausage (lb): <span id="p_spec_ss">{spec_ss}</span></div>
                    <div className="val">Summer Sausage + Cheese (lb): <span id="p_spec_ssc">{spec_ssc}</span></div>
                    <div className="val">Sliced Jerky (lb): <span id="p_spec_jerky">{spec_jer}</span></div>
                  </div>
                </div>
              )}

              <div className="grid" style={{ marginTop: "4px" }}>
                <div className="col-6 box">
                  <div className="label">Specialty Pounds (lb)</div>
                  <div className="val" id="p_spec_lbs">{(job?.specialtyPounds === "" ? "" : (job?.specialtyPounds ?? ""))}</div>
                </div>
              </div>

              <div className="box" style={{ marginTop: "4px" }}>
                <div className="label">Notes</div>
                <div className="val" id="p_notes" style={{ whiteSpace: "pre-wrap" }}>{job?.notes || ""}</div>
              </div>

              {(job?.webbsOrder) && (
                <div className="grid" style={{ marginTop: "4px" }}>
                  <div className="col-12 box" id="webbsDetails">
                    <div className="label">Webbs Details</div>
                    <div className="val"><span className="check" id="p_webbs_chk">{"✓"}</span> {" "}Webbs Order (+$20)</div>
                    <div className="val">Form #: <span id="p_webbs_form">{job?.webbsFormNumber || ""}</span></div>
                    <div className="val">Pounds: <span id="p_webbs_lbs">{(job?.webbsPounds === "" ? "" : (job?.webbsPounds ?? ""))}</span></div>
                  </div>
                </div>
              )}

              <div className="hr"></div>

              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="label">Paid</div>
                  <div className="val"><span className="check" id="p_paid">{(job?.paid || job?.Paid) ? "✓" : "□"}</span> {" "}Paid in full</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="label">Signature (on pickup)</div>
                  <div style={{ height: "26px" }}></div>
                  <div className="sig"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

