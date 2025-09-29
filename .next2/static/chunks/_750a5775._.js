(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getJob",
    ()=>getJob,
    "progress",
    ()=>progress,
    "saveJob",
    ()=>saveJob,
    "searchJobs",
    ()=>searchJobs
]);
const BASE = '/api/gas2';
async function getJob(tag) {
    const res = await fetch("".concat(BASE, "/get?tag=").concat(encodeURIComponent(tag)), {
        cache: 'no-store'
    });
    return res.json();
}
async function saveJob(job) {
    const res = await fetch("".concat(BASE, "/save"), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            job
        })
    });
    return res.json();
}
async function progress(tag) {
    const res = await fetch("".concat(BASE, "/progress"), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tag
        })
    });
    return res.json();
}
async function searchJobs(opts) {
    const o = typeof opts === 'string' ? {
        q: opts
    } : opts || {};
    const p = new URLSearchParams();
    if (o.q) p.set('q', o.q);
    if (o.status) p.set('status', o.status);
    if (o.limit != null) p.set('limit', String(o.limit));
    if (o.offset != null) p.set('offset', String(o.offset));
    const res = await fetch("".concat(BASE, "/search?").concat(p.toString()), {
        cache: 'no-store'
    });
    return res.json();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/PrintSheet.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PrintSheet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
// ---- Helpers (pure) ----
function jget(job, keys) {
    if (!job) return "";
    for (const k of keys){
        const v = job[k];
        if (v !== undefined && v !== null && v !== "") return String(v);
    }
    return "";
}
function asPounds(x) {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
}
function moneyNumber(val) {
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
function moneyFormat(n) {
    return Number.isFinite(n) ? "$" + n.toFixed(2) : "$0.00";
}
function normProc(s) {
    s = String(s || "").toLowerCase();
    if (s.includes("cape") && !s.includes("skull")) return "Caped";
    if (s.includes("skull")) return "Skull-Cap";
    if (s.includes("euro")) return "European";
    if (s.includes("standard")) return "Standard Processing";
    return "";
}
function suggestedPrice(proc, beef, webbs) {
    const p = normProc(proc);
    let base = p === "Caped" ? 150 : [
        "Standard Processing",
        "Skull-Cap",
        "European"
    ].includes(p) ? 130 : 0;
    if (!base) return Number.NaN;
    return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}
// NEW: include specialty in print price
function toInt(val) {
    const n = parseInt(String(val !== null && val !== void 0 ? val : '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}
function specialtyPrice(job) {
    const ss = toInt(job === null || job === void 0 ? void 0 : job.summerSausageLbs);
    const ssc = toInt(job === null || job === void 0 ? void 0 : job.summerSausageCheeseLbs);
    const jer = toInt(job === null || job === void 0 ? void 0 : job.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}
function calcTotalPrice(job) {
    const base = suggestedPrice(job === null || job === void 0 ? void 0 : job.processType, !!(job === null || job === void 0 ? void 0 : job.beefFat), !!(job === null || job === void 0 ? void 0 : job.webbsOrder));
    const spec = specialtyPrice(job);
    const n = Number(base || 0) + Number(spec || 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}
function hasSpecialty(job) {
    const has = !!jget(job, [
        "specialtyProducts",
        "Specialty Products",
        "Would like specialty products"
    ]);
    const ss = asPounds(jget(job, [
        "summerSausageLbs",
        "Summer Sausage (lb)",
        "summer_sausage_lbs"
    ]));
    const ssc = asPounds(jget(job, [
        "summerSausageCheeseLbs",
        "Summer Sausage + Cheese (lb)",
        "summer_sausage_cheese_lbs"
    ]));
    const jer = asPounds(jget(job, [
        "slicedJerkyLbs",
        "Sliced Jerky (lb)",
        "sliced_jerky_lbs"
    ]));
    return !!(has || ss || ssc || jer);
}
function PrintSheet(param) {
    let { tag, job } = param;
    _s();
    const pageCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PrintSheet.useMemo[pageCount]": ()=>hasSpecialty(job) ? 2 : 1
    }["PrintSheet.useMemo[pageCount]"], [
        job
    ]);
    const pages = Array.from({
        length: pageCount
    }, (_, i)=>i);
    // Barcode rendering
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PrintSheet.useEffect": ()=>{
            const render = {
                "PrintSheet.useEffect.render": ()=>{
                    try {
                        const code = job && job.tag ? job.tag : tag || "";
                        const wraps = document.querySelectorAll("#barcodeWrap");
                        if (!code) {
                            wraps.forEach({
                                "PrintSheet.useEffect.render": (w)=>w.style.display = "none"
                            }["PrintSheet.useEffect.render"]);
                            return;
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const JsBarcode = window.JsBarcode;
                        if (!JsBarcode) return;
                        document.querySelectorAll("svg#tagBarcode").forEach({
                            "PrintSheet.useEffect.render": (svg)=>{
                                JsBarcode(svg, code, {
                                    format: "CODE128",
                                    lineColor: "#111",
                                    width: 1.25,
                                    height: 24,
                                    displayValue: true,
                                    font: "monospace",
                                    fontSize: 11,
                                    textMargin: 2,
                                    margin: 0
                                });
                            }
                        }["PrintSheet.useEffect.render"]);
                    } catch (e) {
                        console.error("Barcode render error", e);
                        document.querySelectorAll("#barcodeWrap").forEach({
                            "PrintSheet.useEffect.render": (w)=>w.style.display = "none"
                        }["PrintSheet.useEffect.render"]);
                    }
                }
            }["PrintSheet.useEffect.render"];
            // load JsBarcode from CDN if needed
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (window.JsBarcode) render();
            else {
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
                s.onload = render;
                s.onerror = ({
                    "PrintSheet.useEffect": ()=>{
                        console.error("Failed to load JsBarcode");
                        document.querySelectorAll("#barcodeWrap").forEach({
                            "PrintSheet.useEffect": (w)=>w.style.display = "none"
                        }["PrintSheet.useEffect"]);
                    }
                })["PrintSheet.useEffect"];
                document.head.appendChild(s);
            }
        }
    }["PrintSheet.useEffect"], [
        job,
        tag
    ]);
    // Derived fields
    const tagText = job && job.tag ? job.tag : tag || "";
    const priceText = moneyFormat(calcTotalPrice(job));
    const addr2 = [
        job === null || job === void 0 ? void 0 : job.city,
        job === null || job === void 0 ? void 0 : job.state,
        job === null || job === void 0 ? void 0 : job.zip
    ].filter(Boolean).join(", ");
    const steakOtherShown = String((job === null || job === void 0 ? void 0 : job.steak) || "").toLowerCase() === "other" && String((job === null || job === void 0 ? void 0 : job.steakOther) || "").trim() !== "";
    const specialtyShown = hasSpecialty(job);
    const spec_ss = asPounds(jget(job, [
        "summerSausageLbs",
        "Summer Sausage (lb)",
        "summer_sausage_lbs"
    ]));
    const spec_ssc = asPounds(jget(job, [
        "summerSausageCheeseLbs",
        "Summer Sausage + Cheese (lb)",
        "summer_sausage_cheese_lbs"
    ]));
    const spec_jer = asPounds(jget(job, [
        "slicedJerkyLbs",
        "Sliced Jerky (lb)",
        "sliced_jerky_lbs"
    ]));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jsx-e93470cfc9d058d1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "e93470cfc9d058d1",
                children: ":root{--fs-base:12px;--fs-h:16px;--fs-label:10px;--fs-badge:11px;--pad-box:6px;--pad-val:3px 5px;--gap-row:4px;--gap-col:8px;--radius:6px;--border:#cfd9ee;--val-border:#e5ecf8}*{box-sizing:border-box}body{color:#111;font-family:Arial,sans-serif;font-size:var(--fs-base);margin:8px;line-height:1.25}.wrap{max-width:800px;margin:0 auto}h2{font-size:var(--fs-h);margin:0 0 6px}.grid{gap:var(--gap-row)var(--gap-col);grid-template-columns:repeat(12,1fr);display:grid}.col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}.box{border:1px solid var(--border);border-radius:var(--radius);padding:var(--pad-box);break-inside:avoid;page-break-inside:avoid}.row{gap:6px;display:flex}.label{font-size:var(--fs-label);color:#334155;margin-bottom:2px;font-weight:700}.val{padding:var(--pad-val);border:1px solid var(--val-border);border-radius:calc(var(--radius) - 1px)}.check{font-weight:700}.hr{border-top:1px dashed #ccd7ee;margin:6px 0}.money{font-weight:800}.sig{border-top:1px solid #333;height:1px;margin-top:10px}#barcodeWrap{margin-top:4px}#tagBarcode{width:100%;max-width:180px;height:auto;display:block}.noprint{display:block}.page{margin:0 auto;position:relative}.sheet{margin:0}@media print{@page{size:Letter;margin:6mm}.noprint{display:none!important}body,.wrap{margin:0}:root{--fs-base:18px;--fs-h:20px;--fs-label:11.5px;--pad-box:1px;--pad-val:0 3px;--gap-row:5px;--gap-col:5px}h2{margin:0 0 4px!important}.row{gap:4px!important}.hr{margin:4px 0!important}.val{line-height:1.1!important}#barcodeWrap{margin-top:2mm}#tagBarcode{max-width:56mm}.page{page-break-after:always}.page:last-of-type{page-break-after:auto}}"
            }, void 0, false, void 0, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: "pages",
                className: "jsx-e93470cfc9d058d1",
                children: pages.map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-e93470cfc9d058d1" + " " + "page",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "jsx-e93470cfc9d058d1" + " " + "wrap sheet",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "6px"
                                    },
                                    className: "jsx-e93470cfc9d058d1" + " " + "row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "jsx-e93470cfc9d058d1",
                                            children: "Deer Intake"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 197,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-e93470cfc9d058d1" + " " + "noprint",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>window.print(),
                                                className: "jsx-e93470cfc9d058d1",
                                                children: "Print"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 198,
                                                columnNumber: 42
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 198,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 196,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-e93470cfc9d058d1" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-e93470cfc9d058d1" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-e93470cfc9d058d1" + " " + "label",
                                                    children: "Tag #"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 203,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_tag",
                                                    className: "jsx-e93470cfc9d058d1" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.tag) || tag || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 204,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "barcodeWrap",
                                                    className: "jsx-e93470cfc9d058d1",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                        id: "tagBarcode",
                                                        role: "img",
                                                        "aria-label": "Tag barcode",
                                                        className: "jsx-e93470cfc9d058d1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 206,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 205,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 202,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-e93470cfc9d058d1" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-e93470cfc9d058d1" + " " + "label",
                                                    children: "Confirmation #"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 209,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_conf",
                                                    className: "jsx-e93470cfc9d058d1" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.confirmation) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 209,
                                                    columnNumber: 87
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 209,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-e93470cfc9d058d1" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-e93470cfc9d058d1" + " " + "label",
                                                    children: "Drop-off Date"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 210,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_drop",
                                                    className: "jsx-e93470cfc9d058d1" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.dropoff) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 210,
                                                    columnNumber: 86
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 210,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-e93470cfc9d058d1" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-e93470cfc9d058d1" + " " + "label",
                                                    children: "Price"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 211,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_price",
                                                    className: "jsx-e93470cfc9d058d1" + " " + "val money",
                                                    children: priceText
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 211,
                                                    columnNumber: 78
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 211,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 201,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/PrintSheet.tsx",
                            lineNumber: 195,
                            columnNumber: 13
                        }, this)
                    }, i, false, {
                        fileName: "[project]/app/components/PrintSheet.tsx",
                        lineNumber: 194,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/components/PrintSheet.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/PrintSheet.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
_s(PrintSheet, "F0KQPcJDIrVpKLJgaAiypKASTT4=");
_c = PrintSheet;
var _c;
__turbopack_context__.k.register(_c, "PrintSheet");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/intake/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>IntakePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$PrintSheet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/PrintSheet.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
/* --------------- Helpers --------------- */ const todayISO = ()=>{
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};
const normProc = (s)=>{
    const v = String(s || '').toLowerCase();
    if (v.includes('cape') && !v.includes('skull')) return 'Caped';
    if (v.includes('skull')) return 'Skull-Cap';
    if (v.includes('euro')) return 'European';
    if (v.includes('standard')) return 'Standard Processing';
    return '';
};
const suggestedPrice = (proc, beef, webbs)=>{
    const p = normProc(proc);
    const base = p === 'Caped' ? 150 : [
        'Standard Processing',
        'Skull-Cap',
        'European'
    ].includes(p) ? 130 : 0;
    if (!base) return 0;
    return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
};
const toInt = (val)=>{
    const n = parseInt(String(val !== null && val !== void 0 ? val : '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const specialtyPrice = (job)=>{
    const ss = toInt(job.summerSausageLbs);
    const ssc = toInt(job.summerSausageCheeseLbs);
    const jer = toInt(job.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 15.0;
};
const calcTotal = (job)=>suggestedPrice(job.processType, !!job.beefFat, !!job.webbsOrder) + specialtyPrice(job);
/* ---- Fixed status choices + guards ---- */ const STATUS_MAIN = [
    'Dropped Off',
    'Processing',
    'Finished',
    'Called',
    'Picked Up'
];
const STATUS_CAPE = [
    'Dropped Off',
    'Caped',
    'Called',
    'Picked Up'
];
const STATUS_WEBBS = [
    'Dropped Off',
    'Sent',
    'Delivered',
    'Called',
    'Picked Up'
];
const coerce = (v, list)=>list.includes(String(v)) ? String(v) : list[0];
function IntakePage() {
    var _job_hind, _job_front;
    _s();
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    var _sp_get;
    const tagFromUrl = (_sp_get = sp.get('tag')) !== null && _sp_get !== void 0 ? _sp_get : '';
    const [job, setJob] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        tag: tagFromUrl || '',
        dropoff: todayISO(),
        status: 'Dropped Off',
        capingStatus: '',
        webbsStatus: '',
        hind: {
            'Hind - Steak': false,
            'Hind - Roast': false,
            'Hind - Grind': false,
            'Hind - None': false
        },
        front: {
            'Front - Steak': false,
            'Front - Roast': false,
            'Front - Grind': false,
            'Front - None': false
        },
        beefFat: false,
        webbsOrder: false,
        Paid: false,
        paid: false,
        specialtyProducts: false
    });
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [msg, setMsg] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const tagRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IntakePage.useEffect": ()=>{
            var _tagRef_current;
            (_tagRef_current = tagRef.current) === null || _tagRef_current === void 0 ? void 0 : _tagRef_current.focus();
        }
    }["IntakePage.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IntakePage.useEffect": ()=>{
            ({
                "IntakePage.useEffect": async ()=>{
                    if (!tagFromUrl) return;
                    try {
                        const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getJob"])(tagFromUrl);
                        if ((res === null || res === void 0 ? void 0 : res.exists) && res.job) {
                            const j = res.job;
                            setJob({
                                "IntakePage.useEffect": (prev)=>{
                                    var _j_hind, _j_hind1, _j_hind2, _j_hind3, _j_front, _j_front1, _j_front2, _j_front3;
                                    var _j_Paid, _j_Paid1;
                                    return {
                                        ...prev,
                                        ...j,
                                        tag: j.tag || tagFromUrl,
                                        dropoff: j.dropoff || todayISO(),
                                        status: coerce(j.status || prev.status || 'Dropped Off', STATUS_MAIN),
                                        capingStatus: coerce(j.capingStatus || (j.processType === 'Caped' ? 'Dropped Off' : ''), STATUS_CAPE),
                                        webbsStatus: coerce(j.webbsStatus || (j.webbsOrder ? 'Dropped Off' : ''), STATUS_WEBBS),
                                        hind: {
                                            'Hind - Steak': !!(j === null || j === void 0 ? void 0 : (_j_hind = j.hind) === null || _j_hind === void 0 ? void 0 : _j_hind['Hind - Steak']),
                                            'Hind - Roast': !!(j === null || j === void 0 ? void 0 : (_j_hind1 = j.hind) === null || _j_hind1 === void 0 ? void 0 : _j_hind1['Hind - Roast']),
                                            'Hind - Grind': !!(j === null || j === void 0 ? void 0 : (_j_hind2 = j.hind) === null || _j_hind2 === void 0 ? void 0 : _j_hind2['Hind - Grind']),
                                            'Hind - None': !!(j === null || j === void 0 ? void 0 : (_j_hind3 = j.hind) === null || _j_hind3 === void 0 ? void 0 : _j_hind3['Hind - None'])
                                        },
                                        front: {
                                            'Front - Steak': !!(j === null || j === void 0 ? void 0 : (_j_front = j.front) === null || _j_front === void 0 ? void 0 : _j_front['Front - Steak']),
                                            'Front - Roast': !!(j === null || j === void 0 ? void 0 : (_j_front1 = j.front) === null || _j_front1 === void 0 ? void 0 : _j_front1['Front - Roast']),
                                            'Front - Grind': !!(j === null || j === void 0 ? void 0 : (_j_front2 = j.front) === null || _j_front2 === void 0 ? void 0 : _j_front2['Front - Grind']),
                                            'Front - None': !!(j === null || j === void 0 ? void 0 : (_j_front3 = j.front) === null || _j_front3 === void 0 ? void 0 : _j_front3['Front - None'])
                                        },
                                        Paid: !!((_j_Paid = j.Paid) !== null && _j_Paid !== void 0 ? _j_Paid : j.paid),
                                        paid: !!((_j_Paid1 = j.Paid) !== null && _j_Paid1 !== void 0 ? _j_Paid1 : j.paid),
                                        specialtyProducts: !!j.specialtyProducts
                                    };
                                }
                            }["IntakePage.useEffect"]);
                        } else {
                            setJob({
                                "IntakePage.useEffect": (p)=>({
                                        ...p,
                                        tag: tagFromUrl,
                                        dropoff: p.dropoff || todayISO(),
                                        status: p.status || 'Dropped Off',
                                        capingStatus: p.processType === 'Caped' ? 'Dropped Off' : '',
                                        webbsStatus: p.webbsOrder ? 'Dropped Off' : ''
                                    })
                            }["IntakePage.useEffect"]);
                        }
                    } catch (e) {
                        setMsg("Load failed: ".concat((e === null || e === void 0 ? void 0 : e.message) || e));
                    }
                }
            })["IntakePage.useEffect"]();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["IntakePage.useEffect"], [
        tagFromUrl
    ]);
    const total = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "IntakePage.useMemo[total]": ()=>calcTotal(job)
    }["IntakePage.useMemo[total]"], [
        job
    ]);
    const hindRoastOn = !!((_job_hind = job.hind) === null || _job_hind === void 0 ? void 0 : _job_hind['Hind - Roast']);
    const frontRoastOn = !!((_job_front = job.front) === null || _job_front === void 0 ? void 0 : _job_front['Front - Roast']);
    const isWholeBackstrap = job.backstrapPrep === 'Whole';
    const needsBackstrapOther = !isWholeBackstrap && job.backstrapThickness === 'Other';
    const needsSteakOther = job.steak === 'Other';
    const capedOn = job.processType === 'Caped';
    const webbsOn = !!job.webbsOrder;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IntakePage.useEffect": ()=>{
            setJob({
                "IntakePage.useEffect": (p)=>{
                    const next = {
                        ...p
                    };
                    if (capedOn && !next.capingStatus) next.capingStatus = 'Dropped Off';
                    if (webbsOn && !next.webbsStatus) next.webbsStatus = 'Dropped Off';
                    return next;
                }
            }["IntakePage.useEffect"]);
        }
    }["IntakePage.useEffect"], [
        capedOn,
        webbsOn
    ]);
    const validate = ()=>{
        const missing = [];
        if (!job.customer) missing.push('Customer Name');
        if (!job.phone) missing.push('Phone');
        if (!job.email) missing.push('Email');
        if (!job.address) missing.push('Address');
        if (!job.city) missing.push('City');
        if (!job.state) missing.push('State');
        if (!job.zip) missing.push('Zip');
        if (!job.county) missing.push('County Killed');
        if (!job.dropoff) missing.push('Drop-off Date');
        if (!job.sex) missing.push('Deer Sex');
        if (!job.processType) missing.push('Process Type');
        return missing;
    };
    const onSave = async ()=>{
        setMsg('');
        const missing = validate();
        if (missing.length) {
            setMsg("Missing or invalid: ".concat(missing.join(', ')));
            return;
        }
        var _job_Paid, _job_Paid1;
        const payload = {
            ...job,
            status: coerce(job.status, STATUS_MAIN),
            capingStatus: job.processType === 'Caped' ? coerce(job.capingStatus, STATUS_CAPE) : '',
            webbsStatus: job.webbsOrder ? coerce(job.webbsStatus, STATUS_WEBBS) : '',
            Paid: !!((_job_Paid = job.Paid) !== null && _job_Paid !== void 0 ? _job_Paid : job.paid),
            paid: !!((_job_Paid1 = job.Paid) !== null && _job_Paid1 !== void 0 ? _job_Paid1 : job.paid),
            summerSausageLbs: String(toInt(job.summerSausageLbs)),
            summerSausageCheeseLbs: String(toInt(job.summerSausageCheeseLbs)),
            slicedJerkyLbs: String(toInt(job.slicedJerkyLbs))
        };
        try {
            setBusy(true);
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveJob"])(payload);
            if (!(res === null || res === void 0 ? void 0 : res.ok)) {
                setMsg((res === null || res === void 0 ? void 0 : res.error) || 'Save failed');
                return;
            }
            setMsg('Saved ✓');
            if (job.tag) {
                const fresh = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getJob"])(job.tag);
                if ((fresh === null || fresh === void 0 ? void 0 : fresh.exists) && fresh.job) setJob((p)=>({
                        ...p,
                        ...fresh.job
                    }));
            }
        } catch (e) {
            setMsg((e === null || e === void 0 ? void 0 : e.message) || String(e));
        } finally{
            setBusy(false);
            setTimeout(()=>setMsg(''), 1500);
        }
    };
    const setVal = (k, v)=>setJob((p)=>({
                ...p,
                [k]: v
            }));
    const setHind = (k)=>setJob((p)=>{
            var _p_hind;
            return {
                ...p,
                hind: {
                    ...p.hind || {},
                    [k]: !((_p_hind = p.hind) === null || _p_hind === void 0 ? void 0 : _p_hind[k])
                }
            };
        });
    const setFront = (k)=>setJob((p)=>{
            var _p_front;
            return {
                ...p,
                front: {
                    ...p.front || {},
                    [k]: !((_p_front = p.front) === null || _p_front === void 0 ? void 0 : _p_front[k])
                }
            };
        });
    var _job_Paid;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "screen-only",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: "Deer Intake"
                    }, void 0, false, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 292,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "summary",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "col",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            children: "Tag Number"
                                        }, void 0, false, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 297,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            ref: tagRef,
                                            value: job.tag || '',
                                            onChange: (e)=>setVal('tag', e.target.value),
                                            placeholder: "e.g. 1234"
                                        }, void 0, false, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 298,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/intake/page.tsx",
                                    lineNumber: 296,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "col price",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            children: "Price"
                                        }, void 0, false, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 306,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "money",
                                            children: Number(total).toFixed(2)
                                        }, void 0, false, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 307,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/intake/page.tsx",
                                    lineNumber: 305,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "col",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            children: "Paid"
                                        }, void 0, false, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 310,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pill ".concat(job.Paid ? 'on' : ''),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: !!((_job_Paid = job.Paid) !== null && _job_Paid !== void 0 ? _job_Paid : job.paid),
                                                    onChange: (e)=>{
                                                        const v = e.target.checked;
                                                        setJob((p)=>({
                                                                ...p,
                                                                Paid: v,
                                                                paid: v
                                                            }));
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 312,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "badge",
                                                    children: job.Paid ? 'PAID' : 'UNPAID'
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 320,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 311,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/intake/page.tsx",
                                    lineNumber: 309,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/intake/page.tsx",
                            lineNumber: 295,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/intake/page.tsx",
                lineNumber: 291,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "print-only",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$PrintSheet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    job: job
                }, void 0, false, {
                    fileName: "[project]/app/intake/page.tsx",
                    lineNumber: 333,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/intake/page.tsx",
                lineNumber: 332,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/intake/page.tsx",
        lineNumber: 290,
        columnNumber: 5
    }, this);
}
_s(IntakePage, "BoEpNIY2CvjGYvkveHdOcs+Gzq8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c = IntakePage;
var _c;
__turbopack_context__.k.register(_c, "IntakePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/compiled/client-only/index.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[project]/node_modules/styled-jsx/dist/index/index.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
__turbopack_context__.r("[project]/node_modules/next/dist/compiled/client-only/index.js [app-client] (ecmascript)");
var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
function _interopDefaultLegacy(e) {
    return e && typeof e === 'object' && 'default' in e ? e : {
        'default': e
    };
}
var React__default = /*#__PURE__*/ _interopDefaultLegacy(React);
/*
Based on Glamor's sheet
https://github.com/threepointone/glamor/blob/667b480d31b3721a905021b26e1290ce92ca2879/src/sheet.js
*/ function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
var isProd = typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] !== "undefined" && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env && ("TURBOPACK compile-time value", "development") === "production";
var isString = function(o) {
    return Object.prototype.toString.call(o) === "[object String]";
};
var StyleSheet = /*#__PURE__*/ function() {
    function StyleSheet(param) {
        var ref = param === void 0 ? {} : param, _name = ref.name, name = _name === void 0 ? "stylesheet" : _name, _optimizeForSpeed = ref.optimizeForSpeed, optimizeForSpeed = _optimizeForSpeed === void 0 ? isProd : _optimizeForSpeed;
        invariant$1(isString(name), "`name` must be a string");
        this._name = name;
        this._deletedRulePlaceholder = "#" + name + "-deleted-rule____{}";
        invariant$1(typeof optimizeForSpeed === "boolean", "`optimizeForSpeed` must be a boolean");
        this._optimizeForSpeed = optimizeForSpeed;
        this._serverSheet = undefined;
        this._tags = [];
        this._injected = false;
        this._rulesCount = 0;
        var node = typeof window !== "undefined" && document.querySelector('meta[property="csp-nonce"]');
        this._nonce = node ? node.getAttribute("content") : null;
    }
    var _proto = StyleSheet.prototype;
    _proto.setOptimizeForSpeed = function setOptimizeForSpeed(bool) {
        invariant$1(typeof bool === "boolean", "`setOptimizeForSpeed` accepts a boolean");
        invariant$1(this._rulesCount === 0, "optimizeForSpeed cannot be when rules have already been inserted");
        this.flush();
        this._optimizeForSpeed = bool;
        this.inject();
    };
    _proto.isOptimizeForSpeed = function isOptimizeForSpeed() {
        return this._optimizeForSpeed;
    };
    _proto.inject = function inject() {
        var _this = this;
        invariant$1(!this._injected, "sheet already injected");
        this._injected = true;
        if (typeof window !== "undefined" && this._optimizeForSpeed) {
            this._tags[0] = this.makeStyleTag(this._name);
            this._optimizeForSpeed = "insertRule" in this.getSheet();
            if (!this._optimizeForSpeed) {
                if ("TURBOPACK compile-time truthy", 1) {
                    console.warn("StyleSheet: optimizeForSpeed mode not supported falling back to standard mode.");
                }
                this.flush();
                this._injected = true;
            }
            return;
        }
        this._serverSheet = {
            cssRules: [],
            insertRule: function(rule, index) {
                if (typeof index === "number") {
                    _this._serverSheet.cssRules[index] = {
                        cssText: rule
                    };
                } else {
                    _this._serverSheet.cssRules.push({
                        cssText: rule
                    });
                }
                return index;
            },
            deleteRule: function(index) {
                _this._serverSheet.cssRules[index] = null;
            }
        };
    };
    _proto.getSheetForTag = function getSheetForTag(tag) {
        if (tag.sheet) {
            return tag.sheet;
        }
        // this weirdness brought to you by firefox
        for(var i = 0; i < document.styleSheets.length; i++){
            if (document.styleSheets[i].ownerNode === tag) {
                return document.styleSheets[i];
            }
        }
    };
    _proto.getSheet = function getSheet() {
        return this.getSheetForTag(this._tags[this._tags.length - 1]);
    };
    _proto.insertRule = function insertRule(rule, index) {
        invariant$1(isString(rule), "`insertRule` accepts only strings");
        if (typeof window === "undefined") {
            if (typeof index !== "number") {
                index = this._serverSheet.cssRules.length;
            }
            this._serverSheet.insertRule(rule, index);
            return this._rulesCount++;
        }
        if (this._optimizeForSpeed) {
            var sheet = this.getSheet();
            if (typeof index !== "number") {
                index = sheet.cssRules.length;
            }
            // this weirdness for perf, and chrome's weird bug
            // https://stackoverflow.com/questions/20007992/chrome-suddenly-stopped-accepting-insertrule
            try {
                sheet.insertRule(rule, index);
            } catch (error) {
                if ("TURBOPACK compile-time truthy", 1) {
                    console.warn("StyleSheet: illegal rule: \n\n" + rule + "\n\nSee https://stackoverflow.com/q/20007992 for more info");
                }
                return -1;
            }
        } else {
            var insertionPoint = this._tags[index];
            this._tags.push(this.makeStyleTag(this._name, rule, insertionPoint));
        }
        return this._rulesCount++;
    };
    _proto.replaceRule = function replaceRule(index, rule) {
        if (this._optimizeForSpeed || typeof window === "undefined") {
            var sheet = typeof window !== "undefined" ? this.getSheet() : this._serverSheet;
            if (!rule.trim()) {
                rule = this._deletedRulePlaceholder;
            }
            if (!sheet.cssRules[index]) {
                // @TBD Should we throw an error?
                return index;
            }
            sheet.deleteRule(index);
            try {
                sheet.insertRule(rule, index);
            } catch (error) {
                if ("TURBOPACK compile-time truthy", 1) {
                    console.warn("StyleSheet: illegal rule: \n\n" + rule + "\n\nSee https://stackoverflow.com/q/20007992 for more info");
                }
                // In order to preserve the indices we insert a deleteRulePlaceholder
                sheet.insertRule(this._deletedRulePlaceholder, index);
            }
        } else {
            var tag = this._tags[index];
            invariant$1(tag, "old rule at index `" + index + "` not found");
            tag.textContent = rule;
        }
        return index;
    };
    _proto.deleteRule = function deleteRule(index) {
        if (typeof window === "undefined") {
            this._serverSheet.deleteRule(index);
            return;
        }
        if (this._optimizeForSpeed) {
            this.replaceRule(index, "");
        } else {
            var tag = this._tags[index];
            invariant$1(tag, "rule at index `" + index + "` not found");
            tag.parentNode.removeChild(tag);
            this._tags[index] = null;
        }
    };
    _proto.flush = function flush() {
        this._injected = false;
        this._rulesCount = 0;
        if (typeof window !== "undefined") {
            this._tags.forEach(function(tag) {
                return tag && tag.parentNode.removeChild(tag);
            });
            this._tags = [];
        } else {
            // simpler on server
            this._serverSheet.cssRules = [];
        }
    };
    _proto.cssRules = function cssRules() {
        var _this = this;
        if (typeof window === "undefined") {
            return this._serverSheet.cssRules;
        }
        return this._tags.reduce(function(rules, tag) {
            if (tag) {
                rules = rules.concat(Array.prototype.map.call(_this.getSheetForTag(tag).cssRules, function(rule) {
                    return rule.cssText === _this._deletedRulePlaceholder ? null : rule;
                }));
            } else {
                rules.push(null);
            }
            return rules;
        }, []);
    };
    _proto.makeStyleTag = function makeStyleTag(name, cssString, relativeToTag) {
        if (cssString) {
            invariant$1(isString(cssString), "makeStyleTag accepts only strings as second parameter");
        }
        var tag = document.createElement("style");
        if (this._nonce) tag.setAttribute("nonce", this._nonce);
        tag.type = "text/css";
        tag.setAttribute("data-" + name, "");
        if (cssString) {
            tag.appendChild(document.createTextNode(cssString));
        }
        var head = document.head || document.getElementsByTagName("head")[0];
        if (relativeToTag) {
            head.insertBefore(tag, relativeToTag);
        } else {
            head.appendChild(tag);
        }
        return tag;
    };
    _createClass(StyleSheet, [
        {
            key: "length",
            get: function get() {
                return this._rulesCount;
            }
        }
    ]);
    return StyleSheet;
}();
function invariant$1(condition, message) {
    if (!condition) {
        throw new Error("StyleSheet: " + message + ".");
    }
}
function hash(str) {
    var _$hash = 5381, i = str.length;
    while(i){
        _$hash = _$hash * 33 ^ str.charCodeAt(--i);
    }
    /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */ return _$hash >>> 0;
}
var stringHash = hash;
var sanitize = function(rule) {
    return rule.replace(/\/style/gi, "\\/style");
};
var cache = {};
/**
 * computeId
 *
 * Compute and memoize a jsx id from a basedId and optionally props.
 */ function computeId(baseId, props) {
    if (!props) {
        return "jsx-" + baseId;
    }
    var propsToString = String(props);
    var key = baseId + propsToString;
    if (!cache[key]) {
        cache[key] = "jsx-" + stringHash(baseId + "-" + propsToString);
    }
    return cache[key];
}
/**
 * computeSelector
 *
 * Compute and memoize dynamic selectors.
 */ function computeSelector(id, css) {
    var selectoPlaceholderRegexp = /__jsx-style-dynamic-selector/g;
    // Sanitize SSR-ed CSS.
    // Client side code doesn't need to be sanitized since we use
    // document.createTextNode (dev) and the CSSOM api sheet.insertRule (prod).
    if (typeof window === "undefined") {
        css = sanitize(css);
    }
    var idcss = id + css;
    if (!cache[idcss]) {
        cache[idcss] = css.replace(selectoPlaceholderRegexp, id);
    }
    return cache[idcss];
}
function mapRulesToStyle(cssRules, options) {
    if (options === void 0) options = {};
    return cssRules.map(function(args) {
        var id = args[0];
        var css = args[1];
        return /*#__PURE__*/ React__default["default"].createElement("style", {
            id: "__" + id,
            // Avoid warnings upon render with a key
            key: "__" + id,
            nonce: options.nonce ? options.nonce : undefined,
            dangerouslySetInnerHTML: {
                __html: css
            }
        });
    });
}
var StyleSheetRegistry = /*#__PURE__*/ function() {
    function StyleSheetRegistry(param) {
        var ref = param === void 0 ? {} : param, _styleSheet = ref.styleSheet, styleSheet = _styleSheet === void 0 ? null : _styleSheet, _optimizeForSpeed = ref.optimizeForSpeed, optimizeForSpeed = _optimizeForSpeed === void 0 ? false : _optimizeForSpeed;
        this._sheet = styleSheet || new StyleSheet({
            name: "styled-jsx",
            optimizeForSpeed: optimizeForSpeed
        });
        this._sheet.inject();
        if (styleSheet && typeof optimizeForSpeed === "boolean") {
            this._sheet.setOptimizeForSpeed(optimizeForSpeed);
            this._optimizeForSpeed = this._sheet.isOptimizeForSpeed();
        }
        this._fromServer = undefined;
        this._indices = {};
        this._instancesCounts = {};
    }
    var _proto = StyleSheetRegistry.prototype;
    _proto.add = function add(props) {
        var _this = this;
        if (undefined === this._optimizeForSpeed) {
            this._optimizeForSpeed = Array.isArray(props.children);
            this._sheet.setOptimizeForSpeed(this._optimizeForSpeed);
            this._optimizeForSpeed = this._sheet.isOptimizeForSpeed();
        }
        if (typeof window !== "undefined" && !this._fromServer) {
            this._fromServer = this.selectFromServer();
            this._instancesCounts = Object.keys(this._fromServer).reduce(function(acc, tagName) {
                acc[tagName] = 0;
                return acc;
            }, {});
        }
        var ref = this.getIdAndRules(props), styleId = ref.styleId, rules = ref.rules;
        // Deduping: just increase the instances count.
        if (styleId in this._instancesCounts) {
            this._instancesCounts[styleId] += 1;
            return;
        }
        var indices = rules.map(function(rule) {
            return _this._sheet.insertRule(rule);
        }) // Filter out invalid rules
        .filter(function(index) {
            return index !== -1;
        });
        this._indices[styleId] = indices;
        this._instancesCounts[styleId] = 1;
    };
    _proto.remove = function remove(props) {
        var _this = this;
        var styleId = this.getIdAndRules(props).styleId;
        invariant(styleId in this._instancesCounts, "styleId: `" + styleId + "` not found");
        this._instancesCounts[styleId] -= 1;
        if (this._instancesCounts[styleId] < 1) {
            var tagFromServer = this._fromServer && this._fromServer[styleId];
            if (tagFromServer) {
                tagFromServer.parentNode.removeChild(tagFromServer);
                delete this._fromServer[styleId];
            } else {
                this._indices[styleId].forEach(function(index) {
                    return _this._sheet.deleteRule(index);
                });
                delete this._indices[styleId];
            }
            delete this._instancesCounts[styleId];
        }
    };
    _proto.update = function update(props, nextProps) {
        this.add(nextProps);
        this.remove(props);
    };
    _proto.flush = function flush() {
        this._sheet.flush();
        this._sheet.inject();
        this._fromServer = undefined;
        this._indices = {};
        this._instancesCounts = {};
    };
    _proto.cssRules = function cssRules() {
        var _this = this;
        var fromServer = this._fromServer ? Object.keys(this._fromServer).map(function(styleId) {
            return [
                styleId,
                _this._fromServer[styleId]
            ];
        }) : [];
        var cssRules = this._sheet.cssRules();
        return fromServer.concat(Object.keys(this._indices).map(function(styleId) {
            return [
                styleId,
                _this._indices[styleId].map(function(index) {
                    return cssRules[index].cssText;
                }).join(_this._optimizeForSpeed ? "" : "\n")
            ];
        }) // filter out empty rules
        .filter(function(rule) {
            return Boolean(rule[1]);
        }));
    };
    _proto.styles = function styles(options) {
        return mapRulesToStyle(this.cssRules(), options);
    };
    _proto.getIdAndRules = function getIdAndRules(props) {
        var css = props.children, dynamic = props.dynamic, id = props.id;
        if (dynamic) {
            var styleId = computeId(id, dynamic);
            return {
                styleId: styleId,
                rules: Array.isArray(css) ? css.map(function(rule) {
                    return computeSelector(styleId, rule);
                }) : [
                    computeSelector(styleId, css)
                ]
            };
        }
        return {
            styleId: computeId(id),
            rules: Array.isArray(css) ? css : [
                css
            ]
        };
    };
    /**
   * selectFromServer
   *
   * Collects style tags from the document with id __jsx-XXX
   */ _proto.selectFromServer = function selectFromServer() {
        var elements = Array.prototype.slice.call(document.querySelectorAll('[id^="__jsx-"]'));
        return elements.reduce(function(acc, element) {
            var id = element.id.slice(2);
            acc[id] = element;
            return acc;
        }, {});
    };
    return StyleSheetRegistry;
}();
function invariant(condition, message) {
    if (!condition) {
        throw new Error("StyleSheetRegistry: " + message + ".");
    }
}
var StyleSheetContext = /*#__PURE__*/ React.createContext(null);
StyleSheetContext.displayName = "StyleSheetContext";
function createStyleRegistry() {
    return new StyleSheetRegistry();
}
function StyleRegistry(param) {
    var configuredRegistry = param.registry, children = param.children;
    var rootRegistry = React.useContext(StyleSheetContext);
    var ref = React.useState({
        "StyleRegistry.useState[ref]": function() {
            return rootRegistry || configuredRegistry || createStyleRegistry();
        }
    }["StyleRegistry.useState[ref]"]), registry = ref[0];
    return /*#__PURE__*/ React__default["default"].createElement(StyleSheetContext.Provider, {
        value: registry
    }, children);
}
function useStyleRegistry() {
    return React.useContext(StyleSheetContext);
}
// Opt-into the new `useInsertionEffect` API in React 18, fallback to `useLayoutEffect`.
// https://github.com/reactwg/react-18/discussions/110
var useInsertionEffect = React__default["default"].useInsertionEffect || React__default["default"].useLayoutEffect;
var defaultRegistry = typeof window !== "undefined" ? createStyleRegistry() : undefined;
function JSXStyle(props) {
    var registry = defaultRegistry ? defaultRegistry : useStyleRegistry();
    // If `registry` does not exist, we do nothing here.
    if (!registry) {
        return null;
    }
    if (typeof window === "undefined") {
        registry.add(props);
        return null;
    }
    useInsertionEffect({
        "JSXStyle.useInsertionEffect": function() {
            registry.add(props);
            return ({
                "JSXStyle.useInsertionEffect": function() {
                    registry.remove(props);
                }
            })["JSXStyle.useInsertionEffect"];
        // props.children can be string[], will be striped since id is identical
        }
    }["JSXStyle.useInsertionEffect"], [
        props.id,
        String(props.dynamic)
    ]);
    return null;
}
JSXStyle.dynamic = function(info) {
    return info.map(function(tagInfo) {
        var baseId = tagInfo[0];
        var props = tagInfo[1];
        return computeId(baseId, props);
    }).join(" ");
};
exports.StyleRegistry = StyleRegistry;
exports.createStyleRegistry = createStyleRegistry;
exports.style = JSXStyle;
exports.useStyleRegistry = useStyleRegistry;
}),
"[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/styled-jsx/dist/index/index.js [app-client] (ecmascript)").style;
}),
]);

//# sourceMappingURL=_750a5775._.js.map