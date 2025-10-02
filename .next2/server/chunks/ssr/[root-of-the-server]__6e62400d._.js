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
const GAS_BASE = process.env.GAS_BASE || ("TURBOPACK compile-time value", "https://script.google.com/macros/s/AKfycbyN1T69fwIhHWQu7r37hBB_g7UawoTMbAbY1a-K7-7-iJYjb8rmfaFWCMEBOnpWM0Eodw/exec") || '';
const GAS_TOKEN = process.env.GAS_TOKEN || process.env.NEXT_PUBLIC_GAS_TOKEN || ''; // optional
const TIMEOUT_MS = 15000;
function withQuery(url, qs) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(qs)){
        if (v !== undefined && v !== null && String(v) !== '') {
            u.searchParams.set(k, String(v));
        }
    }
    return u.toString();
}
async function forward(method, url, body) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const ac = new AbortController();
    const t = setTimeout(()=>ac.abort(), TIMEOUT_MS);
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        // If GAS_TOKEN is set, ensure GAS gets it the way your script expects:
        //  - For GET: as ?token=...
        //  - For POST: inside JSON body as { token: "..." }
        const gasUrl = new URL(url);
        if (GAS_TOKEN && !gasUrl.searchParams.get('token')) {
            gasUrl.searchParams.set('token', GAS_TOKEN);
        }
        const postBody = method === 'POST' ? JSON.stringify({
            ...body ?? {},
            ...GAS_TOKEN ? {
                token: GAS_TOKEN
            } : {}
        }) : undefined;
        const res = await fetch(gasUrl.toString(), {
            method,
            headers,
            body: postBody,
            signal: ac.signal,
            cache: 'no-store',
            next: {
                revalidate: 0
            }
        });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            const text = await res.text();
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: false,
                error: 'Non-JSON from GAS',
                body: text
            }, {
                status: 502
            });
        }
        const json = await res.json();
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"].json(json, {
            status: res.status
        });
    } catch (err) {
        const msg = err?.name === 'AbortError' ? 'Timeout contacting GAS' : err?.message || 'Fetch error';
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: msg
        }, {
            status: 504
        });
    } finally{
        clearTimeout(t);
    }
}
async function GET(req) {
    const urlObj = new URL(req.url);
    const action = urlObj.searchParams.get('action') || urlObj.searchParams.get('endpoint') || '';
    const tag = urlObj.searchParams.get('tag') || '';
    const q = urlObj.searchParams.get('q') || '';
    const url = withQuery(GAS_BASE, {
        action: action || (q ? 'search' : tag ? 'get' : 'ping'),
        tag: tag || undefined,
        q: q || undefined
    });
    return forward('GET', url);
}
async function POST(req) {
    const body = await req.json().catch(()=>({}));
    const action = body?.action || body?.endpoint || (body?.job ? 'save' : body?.tag && body?.reason ? 'log-call' : body?.tag ? 'progress' : 'ping');
    const url = withQuery(GAS_BASE, {
        action
    });
    return forward('POST', url, body);
}
}),
"[project]/app/search/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SearchPage
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
function SearchPage() {
    const [q, setQ] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [err, setErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    // keep it simple: require 2+ chars before searching
    const debouncedQ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>q.trim(), [
        q
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const t = setTimeout(async ()=>{
            setErr('');
            if (debouncedQ.length < 2) {
                setRows([]);
                return;
            }
            try {
                setLoading(true);
                // explicit object call matches our helper -> /api/gas/search
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["searchJobs"])({
                    q: debouncedQ,
                    limit: 50,
                    offset: 0
                });
                if (!res?.ok) {
                    setErr(res?.error || 'Search failed');
                    setRows([]);
                } else {
                    setRows(res.rows || []);
                }
            } catch (e) {
                setErr(e?.message || 'Search failed');
                setRows([]);
            } finally{
                setLoading(false);
            }
        }, 250);
        return ()=>clearTimeout(t);
    }, [
        debouncedQ
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jsx-6e46efb6ec80b301" + " " + "wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "jsx-6e46efb6ec80b301",
                children: "Search"
            }, void 0, false, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 56,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-6e46efb6ec80b301" + " " + "bar",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: q,
                        onChange: (e)=>setQ(e.target.value),
                        placeholder: "Search by tag, name, or phone…",
                        "aria-label": "Search",
                        className: "jsx-6e46efb6ec80b301"
                    }, void 0, false, {
                        fileName: "[project]/app/search/page.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-6e46efb6ec80b301" + " " + "hint",
                        children: "Type at least 2 characters"
                    }, void 0, false, {
                        fileName: "[project]/app/search/page.tsx",
                        lineNumber: 65,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            err && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-6e46efb6ec80b301" + " " + "err",
                children: err
            }, void 0, false, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 68,
                columnNumber: 15
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-6e46efb6ec80b301" + " " + "muted",
                children: "Searching…"
            }, void 0, false, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 69,
                columnNumber: 19
            }, this),
            !loading && !err && debouncedQ && rows.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-6e46efb6ec80b301" + " " + "muted",
                children: "No matches."
            }, void 0, false, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 71,
                columnNumber: 9
            }, this),
            rows.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                className: "jsx-6e46efb6ec80b301" + " " + "tbl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                        className: "jsx-6e46efb6ec80b301",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            className: "jsx-6e46efb6ec80b301",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Tag"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 78,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Customer"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 79,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Phone"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 80,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Status"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 81,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Drop-off"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 82,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    className: "jsx-6e46efb6ec80b301",
                                    children: "Open"
                                }, void 0, false, {
                                    fileName: "[project]/app/search/page.tsx",
                                    lineNumber: 83,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/search/page.tsx",
                            lineNumber: 77,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/search/page.tsx",
                        lineNumber: 76,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                        className: "jsx-6e46efb6ec80b301",
                        children: rows.map((r, i)=>{
                            const tag = r.tag;
                            const customer = r.customer || r.name || '—';
                            // open the butcher-friendly intake by default
                            const href = `/intake?tag=${encodeURIComponent(r.tag)}`;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                className: "jsx-6e46efb6ec80b301",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: tag
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 94,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: customer
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 95,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: r.phone || ''
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 96,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: r.status || ''
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 97,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: r.dropoff || ''
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 98,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        className: "jsx-6e46efb6ec80b301",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            href: href,
                                            children: "Open"
                                        }, void 0, false, {
                                            fileName: "[project]/app/search/page.tsx",
                                            lineNumber: 99,
                                            columnNumber: 23
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/search/page.tsx",
                                        lineNumber: 99,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, `${tag}-${r.row ?? i}`, true, {
                                fileName: "[project]/app/search/page.tsx",
                                lineNumber: 93,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/app/search/page.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/search/page.tsx",
                lineNumber: 75,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                id: "6e46efb6ec80b301",
                children: ".wrap.jsx-6e46efb6ec80b301{max-width:900px;margin:16px auto;padding:12px;font-family:Arial,sans-serif}h2.jsx-6e46efb6ec80b301{margin:0 0 8px}.bar.jsx-6e46efb6ec80b301{grid-template-columns:1fr auto;align-items:end;gap:8px;margin-bottom:10px;display:grid}input.jsx-6e46efb6ec80b301{border:1px solid #d8e3f5;border-radius:8px;width:100%;padding:8px 10px}.hint.jsx-6e46efb6ec80b301{color:#6b7280;font-size:12px}.muted.jsx-6e46efb6ec80b301{color:#6b7280;margin-top:8px;font-size:14px}.err.jsx-6e46efb6ec80b301{color:#b91c1c;margin-top:8px}.tbl.jsx-6e46efb6ec80b301{border-collapse:collapse;width:100%;margin-top:12px}th.jsx-6e46efb6ec80b301,td.jsx-6e46efb6ec80b301{text-align:left;vertical-align:middle;border:1px solid #e5e7eb;padding:6px 8px}thead.jsx-6e46efb6ec80b301 th.jsx-6e46efb6ec80b301{background:#f3f4f6}tbody.jsx-6e46efb6ec80b301 tr.jsx-6e46efb6ec80b301:hover{background:#fafafa}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/search/page.tsx",
        lineNumber: 55,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__6e62400d._.js.map