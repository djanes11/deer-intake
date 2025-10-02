(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// lib/api.ts — hardened against AbortError + clearer errors
__turbopack_context__.s([
    "getJob",
    ()=>getJob,
    "logCallSimple",
    ()=>logCallSimple,
    "markCalled",
    ()=>markCalled,
    "progress",
    ()=>progress,
    "saveJob",
    ()=>saveJob,
    "searchJobs",
    ()=>searchJobs
]);
const PROXY = '/api/gas2';
function urlForGet(params) {
    const q = new URLSearchParams(params).toString();
    return "".concat(PROXY, "?").concat(q);
}
function withTimeout(ms) {
    const ctrl = new AbortController();
    const id = setTimeout(()=>ctrl.abort(), ms);
    return {
        signal: ctrl.signal,
        cancel: ()=>clearTimeout(id)
    };
}
async function fetchJSON(input, init) {
    const { signal, cancel } = withTimeout(20000); // 20s
    try {
        const res = await fetch(input, {
            ...init,
            signal,
            headers: {
                'Content-Type': 'application/json',
                ...(init === null || init === void 0 ? void 0 : init.headers) || {}
            },
            cache: 'no-store',
            keepalive: false
        });
        // Read raw text first so we can show upstream HTML or text errors
        const text = await res.text().catch(()=>'');
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (e) {}
        if (!res.ok) {
            const msg = data && data.error ? data.error : text || "HTTP ".concat(res.status);
            throw new Error(msg);
        }
        return data !== null && data !== void 0 ? data : {};
    } catch (err) {
        // Map aborted requests to a clear message
        if ((err === null || err === void 0 ? void 0 : err.name) === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw new Error((err === null || err === void 0 ? void 0 : err.message) || 'Network error');
    } finally{
        cancel();
    }
}
async function searchJobs(q) {
    const path = urlForGet({
        action: 'search',
        q
    });
    const j = await fetchJSON(path);
    return {
        ...j,
        rows: j.rows || j.results || j.jobs || []
    };
}
async function getJob(tag) {
    const path = urlForGet({
        action: 'get',
        tag
    });
    return fetchJSON(path);
}
async function saveJob(job) {
    return fetchJSON(PROXY, {
        method: 'POST',
        body: JSON.stringify({
            action: 'save',
            job
        })
    });
}
async function progress(payload) {
    return fetchJSON(PROXY, {
        method: 'POST',
        body: JSON.stringify({
            action: 'progress',
            tag: payload.tag
        })
    });
}
async function logCallSimple(payload) {
    return fetchJSON(PROXY, {
        method: 'POST',
        body: JSON.stringify({
            action: 'log-call',
            ...payload
        })
    });
}
async function markCalled(payload) {
    return fetchJSON(PROXY, {
        method: 'POST',
        body: JSON.stringify({
            action: 'markCalled',
            tag: payload.tag,
            scope: payload.scope || 'auto',
            notes: payload.notes || ''
        })
    });
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
/* ---------------- Helpers (pure) ---------------- */ function jget(job, keys) {
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
function normProc(s) {
    s = String(s || "").toLowerCase();
    if (s.includes("cape") && !s.includes("skull")) return "Caped";
    if (s.includes("skull")) return "Skull-Cap";
    if (s.includes("euro")) return "European";
    if (s.includes("standard")) return "Standard Processing";
    return "";
}
// Processing price only (proc + beef fat + webbs fee)
function suggestedProcessingPrice(proc, beef, webbs) {
    const p = normProc(proc);
    let base = p === "Caped" ? 150 : [
        "Standard Processing",
        "Skull-Cap",
        "European"
    ].includes(p) ? 130 : 0;
    if (!base) return 0;
    return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
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
function money(n) {
    return "$" + (Number.isFinite(n) ? n.toFixed(2) : "0.00");
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
                                // inside useEffect → render() → JsBarcode options
                                JsBarcode(svg, code, {
                                    format: "CODE128",
                                    lineColor: "#111",
                                    width: 1.25,
                                    height: 18,
                                    displayValue: true,
                                    font: "monospace",
                                    fontSize: 10,
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
    // ---- Derived fields ----
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
    // Split prices (stay inside the same Price box)
    const processingPrice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PrintSheet.useMemo[processingPrice]": ()=>{
            return suggestedProcessingPrice(job === null || job === void 0 ? void 0 : job.processType, !!(job === null || job === void 0 ? void 0 : job.beefFat), !!(job === null || job === void 0 ? void 0 : job.webbsOrder));
        }
    }["PrintSheet.useMemo[processingPrice]"], [
        job === null || job === void 0 ? void 0 : job.processType,
        job === null || job === void 0 ? void 0 : job.beefFat,
        job === null || job === void 0 ? void 0 : job.webbsOrder
    ]);
    const specialtyPrice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PrintSheet.useMemo[specialtyPrice]": ()=>{
            const ss = Number(spec_ss) || 0;
            const ssc = Number(spec_ssc) || 0;
            const jer = Number(spec_jer) || 0;
            return ss * 4.25 + ssc * 4.60 + jer * 15.0;
        }
    }["PrintSheet.useMemo[specialtyPrice]"], [
        spec_ss,
        spec_ssc,
        spec_jer
    ]);
    const totalPrice = processingPrice + specialtyPrice;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jsx-fdbcd0965e3741ca",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "fdbcd0965e3741ca",
                children: ":root{--fs-base:12px;--fs-h:16px;--fs-label:10px;--fs-badge:11px;--pad-box:6px;--pad-val:3px 5px;--gap-row:4px;--gap-col:8px;--radius:6px;--border:#cfd9ee;--val-border:#e5ecf8}*{box-sizing:border-box}body{color:#111;font-family:Arial,sans-serif;font-size:var(--fs-base);margin:8px;line-height:1.25}.wrap{max-width:800px;margin:0 auto}h2{font-size:var(--fs-h);margin:0 0 6px}.grid{gap:var(--gap-row)var(--gap-col);grid-template-columns:repeat(12,1fr);display:grid}.col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}.box{border:1px solid var(--border);border-radius:var(--radius);padding:var(--pad-box);break-inside:avoid;page-break-inside:avoid}.row{gap:6px;display:flex}.label{font-size:var(--fs-label);color:#334155;margin-bottom:2px;font-weight:700}.val{padding:var(--pad-val);border:1px solid var(--val-border);border-radius:calc(var(--radius) - 1px)}.check{font-weight:700}.hr{border-top:1px dashed #ccd7ee;margin:6px 0}.money{font-weight:800}.moneyTotal{font-weight:900}.splitPriceRow{justify-content:space-between;gap:6px;display:flex}.splitSep{border-top:1px dashed #ccd7ee;margin:3px 0}#barcodeWrap{margin-top:4px}#tagBarcode{width:100%;max-width:180px;height:auto;display:block}.noprint{display:block}.page{margin:0 auto;position:relative}.sheet{margin:0}@media print{@page{size:Letter;margin:6mm}.noprint{display:none!important}body,.wrap{margin:0}:root{--fs-base:18px;--fs-h:20px;--fs-label:11.5px;--pad-box:1px;--pad-val:0 3px;--gap-row:5px;--gap-col:5px}h2{margin:0 0 4px!important}.row{gap:4px!important}.hr{margin:4px 0!important}.val{line-height:1.1!important}#barcodeWrap{margin-top:2mm}#tagBarcode{max-width:56mm}.page{page-break-after:always}.page:last-of-type{page-break-after:auto}}"
            }, void 0, false, void 0, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: "pages",
                className: "jsx-fdbcd0965e3741ca",
                children: pages.map((i)=>{
                    var _job_hindRoastCount, _job_frontRoastCount, _job_specialtyPounds, _job_webbsPounds;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-fdbcd0965e3741ca" + " " + "page",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "jsx-fdbcd0965e3741ca" + " " + "wrap sheet",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "6px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "jsx-fdbcd0965e3741ca",
                                            children: "Deer Intake"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 199,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "noprint",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>window.print(),
                                                className: "jsx-fdbcd0965e3741ca",
                                                children: "Print"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 200,
                                                columnNumber: 42
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 200,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 198,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Tag #"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 205,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_tag",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.tag) || tag || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 206,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "barcodeWrap",
                                                    className: "jsx-fdbcd0965e3741ca",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                        id: "tagBarcode",
                                                        role: "img",
                                                        "aria-label": "Tag barcode",
                                                        className: "jsx-fdbcd0965e3741ca"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 208,
                                                        columnNumber: 21
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 207,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 204,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Confirmation #"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 213,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_conf",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.confirmation) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 214,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 212,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Drop-off Date"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 218,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_drop",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.dropoff) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 219,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 217,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Price"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 224,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_price_box",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "splitPriceRow",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "jsx-fdbcd0965e3741ca",
                                                                    children: "Processing"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 227,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    id: "p_price_proc",
                                                                    className: "jsx-fdbcd0965e3741ca" + " " + "money",
                                                                    children: money(processingPrice)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 228,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 226,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "splitPriceRow",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "jsx-fdbcd0965e3741ca",
                                                                    children: "Specialty"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 231,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    id: "p_price_spec",
                                                                    className: "jsx-fdbcd0965e3741ca" + " " + "money",
                                                                    children: money(specialtyPrice)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 232,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 230,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "splitSep"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 234,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "splitPriceRow",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "jsx-fdbcd0965e3741ca",
                                                                    children: "Total"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 236,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    id: "p_price_total",
                                                                    className: "jsx-fdbcd0965e3741ca" + " " + "moneyTotal",
                                                                    children: money(totalPrice)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                                    lineNumber: 237,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 235,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 225,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 223,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 203,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "hr"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 243,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-6 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Customer"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 247,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_name",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.customer) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 248,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_phone",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.phone) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 249,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_email",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.email) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 250,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 246,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-6 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Address"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 253,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_addr1",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.address) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 254,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_addr2",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: addr2
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 255,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 252,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 245,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "County Killed"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 260,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_county",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.county) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 260,
                                                    columnNumber: 86
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 260,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Sex"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 261,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_sex",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.sex) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 261,
                                                    columnNumber: 76
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 261,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Process Type"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 262,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_proc",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.processType) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 262,
                                                    columnNumber: 85
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 262,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 259,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "hr"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 265,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-6 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Hind Quarter"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 269,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "ph_s",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.hind) && job.hind["Hind - Steak"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 270,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Steak"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 270,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "ph_r",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.hind) && job.hind["Hind - Roast"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 272,
                                                            columnNumber: 21
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Roast   Count: ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "ph_rc",
                                                            className: "jsx-fdbcd0965e3741ca",
                                                            children: (job === null || job === void 0 ? void 0 : job.hindRoastCount) === "" ? "" : (_job_hindRoastCount = job === null || job === void 0 ? void 0 : job.hindRoastCount) !== null && _job_hindRoastCount !== void 0 ? _job_hindRoastCount : ""
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 273,
                                                            columnNumber: 41
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 271,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "ph_g",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.hind) && job.hind["Hind - Grind"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 275,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Grind"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 275,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "ph_n",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.hind) && job.hind["Hind - None"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 276,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "None"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 276,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 268,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-6 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Front Shoulder"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 279,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "pf_s",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.front) && job.front["Front - Steak"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 280,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Steak"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 280,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "pf_r",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.front) && job.front["Front - Roast"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 282,
                                                            columnNumber: 21
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Roast   Count: ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "pf_rc",
                                                            className: "jsx-fdbcd0965e3741ca",
                                                            children: (job === null || job === void 0 ? void 0 : job.frontRoastCount) === "" ? "" : (_job_frontRoastCount = job === null || job === void 0 ? void 0 : job.frontRoastCount) !== null && _job_frontRoastCount !== void 0 ? _job_frontRoastCount : ""
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 283,
                                                            columnNumber: 41
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 281,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "pf_g",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.front) && job.front["Front - Grind"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 285,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Grind"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 285,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "pf_n",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.front) && job.front["Front - None"] ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 286,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "None"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 286,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 278,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 267,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Steak Size"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 291,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_steak",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.steak) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 291,
                                                    columnNumber: 83
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 291,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Steaks / Pkg"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 292,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_pkg",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.steaksPerPackage) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 292,
                                                    columnNumber: 85
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 292,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Burger Size"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 293,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_burger",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.burgerSize) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 293,
                                                    columnNumber: 84
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 293,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Beef Fat"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 294,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "p_beef",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.beefFat) ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 294,
                                                            columnNumber: 102
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Add (+$5)"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 294,
                                                    columnNumber: 81
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 294,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 290,
                                    columnNumber: 15
                                }, this),
                                steakOtherShown && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "steakOtherRow",
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-fdbcd0965e3741ca" + " " + "col-3 box",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                children: "Steak Size (Other)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 299,
                                                columnNumber: 46
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                id: "p_steakOther",
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: (job === null || job === void 0 ? void 0 : job.steakOther) || ""
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 299,
                                                columnNumber: 93
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                        lineNumber: 299,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 298,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Backstrap Prep"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 304,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_bs_prep",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.backstrapPrep) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 304,
                                                    columnNumber: 87
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 304,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Backstrap Thickness"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 305,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_bs_thick",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.backstrapThickness) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 305,
                                                    columnNumber: 92
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 305,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "col-4 box",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Thickness (Other)"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 306,
                                                    columnNumber: 44
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    id: "p_bs_other",
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: (job === null || job === void 0 ? void 0 : job.backstrapThicknessOther) || ""
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 306,
                                                    columnNumber: 90
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 306,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 303,
                                    columnNumber: 15
                                }, this),
                                specialtyShown && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "specialtyWrap",
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-fdbcd0965e3741ca" + " " + "col-12 box",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                children: "Specialty Products"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 312,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_spec_chk",
                                                        className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                        children: "☑"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 313,
                                                        columnNumber: 42
                                                    }, this),
                                                    " ",
                                                    " ",
                                                    "Would like specialty products"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 313,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    "Summer Sausage (lb): ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_spec_ss",
                                                        className: "jsx-fdbcd0965e3741ca",
                                                        children: spec_ss
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 314,
                                                        columnNumber: 63
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 314,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    "Summer Sausage + Cheese (lb): ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_spec_ssc",
                                                        className: "jsx-fdbcd0965e3741ca",
                                                        children: spec_ssc
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 315,
                                                        columnNumber: 72
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 315,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    "Sliced Jerky (lb): ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_spec_jerky",
                                                        className: "jsx-fdbcd0965e3741ca",
                                                        children: spec_jer
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 316,
                                                        columnNumber: 61
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 316,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                        lineNumber: 311,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 310,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-fdbcd0965e3741ca" + " " + "col-6 box",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                children: "Specialty Pounds (lb)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 323,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                id: "p_spec_lbs",
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: (job === null || job === void 0 ? void 0 : job.specialtyPounds) === "" ? "" : (_job_specialtyPounds = job === null || job === void 0 ? void 0 : job.specialtyPounds) !== null && _job_specialtyPounds !== void 0 ? _job_specialtyPounds : ""
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 324,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                        lineNumber: 322,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 321,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "box",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                            children: "Notes"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 329,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            id: "p_notes",
                                            style: {
                                                whiteSpace: "pre-wrap"
                                            },
                                            className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                            children: (job === null || job === void 0 ? void 0 : job.notes) || ""
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 330,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 328,
                                    columnNumber: 15
                                }, this),
                                (job === null || job === void 0 ? void 0 : job.webbsOrder) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    style: {
                                        marginTop: "4px"
                                    },
                                    className: "jsx-fdbcd0965e3741ca" + " " + "grid",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        id: "webbsDetails",
                                        className: "jsx-fdbcd0965e3741ca" + " " + "col-12 box",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                children: "Webbs Details"
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 336,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_webbs_chk",
                                                        className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                        children: "✓"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 337,
                                                        columnNumber: 42
                                                    }, this),
                                                    " ",
                                                    " ",
                                                    "Webbs Order (+$20)"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 337,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    "Form #: ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_webbs_form",
                                                        className: "jsx-fdbcd0965e3741ca",
                                                        children: (job === null || job === void 0 ? void 0 : job.webbsFormNumber) || ""
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 338,
                                                        columnNumber: 50
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 338,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                children: [
                                                    "Pounds: ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        id: "p_webbs_lbs",
                                                        className: "jsx-fdbcd0965e3741ca",
                                                        children: (job === null || job === void 0 ? void 0 : job.webbsPounds) === "" ? "" : (_job_webbsPounds = job === null || job === void 0 ? void 0 : job.webbsPounds) !== null && _job_webbsPounds !== void 0 ? _job_webbsPounds : ""
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                                        lineNumber: 339,
                                                        columnNumber: 50
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/components/PrintSheet.tsx",
                                                lineNumber: 339,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/components/PrintSheet.tsx",
                                        lineNumber: 335,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 334,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "hr"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 344,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "jsx-fdbcd0965e3741ca" + " " + "row",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                flex: 1
                                            },
                                            className: "jsx-fdbcd0965e3741ca",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Paid"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 348,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "val",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            id: "p_paid",
                                                            className: "jsx-fdbcd0965e3741ca" + " " + "check",
                                                            children: (job === null || job === void 0 ? void 0 : job.paid) || (job === null || job === void 0 ? void 0 : job.Paid) ? "✓" : "□"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                                            lineNumber: 349,
                                                            columnNumber: 40
                                                        }, this),
                                                        " ",
                                                        " ",
                                                        "Paid in full"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 349,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 347,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                flex: 1
                                            },
                                            className: "jsx-fdbcd0965e3741ca",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "label",
                                                    children: "Signature (on pickup)"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 352,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        height: "26px"
                                                    },
                                                    className: "jsx-fdbcd0965e3741ca"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 353,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-fdbcd0965e3741ca" + " " + "sig"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                                    lineNumber: 354,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/PrintSheet.tsx",
                                            lineNumber: 351,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/PrintSheet.tsx",
                                    lineNumber: 346,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/PrintSheet.tsx",
                            lineNumber: 197,
                            columnNumber: 13
                        }, this)
                    }, i, false, {
                        fileName: "[project]/app/components/PrintSheet.tsx",
                        lineNumber: 196,
                        columnNumber: 11
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/app/components/PrintSheet.tsx",
                lineNumber: 194,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/components/PrintSheet.tsx",
        lineNumber: 134,
        columnNumber: 5
    }, this);
}
_s(PrintSheet, "rkbeUvOQXQWuv2fOmHK8CuJl4lE=");
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
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
// Base (processing) price only: process type + beef fat + webbs fee
const suggestedProcessingPrice = (proc, beef, webbs)=>{
    const p = normProc(proc);
    const base = p === 'Caped' ? 150 : [
        'Standard Processing',
        'Skull-Cap',
        'European'
    ].includes(p) ? 130 : 0;
    if (!base) return 0;
    return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
};
// For specialty fields, parse int lbs
const toInt = (val)=>{
    const n = parseInt(String(val !== null && val !== void 0 ? val : '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const asBool = (v)=>{
    if (typeof v === 'boolean') return v;
    const s = String(v !== null && v !== void 0 ? v : '').trim().toLowerCase();
    return [
        'true',
        'yes',
        'y',
        '1',
        'on',
        'paid',
        'x',
        '✓',
        '✔'
    ].includes(s);
};
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
    var _job_hind, _job_front, _job_hind1, _job_hind2, _job_hind3, _job_hind4, _job_front1, _job_front2, _job_front3, _job_front4;
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
        paidProcessing: false,
        paidSpecialty: false,
        specialtyProducts: false
    });
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [msg, setMsg] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const tagRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Focus Tag on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IntakePage.useEffect": ()=>{
            var _tagRef_current;
            (_tagRef_current = tagRef.current) === null || _tagRef_current === void 0 ? void 0 : _tagRef_current.focus();
        }
    }["IntakePage.useEffect"], []);
    // Load existing job by tag (if present)
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
                                    var _asBool, _asBool1, _asBool2, _asBool3, _asBool4, _asBool5, _asBool6, _asBool7;
                                    var _j_confirmation, _ref, _ref1, _ref2, _j_Paid, _ref3, _j_Paid1, _ref4, _j_paidProcessing, _ref5, _j_paidSpecialty, _ref6;
                                    return {
                                        ...prev,
                                        ...j,
                                        tag: j.tag || tagFromUrl,
                                        dropoff: j.dropoff || todayISO(),
                                        status: coerce(j.status || prev.status || 'Dropped Off', STATUS_MAIN),
                                        capingStatus: coerce(j.capingStatus || (j.processType === 'Caped' ? 'Dropped Off' : ''), STATUS_CAPE),
                                        webbsStatus: coerce(j.webbsStatus || (j.webbsOrder ? 'Dropped Off' : ''), STATUS_WEBBS),
                                        hind: {
                                            'Hind - Steak': (_asBool = asBool(j === null || j === void 0 ? void 0 : j.hind)) === null || _asBool === void 0 ? void 0 : _asBool['Hind - Steak'],
                                            'Hind - Roast': (_asBool1 = asBool(j === null || j === void 0 ? void 0 : j.hind)) === null || _asBool1 === void 0 ? void 0 : _asBool1['Hind - Roast'],
                                            'Hind - Grind': (_asBool2 = asBool(j === null || j === void 0 ? void 0 : j.hind)) === null || _asBool2 === void 0 ? void 0 : _asBool2['Hind - Grind'],
                                            'Hind - None': (_asBool3 = asBool(j === null || j === void 0 ? void 0 : j.hind)) === null || _asBool3 === void 0 ? void 0 : _asBool3['Hind - None']
                                        },
                                        front: {
                                            'Front - Steak': (_asBool4 = asBool(j === null || j === void 0 ? void 0 : j.front)) === null || _asBool4 === void 0 ? void 0 : _asBool4['Front - Steak'],
                                            'Front - Roast': (_asBool5 = asBool(j === null || j === void 0 ? void 0 : j.front)) === null || _asBool5 === void 0 ? void 0 : _asBool5['Front - Roast'],
                                            'Front - Grind': (_asBool6 = asBool(j === null || j === void 0 ? void 0 : j.front)) === null || _asBool6 === void 0 ? void 0 : _asBool6['Front - Grind'],
                                            'Front - None': (_asBool7 = asBool(j === null || j === void 0 ? void 0 : j.front)) === null || _asBool7 === void 0 ? void 0 : _asBool7['Front - None']
                                        },
                                        // Confirmation mapping (preserve if sheet uses other header)
                                        confirmation: (_ref2 = (_ref1 = (_ref = (_j_confirmation = j.confirmation) !== null && _j_confirmation !== void 0 ? _j_confirmation : j['Confirmation #']) !== null && _ref !== void 0 ? _ref : j['Confirmation']) !== null && _ref1 !== void 0 ? _ref1 : prev.confirmation) !== null && _ref2 !== void 0 ? _ref2 : '',
                                        // PAID flags: load both split and legacy
                                        Paid: !!((_ref3 = (_j_Paid = j.Paid) !== null && _j_Paid !== void 0 ? _j_Paid : j.paid) !== null && _ref3 !== void 0 ? _ref3 : j.paidProcessing && j.paidSpecialty),
                                        paid: !!((_ref4 = (_j_Paid1 = j.Paid) !== null && _j_Paid1 !== void 0 ? _j_Paid1 : j.paid) !== null && _ref4 !== void 0 ? _ref4 : j.paidProcessing && j.paidSpecialty),
                                        paidProcessing: !!((_ref5 = (_j_paidProcessing = j.paidProcessing) !== null && _j_paidProcessing !== void 0 ? _j_paidProcessing : j.PaidProcessing) !== null && _ref5 !== void 0 ? _ref5 : j.Paid_Processing),
                                        paidSpecialty: !!((_ref6 = (_j_paidSpecialty = j.paidSpecialty) !== null && _j_paidSpecialty !== void 0 ? _j_paidSpecialty : j.PaidSpecialty) !== null && _ref6 !== void 0 ? _ref6 : j.Paid_Specialty),
                                        specialtyProducts: asBool(j.specialtyProducts)
                                    };
                                }
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
    // Derived UI toggles + pricing
    const processingPrice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "IntakePage.useMemo[processingPrice]": ()=>suggestedProcessingPrice(job.processType, !!job.beefFat, !!job.webbsOrder)
    }["IntakePage.useMemo[processingPrice]"], [
        job.processType,
        job.beefFat,
        job.webbsOrder
    ]);
    const specialtyPrice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "IntakePage.useMemo[specialtyPrice]": ()=>{
            if (!job.specialtyProducts) return 0;
            const ss = toInt(job.summerSausageLbs);
            const ssc = toInt(job.summerSausageCheeseLbs);
            const jer = toInt(job.slicedJerkyLbs);
            return ss * 4.25 + ssc * 4.60 + jer * 15.0;
        }
    }["IntakePage.useMemo[specialtyPrice]"], [
        job.specialtyProducts,
        job.summerSausageLbs,
        job.summerSausageCheeseLbs,
        job.slicedJerkyLbs
    ]);
    const totalPrice = processingPrice + specialtyPrice;
    const hindRoastOn = !!((_job_hind = job.hind) === null || _job_hind === void 0 ? void 0 : _job_hind['Hind - Roast']);
    const frontRoastOn = !!((_job_front = job.front) === null || _job_front === void 0 ? void 0 : _job_front['Front - Roast']);
    const isWholeBackstrap = job.backstrapPrep === 'Whole';
    const hasSpecialty = asBool(job.specialtyProducts);
    const needsBackstrapOther = !isWholeBackstrap && job.backstrapThickness === 'Other';
    const needsSteakOther = job.steak === 'Other';
    const capedOn = job.processType === 'Caped';
    const webbsOn = !!job.webbsOrder;
    // Keep conditional statuses defaulted if newly toggled on and empty
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
    /* ---------- Validation ---------- */ const validate = ()=>{
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
    /* ---------- Save ---------- */ const onSave = async ()=>{
        setMsg('');
        const missing = validate();
        if (missing.length) {
            setMsg("Missing or invalid: ".concat(missing.join(', ')));
            return;
        }
        var _job_Paid, _ref, _job_Paid1, _ref1;
        const payload = {
            ...job,
            status: coerce(job.status, STATUS_MAIN),
            capingStatus: job.processType === 'Caped' ? coerce(job.capingStatus, STATUS_CAPE) : '',
            webbsStatus: job.webbsOrder ? coerce(job.webbsStatus, STATUS_WEBBS) : '',
            // keep legacy 'Paid' in sync, and send split flags
            Paid: !!((_ref = (_job_Paid = job.Paid) !== null && _job_Paid !== void 0 ? _job_Paid : job.paid) !== null && _ref !== void 0 ? _ref : job.paidProcessing && job.paidSpecialty),
            paid: !!((_ref1 = (_job_Paid1 = job.Paid) !== null && _job_Paid1 !== void 0 ? _job_Paid1 : job.paid) !== null && _ref1 !== void 0 ? _ref1 : job.paidProcessing && job.paidSpecialty),
            paidProcessing: !!job.paidProcessing,
            paidSpecialty: job.specialtyProducts ? !!job.paidSpecialty : false,
            // numeric normalizations for specialty lbs
            summerSausageLbs: job.specialtyProducts ? String(toInt(job.summerSausageLbs)) : '',
            summerSausageCheeseLbs: job.specialtyProducts ? String(toInt(job.summerSausageCheeseLbs)) : '',
            slicedJerkyLbs: job.specialtyProducts ? String(toInt(job.slicedJerkyLbs)) : ''
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
                if ((fresh === null || fresh === void 0 ? void 0 : fresh.exists) && fresh.job) {
                    const j = fresh.job;
                    setJob((p)=>{
                        var _j_confirmation, _ref, _ref1, _ref2, _j_Paid, _ref3, _j_Paid1, _ref4, _j_paidProcessing, _ref5, _j_paidSpecialty, _ref6;
                        return {
                            ...p,
                            ...j,
                            // preserve/mirror confirmation & paid flags
                            confirmation: (_ref2 = (_ref1 = (_ref = (_j_confirmation = j.confirmation) !== null && _j_confirmation !== void 0 ? _j_confirmation : j['Confirmation #']) !== null && _ref !== void 0 ? _ref : j['Confirmation']) !== null && _ref1 !== void 0 ? _ref1 : p.confirmation) !== null && _ref2 !== void 0 ? _ref2 : '',
                            Paid: !!((_ref3 = (_j_Paid = j.Paid) !== null && _j_Paid !== void 0 ? _j_Paid : j.paid) !== null && _ref3 !== void 0 ? _ref3 : j.paidProcessing && j.paidSpecialty),
                            paid: !!((_ref4 = (_j_Paid1 = j.Paid) !== null && _j_Paid1 !== void 0 ? _j_Paid1 : j.paid) !== null && _ref4 !== void 0 ? _ref4 : j.paidProcessing && j.paidSpecialty),
                            paidProcessing: !!((_ref5 = (_j_paidProcessing = j.paidProcessing) !== null && _j_paidProcessing !== void 0 ? _j_paidProcessing : j.PaidProcessing) !== null && _ref5 !== void 0 ? _ref5 : j.Paid_Processing),
                            paidSpecialty: !!((_ref6 = (_j_paidSpecialty = j.paidSpecialty) !== null && _j_paidSpecialty !== void 0 ? _j_paidSpecialty : j.PaidSpecialty) !== null && _ref6 !== void 0 ? _ref6 : j.Paid_Specialty)
                        };
                    });
                }
            }
        } catch (e) {
            setMsg((e === null || e === void 0 ? void 0 : e.message) || String(e));
        } finally{
            setBusy(false);
            setTimeout(()=>setMsg(''), 1500);
        }
    };
    /* ---------- Small setters ---------- */ const setVal = (k, v)=>setJob((p)=>({
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
    var _job_summerSausageLbs, _job_summerSausageCheeseLbs, _job_slicedJerkyLbs;
    /* ---------------- UI ---------------- */ return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jsx-e6e67a5efb395662" + " " + "form-card",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-e6e67a5efb395662" + " " + "screen-only",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "jsx-e6e67a5efb395662",
                        children: "Deer Intake"
                    }, void 0, false, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 346,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-e6e67a5efb395662" + " " + "summary",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "row",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Tag Number"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 352,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                ref: tagRef,
                                                value: job.tag || '',
                                                onChange: (e)=>setVal('tag', e.target.value),
                                                placeholder: "e.g. 1234",
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 353,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12
                                                },
                                                className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                children: "Deer Tag"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 359,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 351,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col price",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Processing Price"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 363,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "money",
                                                children: processingPrice.toFixed(2)
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 364,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12
                                                },
                                                className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                children: "Proc. type + beef fat + Webbs fee"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 365,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 362,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col price",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Specialty Price"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 369,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "money",
                                                children: specialtyPrice.toFixed(2)
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 370,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                style: {
                                                    fontSize: 12
                                                },
                                                className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                children: "Sausage/Jerky lbs"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 371,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 368,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 350,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "row small",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col total",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Total (preview)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 377,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "money total",
                                                children: totalPrice.toFixed(2)
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 378,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 376,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Status"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 382,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: coerce(job.status, STATUS_MAIN),
                                                onChange: (e)=>setVal('status', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: STATUS_MAIN.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: s,
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: s
                                                    }, s, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 387,
                                                        columnNumber: 39
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 383,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 381,
                                        columnNumber: 13
                                    }, this),
                                    job.processType === 'Caped' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Caping Status"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 393,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: coerce(job.capingStatus, STATUS_CAPE),
                                                onChange: (e)=>setVal('capingStatus', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: STATUS_CAPE.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: s,
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: s
                                                    }, s, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 398,
                                                        columnNumber: 41
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 394,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 392,
                                        columnNumber: 15
                                    }, this),
                                    job.webbsOrder && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Webbs Status"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 405,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: coerce(job.webbsStatus, STATUS_WEBBS),
                                                onChange: (e)=>setVal('webbsStatus', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: STATUS_WEBBS.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: s,
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: s
                                                    }, s, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 410,
                                                        columnNumber: 42
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 406,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 404,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "col",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Paid"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 416,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "pillrow",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "pill ".concat(job.paidProcessing ? 'on' : ''),
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!job.paidProcessing,
                                                                onChange: (e)=>{
                                                                    const v = e.target.checked;
                                                                    setJob((prev)=>({
                                                                            ...prev,
                                                                            Paid: v,
                                                                            paid: v,
                                                                            paidProcessing: v ? true : prev.paidProcessing,
                                                                            paidSpecialty: hasSpecialty ? v ? true : prev.paidSpecialty : false
                                                                        }));
                                                                },
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 419,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662" + " " + "badge",
                                                                children: job.paidProcessing ? 'Processing Paid' : 'Processing Unpaid'
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 433,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 418,
                                                        columnNumber: 17
                                                    }, this),
                                                    hasSpecialty && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "pill ".concat(job.paidSpecialty ? 'on' : ''),
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!job.paidSpecialty,
                                                                onChange: (e)=>{
                                                                    const v = e.target.checked;
                                                                    setJob((prev)=>({
                                                                            ...prev,
                                                                            paidSpecialty: v,
                                                                            Paid: v && !!prev.paidProcessing,
                                                                            paid: v && !!prev.paidProcessing
                                                                        }));
                                                                },
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 438,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662" + " " + "badge",
                                                                children: job.paidSpecialty ? 'Specialty Paid' : 'Specialty Unpaid'
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 451,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 437,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "pill ".concat(!!job.paidProcessing && !!job.paidSpecialty || !!job.Paid ? 'on' : ''),
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: hasSpecialty ? asBool(job.Paid) || asBool(job.paidProcessing) && asBool(job.paidSpecialty) : asBool(job.Paid) || asBool(job.paidProcessing),
                                                                onChange: (e)=>{
                                                                    const v = e.target.checked;
                                                                    setJob((prev)=>({
                                                                            ...prev,
                                                                            Paid: v,
                                                                            paid: v,
                                                                            paidProcessing: v ? true : prev.paidProcessing,
                                                                            paidSpecialty: v ? true : prev.paidSpecialty
                                                                        }));
                                                                },
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 456,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662" + " " + "badge",
                                                                children: !!job.paidProcessing && !!job.paidSpecialty || !!job.Paid ? 'Paid in Full' : 'Unpaid'
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 470,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 455,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 417,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 415,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 375,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 349,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Customer"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 479,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Confirmation #"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 482,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.confirmation || '',
                                                onChange: (e)=>setVal('confirmation', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 483,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 481,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Customer Name"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 489,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.customer || '',
                                                onChange: (e)=>setVal('customer', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 490,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 488,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Phone"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 496,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.phone || '',
                                                onChange: (e)=>setVal('phone', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 497,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 495,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Email"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 504,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.email || '',
                                                onChange: (e)=>setVal('email', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 505,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 503,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c8",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Address"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 511,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.address || '',
                                                onChange: (e)=>setVal('address', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 512,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 510,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "City"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 518,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.city || '',
                                                onChange: (e)=>setVal('city', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 519,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 517,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "State"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 525,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.state || '',
                                                onChange: (e)=>setVal('state', e.target.value),
                                                placeholder: "IN / KY / …",
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 526,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 524,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Zip"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 533,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.zip || '',
                                                onChange: (e)=>setVal('zip', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 534,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 532,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 480,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 478,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Hunt Details"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 544,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "County Killed"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 547,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.county || '',
                                                onChange: (e)=>setVal('county', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 548,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 546,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Drop-off Date"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 554,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                type: "date",
                                                value: job.dropoff || '',
                                                onChange: (e)=>setVal('dropoff', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 555,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 553,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Deer Sex"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 562,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.sex || '',
                                                onChange: (e)=>setVal('sex', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 567,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "Buck",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Buck"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 568,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "Doe",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Doe"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 569,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 563,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 561,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Process Type"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 573,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.processType || '',
                                                onChange: (e)=>setVal('processType', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 580,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Standard Processing"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 581,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Caped"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 582,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Skull-Cap"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 583,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "European"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 584,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 574,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 572,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 545,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 543,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Cuts"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 592,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Hind Quarter"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 595,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "checks",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_hind1 = job.hind) === null || _job_hind1 === void 0 ? void 0 : _job_hind1['Hind - Steak']),
                                                                onChange: ()=>setHind('Hind - Steak'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 598,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Steak"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 603,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 597,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_hind2 = job.hind) === null || _job_hind2 === void 0 ? void 0 : _job_hind2['Hind - Roast']),
                                                                onChange: ()=>setHind('Hind - Roast'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 606,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Roast"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 611,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 605,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "count",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                                children: "Count"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 614,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                value: hindRoastOn ? job.hindRoastCount || '' : '',
                                                                onChange: (e)=>setVal('hindRoastCount', e.target.value),
                                                                disabled: !hindRoastOn,
                                                                inputMode: "numeric",
                                                                className: "jsx-e6e67a5efb395662" + " " + "countInp"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 615,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 613,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_hind3 = job.hind) === null || _job_hind3 === void 0 ? void 0 : _job_hind3['Hind - Grind']),
                                                                onChange: ()=>setHind('Hind - Grind'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 624,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Grind"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 629,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 623,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_hind4 = job.hind) === null || _job_hind4 === void 0 ? void 0 : _job_hind4['Hind - None']),
                                                                onChange: ()=>setHind('Hind - None'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 632,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "None"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 637,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 631,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 596,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 594,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Front Shoulder"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 643,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-e6e67a5efb395662" + " " + "checks",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_front1 = job.front) === null || _job_front1 === void 0 ? void 0 : _job_front1['Front - Steak']),
                                                                onChange: ()=>setFront('Front - Steak'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 646,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Steak"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 651,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 645,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_front2 = job.front) === null || _job_front2 === void 0 ? void 0 : _job_front2['Front - Roast']),
                                                                onChange: ()=>setFront('Front - Roast'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 654,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Roast"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 659,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 653,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "count",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                                children: "Count"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 662,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                value: frontRoastOn ? job.frontRoastCount || '' : '',
                                                                onChange: (e)=>setVal('frontRoastCount', e.target.value),
                                                                disabled: !frontRoastOn,
                                                                inputMode: "numeric",
                                                                className: "jsx-e6e67a5efb395662" + " " + "countInp"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 663,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 661,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_front3 = job.front) === null || _job_front3 === void 0 ? void 0 : _job_front3['Front - Grind']),
                                                                onChange: ()=>setFront('Front - Grind'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 672,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "Grind"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 677,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 671,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "jsx-e6e67a5efb395662" + " " + "chk",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                type: "checkbox",
                                                                checked: !!((_job_front4 = job.front) === null || _job_front4 === void 0 ? void 0 : _job_front4['Front - None']),
                                                                onChange: ()=>setFront('Front - None'),
                                                                className: "jsx-e6e67a5efb395662"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 680,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jsx-e6e67a5efb395662",
                                                                children: "None"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/intake/page.tsx",
                                                                lineNumber: 685,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 679,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 644,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 642,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 593,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 591,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Packaging & Add-ons"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 694,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Steak Size"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 697,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.steak || '',
                                                onChange: (e)=>setVal('steak', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 702,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: '1/2"'
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 703,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: '3/4"'
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 704,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Other"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 705,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 698,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 696,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Steaks per Package"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 709,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.steaksPerPackage || '',
                                                onChange: (e)=>setVal('steaksPerPackage', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 714,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 715,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "6"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 716,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "8"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 717,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 710,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 708,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Burger Size"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 721,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.burgerSize || '',
                                                onChange: (e)=>setVal('burgerSize', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 726,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "1 lb"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 727,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "2 lb"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 728,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 722,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 720,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3 rowInline",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "jsx-e6e67a5efb395662" + " " + "chk tight",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: !!job.beefFat,
                                                    onChange: (e)=>setVal('beefFat', e.target.checked),
                                                    className: "jsx-e6e67a5efb395662"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 733,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-e6e67a5efb395662",
                                                    children: "Beef fat"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 738,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                    children: " (+$5)"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 739,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 732,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 731,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Steak Size (Other)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 744,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: needsSteakOther ? job.steakOther || '' : '',
                                                onChange: (e)=>setVal('steakOther', e.target.value),
                                                disabled: !needsSteakOther,
                                                placeholder: 'e.g., 5/8"',
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 745,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 743,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 695,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 693,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Backstrap"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 757,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Prep"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 760,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: job.backstrapPrep || '',
                                                onChange: (e)=>setVal('backstrapPrep', e.target.value),
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 767,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Whole"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 768,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Sliced"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 769,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Butterflied"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 770,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 761,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 759,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Thickness"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 774,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                value: isWholeBackstrap ? '' : job.backstrapThickness || '',
                                                onChange: (e)=>setVal('backstrapThickness', e.target.value),
                                                disabled: isWholeBackstrap,
                                                className: "jsx-e6e67a5efb395662",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        value: "",
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 782,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: '1/2"'
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 783,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: '3/4"'
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 784,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Other"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 785,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 775,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 773,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Thickness (Other)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 789,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: needsBackstrapOther ? job.backstrapThicknessOther || '' : '',
                                                onChange: (e)=>setVal('backstrapThicknessOther', e.target.value),
                                                disabled: !needsBackstrapOther,
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 790,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 788,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 758,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 756,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "McAfee Specialty Products"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 801,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3 rowInline",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "jsx-e6e67a5efb395662" + " " + "chk tight",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: !!job.specialtyProducts,
                                                    onChange: (e)=>setVal('specialtyProducts', e.target.checked),
                                                    className: "jsx-e6e67a5efb395662"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 805,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-e6e67a5efb395662",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Would like specialty products"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 810,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 810,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 804,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 803,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Summer Sausage (lb)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 814,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                inputMode: "numeric",
                                                value: job.specialtyProducts ? String((_job_summerSausageLbs = job.summerSausageLbs) !== null && _job_summerSausageLbs !== void 0 ? _job_summerSausageLbs : '') : '',
                                                onChange: (e)=>setVal('summerSausageLbs', e.target.value),
                                                disabled: !job.specialtyProducts,
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 815,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 813,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Summer Sausage + Cheese (lb)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 823,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                inputMode: "numeric",
                                                value: job.specialtyProducts ? String((_job_summerSausageCheeseLbs = job.summerSausageCheeseLbs) !== null && _job_summerSausageCheeseLbs !== void 0 ? _job_summerSausageCheeseLbs : '') : '',
                                                onChange: (e)=>setVal('summerSausageCheeseLbs', e.target.value),
                                                disabled: !job.specialtyProducts,
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 824,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 822,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Sliced Jerky (lb)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 832,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                inputMode: "numeric",
                                                value: job.specialtyProducts ? String((_job_slicedJerkyLbs = job.slicedJerkyLbs) !== null && _job_slicedJerkyLbs !== void 0 ? _job_slicedJerkyLbs : '') : '',
                                                onChange: (e)=>setVal('slicedJerkyLbs', e.target.value),
                                                disabled: !job.specialtyProducts,
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 833,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 831,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 802,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 800,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Notes"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 845,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                rows: 3,
                                value: job.notes || '',
                                onChange: (e)=>setVal('notes', e.target.value),
                                className: "jsx-e6e67a5efb395662"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 846,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 844,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "jsx-e6e67a5efb395662",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "jsx-e6e67a5efb395662",
                                children: "Webbs"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 855,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "grid",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3 rowInline",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "jsx-e6e67a5efb395662" + " " + "chk tight",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: !!job.webbsOrder,
                                                    onChange: (e)=>setVal('webbsOrder', e.target.checked),
                                                    className: "jsx-e6e67a5efb395662"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 859,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-e6e67a5efb395662",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                        className: "jsx-e6e67a5efb395662",
                                                        children: "Webbs Order"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/intake/page.tsx",
                                                        lineNumber: 864,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 864,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-e6e67a5efb395662" + " " + "muted",
                                                    children: " (+$20 fee)"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/intake/page.tsx",
                                                    lineNumber: 865,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/intake/page.tsx",
                                            lineNumber: 858,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 857,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Webbs Order Form Number"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 869,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                value: job.webbsFormNumber || '',
                                                onChange: (e)=>setVal('webbsFormNumber', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 870,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 868,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-e6e67a5efb395662" + " " + "c3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "jsx-e6e67a5efb395662",
                                                children: "Webbs Pounds (lb)"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 876,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                inputMode: "numeric",
                                                value: job.webbsPounds || '',
                                                onChange: (e)=>setVal('webbsPounds', e.target.value),
                                                className: "jsx-e6e67a5efb395662"
                                            }, void 0, false, {
                                                fileName: "[project]/app/intake/page.tsx",
                                                lineNumber: 877,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/intake/page.tsx",
                                        lineNumber: 875,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 856,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 854,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-e6e67a5efb395662" + " " + "actions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "jsx-e6e67a5efb395662" + " " + "status ".concat(msg.startsWith('Save') ? 'ok' : msg ? 'err' : ''),
                                children: msg
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 888,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>window.print(),
                                disabled: busy,
                                className: "jsx-e6e67a5efb395662" + " " + "btn",
                                children: "Print"
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 890,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: onSave,
                                disabled: busy,
                                className: "jsx-e6e67a5efb395662" + " " + "btn",
                                children: busy ? 'Saving…' : 'Save'
                            }, void 0, false, {
                                fileName: "[project]/app/intake/page.tsx",
                                lineNumber: 899,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/intake/page.tsx",
                        lineNumber: 887,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/intake/page.tsx",
                lineNumber: 345,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-e6e67a5efb395662" + " " + "print-only",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$PrintSheet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    job: job
                }, void 0, false, {
                    fileName: "[project]/app/intake/page.tsx",
                    lineNumber: 907,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/intake/page.tsx",
                lineNumber: 906,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "e6e67a5efb395662",
                children: ".wrap.jsx-e6e67a5efb395662{max-width:980px;margin:16px auto 60px;padding:12px;font-family:Arial,sans-serif}h2.jsx-e6e67a5efb395662{margin:8px 0}h3.jsx-e6e67a5efb395662{margin:16px 0 8px}label.jsx-e6e67a5efb395662{color:#0b0f12;margin-bottom:4px;font-size:12px;font-weight:700;display:block}input.jsx-e6e67a5efb395662,select.jsx-e6e67a5efb395662,textarea.jsx-e6e67a5efb395662{box-sizing:border-box;background:#fbfdff;border:1px solid #d8e3f5;border-radius:8px;width:100%;padding:6px 8px}textarea.jsx-e6e67a5efb395662{resize:vertical}.grid.jsx-e6e67a5efb395662{grid-template-columns:repeat(12,1fr);gap:8px;display:grid}.c3.jsx-e6e67a5efb395662{grid-column:span 3}.c4.jsx-e6e67a5efb395662{grid-column:span 4}.c6.jsx-e6e67a5efb395662{grid-column:span 6}.c8.jsx-e6e67a5efb395662{grid-column:span 8}.rowInline.jsx-e6e67a5efb395662{align-items:center;gap:8px;padding-top:22px;display:flex}.checks.jsx-e6e67a5efb395662{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.chk.jsx-e6e67a5efb395662{align-items:center;gap:6px;display:inline-flex}.muted.jsx-e6e67a5efb395662{color:#6b7280;font-size:12px}.summary.jsx-e6e67a5efb395662{z-index:5;background:#f5f8ff;border:1px solid #d8e3f5;border-radius:10px;margin-bottom:10px;padding:8px;position:-webkit-sticky;position:sticky;top:0;box-shadow:0 2px 10px rgba(0,0,0,.06)}.summary.jsx-e6e67a5efb395662 .row.jsx-e6e67a5efb395662{grid-template-columns:repeat(3,1fr);align-items:end;gap:8px;display:grid}.summary.jsx-e6e67a5efb395662 .row.small.jsx-e6e67a5efb395662{grid-template-columns:repeat(4,1fr);margin-top:6px}.summary.jsx-e6e67a5efb395662 .col.jsx-e6e67a5efb395662{flex-direction:column;gap:4px;display:flex}.summary.jsx-e6e67a5efb395662 .price.jsx-e6e67a5efb395662 .money.jsx-e6e67a5efb395662{text-align:right;background:#fff;border:1px solid #d8e3f5;border-radius:8px;padding:6px 8px;font-weight:800}.summary.jsx-e6e67a5efb395662 .total.jsx-e6e67a5efb395662 .money.total.jsx-e6e67a5efb395662{font-weight:900}.pillrow.jsx-e6e67a5efb395662{flex-wrap:nowrap;align-items:center;gap:10px;display:flex}.pill.jsx-e6e67a5efb395662{white-space:nowrap;background:#fff7db;border:2px solid #eab308;border-radius:999px;align-items:center;gap:8px;padding:6px 10px;display:inline-flex}.pill.on.jsx-e6e67a5efb395662{background:#ecfdf5;border-color:#10b981}.badge.jsx-e6e67a5efb395662{border:1px solid;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800}.count.jsx-e6e67a5efb395662{align-items:center;gap:6px;display:inline-flex}.countInp.jsx-e6e67a5efb395662{text-align:center;width:70px}.actions.jsx-e6e67a5efb395662{background:#fff;border-top:1px solid #eef2f7;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;padding:10px 0;display:flex;position:-webkit-sticky;position:sticky;bottom:0}.btn.jsx-e6e67a5efb395662{color:#fff;cursor:pointer;background:#155acb;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-weight:800}.btn.jsx-e6e67a5efb395662:disabled{opacity:.6;cursor:not-allowed}.status.jsx-e6e67a5efb395662{color:#334155;min-height:20px;margin-right:auto;font-size:12px}.status.ok.jsx-e6e67a5efb395662{color:#065f46}.status.err.jsx-e6e67a5efb395662{color:#b91c1c}.print-only.jsx-e6e67a5efb395662{display:none}@media print{.screen-only.jsx-e6e67a5efb395662{display:none!important}.print-only.jsx-e6e67a5efb395662{display:block!important}}@media (max-width:900px){.summary.jsx-e6e67a5efb395662 .row.small.jsx-e6e67a5efb395662{grid-template-columns:1fr 1fr}}@media (max-width:720px){.grid.jsx-e6e67a5efb395662,.summary.jsx-e6e67a5efb395662 .row.jsx-e6e67a5efb395662,.summary.jsx-e6e67a5efb395662 .row.small.jsx-e6e67a5efb395662{grid-template-columns:1fr}.rowInline.jsx-e6e67a5efb395662{padding-top:0}.pillrow.jsx-e6e67a5efb395662{flex-wrap:wrap}}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/intake/page.tsx",
        lineNumber: 343,
        columnNumber: 5
    }, this);
}
_s(IntakePage, "qP6ujeOFe/Kx4NbKMvbkN7YmFlE=", false, function() {
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
]);

//# sourceMappingURL=_0ab9dd80._.js.map