module.exports = [
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// app/api/gas2/route.ts
__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-ssr] (ecmascript)");
;
function baseUrl() {
    const b = ("TURBOPACK compile-time value", "https://script.google.com/macros/s/AKfycbwj4EMKrKtEJmkqCv-wk-ctzcDmkoyp1Ocsg8wFx4kNMTWLTib3LOrEb0shrEB27l6N-A/exec") || process.env.GAS_BASE;
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return b.replace(/\/+$/, '');
}
function withTokenURL(url, token) {
    if (!token) return url;
    const u = new URL(url);
    if (!u.searchParams.get('token')) u.searchParams.set('token', token);
    return u.toString();
}
async function passThrough(req) {
    const GAS = baseUrl();
    const token = process.env.GAS_TOKEN?.trim() || '';
    if (req.method === 'GET') {
        // forward all query params
        const out = withTokenURL(`${GAS}?${req.nextUrl.searchParams.toString()}`, token);
        const res = await fetch(out, {
            method: 'GET',
            cache: 'no-store'
        });
        const txt = await res.text();
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"](txt, {
            status: res.status,
            headers: {
                'content-type': res.headers.get('content-type') || 'application/json'
            }
        });
    }
    if (req.method === 'POST') {
        // forward JSON body and ensure token is present
        let body = {};
        try {
            body = await req.json();
        } catch  {}
        if (token && !body.token) body.token = token;
        const res = await fetch(GAS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'no-store',
            body: JSON.stringify(body)
        });
        const txt = await res.text();
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"](txt, {
            status: res.status,
            headers: {
                'content-type': res.headers.get('content-type') || 'application/json'
            }
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: 'Method not allowed'
    }, {
        status: 405
    });
}
async function GET(req) {
    return passThrough(req);
}
async function POST(req) {
    return passThrough(req);
}
}),
"[project]/app/reports/calls/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CallReportPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
/* --- helpers for display-only price preview --- */ function normProc(s) {
    const v = String(s || '').toLowerCase();
    if (v.includes('cape') && !v.includes('skull')) return 'Caped';
    if (v.includes('skull')) return 'Skull-Cap';
    if (v.includes('euro')) return 'European';
    if (v.includes('standard')) return 'Standard Processing';
    return '';
}
function suggestedProcessingPrice(proc, beef, webbs) {
    const p = normProc(proc);
    const base = p === 'Caped' ? 150 : [
        'Standard Processing',
        'Skull-Cap',
        'European'
    ].includes(p) ? 130 : 0;
    if (!base) return 0;
    return base + (beef ? 5 : 0) + (webbs ? 20 : 0);
}
const toInt = (val)=>{
    const n = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
function specialtyPriceFromRow(j) {
    if (!j.specialtyProducts) return 0;
    const ss = toInt(j.summerSausageLbs);
    const ssc = toInt(j.summerSausageCheeseLbs);
    const jer = toInt(j.slicedJerkyLbs);
    return ss * 4.25 + ssc * 4.60 + jer * 15.0;
}
function reasonForRow(j) {
    const st = String(j.status || '').toLowerCase();
    const cp = String(j.capingStatus || '').toLowerCase();
    const wb = String(j.webbsStatus || '').toLowerCase();
    if (st.includes('finished')) return 'Meat Ready';
    if (cp.includes('caped')) return 'Cape Ready';
    if (wb.includes('delivered')) return 'Webbs Ready';
    return '-';
}
/* --- pretty money --- */ function fmt(n) {
    const num = typeof n === 'number' ? n : Number(String(n ?? '').replace(/[^0-9.\-]/g, ''));
    if (!isFinite(num)) return '—';
    return num.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
    });
}
function CallReportPage() {
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [notes, setNotes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [err, setErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const load = async ()=>{
        setLoading(true);
        setErr(null);
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["searchJobs"])('@report'); // Finished / Caped / Delivered
            setRows((res.rows || []).map((r)=>({
                    ...r
                })));
        } catch (e) {
            setErr(e?.message || 'Failed to load report');
            setRows([]);
        } finally{
            setLoading(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        load();
    }, []);
    const paidText = (j)=>j.Paid || j.paid || j.paidProcessing && j.paidSpecialty ? 'Yes' : 'No';
    const displayPrice = (j)=>{
        const got = j.price ?? j.Price ?? undefined;
        if (got != null && String(got).trim() !== '') return fmt(got);
        const proc = suggestedProcessingPrice(j.processType, !!j.beefFat, !!j.webbsOrder);
        const spec = specialtyPriceFromRow(j);
        return fmt(proc + spec);
    };
    const setNote = (tag, v)=>setNotes((p)=>({
                ...p,
                [tag]: v
            }));
    const refreshOne = async (tag)=>{
        try {
            const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getJob"])(tag);
            if (r?.exists && r.job) {
                setRows((prev)=>prev.map((x)=>x.tag === tag ? {
                            ...x,
                            ...r.job
                        } : x));
            } else {
                // On Mark Called, row may drop from the "@report" filter
                setRows((prev)=>prev.filter((x)=>x.tag !== tag));
            }
        } catch  {}
    };
    const onMarkCalled = async (row)=>{
        const tag = row.tag;
        const note = (notes[tag] || '').trim();
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["markCalled"])({
                tag,
                scope: 'auto',
                notes: note
            });
            if (note) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logCallSimple"])({
                tag,
                reason: reasonForRow(row),
                notes: note
            });
            await refreshOne(tag);
            setNote(tag, '');
        } catch (e) {
            alert(e?.message || 'Failed to mark as called.');
        }
    };
    /** Optimistic +1 Attempt -> persist via GAS (log-call) -> refresh row */ const onPlusAttempt = async (row)=>{
        const tag = row.tag;
        const note = (notes[tag] || '').trim();
        // optimistic bump
        setRows((prev)=>prev.map((x)=>x.tag === tag ? {
                    ...x,
                    callAttempts: Number(x.callAttempts || 0) + 1,
                    callNotes: note ? x.callNotes ? `${x.callNotes}\n${note}` : note : x.callNotes
                } : x));
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logCallSimple"])({
                tag,
                reason: reasonForRow(row),
                notes: note
            });
            if (!res?.ok) throw new Error('Server declined.');
            await refreshOne(tag); // pull authoritative count + timestamped notes
            setNote(tag, '');
        } catch (e) {
            // revert on failure
            setRows((prev)=>prev.map((x)=>x.tag === tag ? {
                        ...x,
                        callAttempts: Math.max(0, Number(x.callAttempts || 1) - 1)
                    } : x));
            alert(e?.message || 'Failed to add attempt.');
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "jsx-85d5ecdb45ef1ca6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12
                },
                className: "jsx-85d5ecdb45ef1ca6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "jsx-85d5ecdb45ef1ca6",
                        children: "Call Report"
                    }, void 0, false, {
                        fileName: "[project]/app/reports/calls/page.tsx",
                        lineNumber: 159,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: load,
                        disabled: loading,
                        className: "jsx-85d5ecdb45ef1ca6" + " " + "btn",
                        children: loading ? 'Refreshing…' : 'Refresh'
                    }, void 0, false, {
                        fileName: "[project]/app/reports/calls/page.tsx",
                        lineNumber: 160,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "jsx-85d5ecdb45ef1ca6" + " " + "muted",
                        children: "Showing items that are ready to contact (Finished / Caped / Delivered)"
                    }, void 0, false, {
                        fileName: "[project]/app/reports/calls/page.tsx",
                        lineNumber: 163,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/reports/calls/page.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this),
            err && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    borderColor: '#ef4444',
                    marginTop: 12
                },
                className: "jsx-85d5ecdb45ef1ca6" + " " + "card",
                children: [
                    "Error: ",
                    err
                ]
            }, void 0, true, {
                fileName: "[project]/app/reports/calls/page.tsx",
                lineNumber: 167,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    padding: 0,
                    marginTop: 12,
                    overflow: 'hidden'
                },
                className: "jsx-85d5ecdb45ef1ca6" + " " + "card",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                    style: {
                        width: '100%',
                        margin: 0,
                        tableLayout: 'fixed'
                    },
                    className: "jsx-85d5ecdb45ef1ca6" + " " + "table",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                            className: "jsx-85d5ecdb45ef1ca6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                className: "jsx-85d5ecdb45ef1ca6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 110
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Tag"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 176,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Name"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 177,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 160
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Phone"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 178,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 140
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Reason"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 179,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 120
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Price"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 180,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 80
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Paid"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 181,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 120
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "# Contacts"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 182,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Contact Notes"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 183,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        style: {
                                            width: 240
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Actions"
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 184,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/reports/calls/page.tsx",
                                lineNumber: 175,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/reports/calls/page.tsx",
                            lineNumber: 174,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                            className: "jsx-85d5ecdb45ef1ca6",
                            children: [
                                (!rows || rows.length === 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    className: "jsx-85d5ecdb45ef1ca6",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        colSpan: 9,
                                        style: {
                                            padding: 14
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: "Nothing to call right now."
                                    }, void 0, false, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 190,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/reports/calls/page.tsx",
                                    lineNumber: 189,
                                    columnNumber: 15
                                }, this),
                                rows.map((r)=>{
                                    const reason = reasonForRow(r);
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        style: {
                                            background: 'transparent'
                                        },
                                        className: "jsx-85d5ecdb45ef1ca6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                    href: `/intake?tag=${encodeURIComponent(r.tag)}`,
                                                    title: "Open form",
                                                    children: r.tag
                                                }, void 0, false, {
                                                    fileName: "[project]/app/reports/calls/page.tsx",
                                                    lineNumber: 198,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 197,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: r.customer || '—'
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 200,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: r.phone || '—'
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 201,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: reason
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 202,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: displayPrice(r)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 203,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: paidText(r)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 204,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: Number(r.callAttempts || 0)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 205,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        display: 'grid',
                                                        gap: 8
                                                    },
                                                    className: "jsx-85d5ecdb45ef1ca6",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                            value: notes[r.tag] || '',
                                                            onChange: (e)=>setNote(r.tag, e.target.value),
                                                            placeholder: "Add a note (e.g., Will pickup Friday 4–6pm)…",
                                                            rows: 3,
                                                            style: {
                                                                width: '100%',
                                                                resize: 'vertical',
                                                                minHeight: 60,
                                                                background: '#fff',
                                                                color: '#0b0f12',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: 10,
                                                                padding: '8px 10px'
                                                            },
                                                            className: "jsx-85d5ecdb45ef1ca6"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/reports/calls/page.tsx",
                                                            lineNumber: 209,
                                                            columnNumber: 23
                                                        }, this),
                                                        r.callNotes ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            style: {
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-word',
                                                                border: '1px dashed var(--border, #e5e7eb)',
                                                                borderRadius: 10,
                                                                padding: 8,
                                                                maxHeight: 160,
                                                                overflow: 'auto',
                                                                background: 'var(--bg-elev, #f8fafc)'
                                                            },
                                                            className: "jsx-85d5ecdb45ef1ca6" + " " + "muted",
                                                            children: r.callNotes
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/reports/calls/page.tsx",
                                                            lineNumber: 227,
                                                            columnNumber: 25
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-85d5ecdb45ef1ca6" + " " + "muted",
                                                            children: "No prior notes"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/reports/calls/page.tsx",
                                                            lineNumber: 243,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/reports/calls/page.tsx",
                                                    lineNumber: 207,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 206,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "jsx-85d5ecdb45ef1ca6",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    style: {
                                                        display: 'flex',
                                                        gap: 8,
                                                        flexWrap: 'wrap'
                                                    },
                                                    className: "jsx-85d5ecdb45ef1ca6",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>onMarkCalled(r),
                                                            title: "Flip appropriate status (Meat/Cape/Webbs) to Called and log note",
                                                            className: "jsx-85d5ecdb45ef1ca6" + " " + "btn",
                                                            children: "Mark Called"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/reports/calls/page.tsx",
                                                            lineNumber: 249,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            type: "button",
                                                            onClick: ()=>onPlusAttempt(r),
                                                            title: "Just add an attempt (and note), no status change",
                                                            className: "jsx-85d5ecdb45ef1ca6" + " " + "btn secondary",
                                                            children: "+1 Attempt"
                                                        }, void 0, false, {
                                                            fileName: "[project]/app/reports/calls/page.tsx",
                                                            lineNumber: 257,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/app/reports/calls/page.tsx",
                                                    lineNumber: 248,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/reports/calls/page.tsx",
                                                lineNumber: 247,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, r.tag, true, {
                                        fileName: "[project]/app/reports/calls/page.tsx",
                                        lineNumber: 196,
                                        columnNumber: 17
                                    }, this);
                                })
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/reports/calls/page.tsx",
                            lineNumber: 187,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/reports/calls/page.tsx",
                    lineNumber: 173,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/reports/calls/page.tsx",
                lineNumber: 172,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                id: "85d5ecdb45ef1ca6",
                children: ".table.jsx-85d5ecdb45ef1ca6 tr.jsx-85d5ecdb45ef1ca6:hover td.jsx-85d5ecdb45ef1ca6{background:var(--bg-elev-2,#0000000f)}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/reports/calls/page.tsx",
        lineNumber: 157,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__34f38af9._.js.map