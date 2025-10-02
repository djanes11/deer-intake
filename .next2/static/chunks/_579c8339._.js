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
async function fetchJson(url, init) {
    let attempts = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 3, timeoutMs = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 7000;
    let lastErr = null;
    for(let i = 0; i < attempts; i++){
        const ctrl = new AbortController();
        const to = setTimeout(()=>ctrl.abort(), timeoutMs);
        try {
            var _this;
            const res = await fetch(url, {
                cache: 'no-store',
                ...init,
                signal: ctrl.signal
            });
            clearTimeout(to);
            const data = await res.json().catch(()=>({}));
            if (res.ok) return data;
            lastErr = ((_this = data) === null || _this === void 0 ? void 0 : _this.error) || "HTTP ".concat(res.status);
            if ([
                429,
                502,
                503,
                504
            ].includes(res.status)) {
                await new Promise((r)=>setTimeout(r, 250 * (i + 1)));
                continue;
            }
            break;
        } catch (e) {
            clearTimeout(to);
            lastErr = (e === null || e === void 0 ? void 0 : e.name) === 'AbortError' ? 'Request timed out' : (e === null || e === void 0 ? void 0 : e.message) || e;
            await new Promise((r)=>setTimeout(r, 250 * (i + 1)));
        }
    }
    return {
        ok: false,
        error: String(lastErr || 'Network error')
    };
}
async function getJob(tag) {
    return fetchJson("".concat(BASE, "/get?tag=").concat(encodeURIComponent(tag)));
}
async function saveJob(job) {
    return fetchJson("".concat(BASE, "/save"), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            job
        })
    });
}
async function progress(tag) {
    return fetchJson("".concat(BASE, "/progress"), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tag
        })
    });
}
async function searchJobs(opts) {
    const o = typeof opts === 'string' ? {
        q: opts
    } : opts || {};
    const p = new URLSearchParams();
    if (o.q) p.set('q', o.q);
    if (typeof o.status === 'string') p.set('status', o.status);
    if (o.limit != null) p.set('limit', String(o.limit));
    if (o && o.offset != null) p.set('offset', String(o.offset));
    const data = await fetchJson("".concat(BASE, "/search?").concat(p.toString()));
    const rows = Array.isArray(data === null || data === void 0 ? void 0 : data.jobs) ? data.jobs : Array.isArray(data === null || data === void 0 ? void 0 : data.rows) ? data.rows : Array.isArray(data === null || data === void 0 ? void 0 : data.results) ? data.results : Array.isArray(data) ? data : [];
    const ok = !!(data === null || data === void 0 ? void 0 : data.ok) || Array.isArray(rows);
    const total = typeof (data === null || data === void 0 ? void 0 : data.total) === 'number' ? data.total : rows.length;
    return {
        ok,
        rows,
        total,
        error: data === null || data === void 0 ? void 0 : data.error,
        jobs: rows,
        results: rows,
        raw: data
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/board/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ReadyBoard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const REFRESH_MS = 5000;
function ReadyBoard() {
    _s();
    const [processing, setProcessing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [finished, setFinished] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [err, setErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    // Poll GAS every few seconds
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ReadyBoard.useEffect": ()=>{
            let alive = true;
            const tick = {
                "ReadyBoard.useEffect.tick": async ()=>{
                    try {
                        setErr('');
                        const [p, f] = await Promise.all([
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["searchJobs"])({
                                status: 'Processing',
                                limit: 200
                            }),
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["searchJobs"])({
                                status: 'Finished',
                                limit: 200
                            })
                        ]);
                        if (!alive) return;
                        if (!(p === null || p === void 0 ? void 0 : p.ok) || !(f === null || f === void 0 ? void 0 : f.ok)) throw new Error((p === null || p === void 0 ? void 0 : p.error) || (f === null || f === void 0 ? void 0 : f.error) || 'Board fetch failed');
                        const proc = (p.rows || []).map({
                            "ReadyBoard.useEffect.tick.proc": (r)=>({
                                    ...r,
                                    customer: r.customer || r.name
                                })
                        }["ReadyBoard.useEffect.tick.proc"]);
                        const fin = (f.rows || []).map({
                            "ReadyBoard.useEffect.tick.fin": (r)=>({
                                    ...r,
                                    customer: r.customer || r.name
                                })
                        }["ReadyBoard.useEffect.tick.fin"]);
                        setProcessing(proc);
                        setFinished(fin);
                    } catch (e) {
                        if (alive) setErr((e === null || e === void 0 ? void 0 : e.message) || 'Board fetch failed');
                    } finally{
                        if (alive) setLoading(false);
                    }
                }
            }["ReadyBoard.useEffect.tick"];
            tick();
            const id = setInterval(tick, REFRESH_MS);
            return ({
                "ReadyBoard.useEffect": ()=>{
                    alive = false;
                    clearInterval(id);
                }
            })["ReadyBoard.useEffect"];
        }
    }["ReadyBoard.useEffect"], []);
    // Fancy fullscreen + wake lock for TVs
    const wakeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const goFullscreen = async ()=>{
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        } catch (e) {}
        try {
            var _navigator_wakeLock;
            // @ts-ignore
            if (!wakeRef.current && ((_navigator_wakeLock = navigator.wakeLock) === null || _navigator_wakeLock === void 0 ? void 0 : _navigator_wakeLock.request)) {
                // @ts-ignore
                wakeRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (e) {}
    };
    const Section = (param)=>{
        let { title, rows, color } = param;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            className: "card",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "head",
                    style: {
                        borderColor: color
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            style: {
                                color
                            },
                            children: title
                        }, void 0, false, {
                            fileName: "[project]/app/board/page.tsx",
                            lineNumber: 69,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "count",
                            style: {
                                color
                            },
                            children: rows.length
                        }, void 0, false, {
                            fileName: "[project]/app/board/page.tsx",
                            lineNumber: 70,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/board/page.tsx",
                    lineNumber: 68,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid",
                    children: [
                        rows.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "empty",
                            children: "—"
                        }, void 0, false, {
                            fileName: "[project]/app/board/page.tsx",
                            lineNumber: 73,
                            columnNumber: 31
                        }, this),
                        rows.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "item",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "tag",
                                        children: r.tag
                                    }, void 0, false, {
                                        fileName: "[project]/app/board/page.tsx",
                                        lineNumber: 76,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "name",
                                        children: r.customer || '—'
                                    }, void 0, false, {
                                        fileName: "[project]/app/board/page.tsx",
                                        lineNumber: 77,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "meta",
                                        children: r.dropoff || ''
                                    }, void 0, false, {
                                        fileName: "[project]/app/board/page.tsx",
                                        lineNumber: 78,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, "".concat(r.tag, "-").concat(r.row), true, {
                                fileName: "[project]/app/board/page.tsx",
                                lineNumber: 75,
                                columnNumber: 11
                            }, this))
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/board/page.tsx",
                    lineNumber: 72,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/board/page.tsx",
            lineNumber: 67,
            columnNumber: 5
        }, this);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "jsx-fc9d67f418ce7389" + " " + "board-wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-fc9d67f418ce7389" + " " + "topbar",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-fc9d67f418ce7389" + " " + "title",
                        children: "Butcher Board"
                    }, void 0, false, {
                        fileName: "[project]/app/board/page.tsx",
                        lineNumber: 88,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-fc9d67f418ce7389" + " " + "spacer"
                    }, void 0, false, {
                        fileName: "[project]/app/board/page.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: goFullscreen,
                        className: "jsx-fc9d67f418ce7389" + " " + "btn",
                        children: "Fullscreen"
                    }, void 0, false, {
                        fileName: "[project]/app/board/page.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/board/page.tsx",
                lineNumber: 87,
                columnNumber: 7
            }, this),
            err && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-fc9d67f418ce7389" + " " + "err",
                children: err
            }, void 0, false, {
                fileName: "[project]/app/board/page.tsx",
                lineNumber: 93,
                columnNumber: 15
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-fc9d67f418ce7389" + " " + "muted",
                children: "Loading…"
            }, void 0, false, {
                fileName: "[project]/app/board/page.tsx",
                lineNumber: 94,
                columnNumber: 19
            }, this),
            !loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jsx-fc9d67f418ce7389" + " " + "cols",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Section, {
                        title: "Now Processing",
                        rows: processing,
                        color: "#2563eb",
                        className: "jsx-fc9d67f418ce7389"
                    }, void 0, false, {
                        fileName: "[project]/app/board/page.tsx",
                        lineNumber: 98,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Section, {
                        title: "Finished & Ready",
                        rows: finished,
                        color: "#16a34a",
                        className: "jsx-fc9d67f418ce7389"
                    }, void 0, false, {
                        fileName: "[project]/app/board/page.tsx",
                        lineNumber: 99,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/board/page.tsx",
                lineNumber: 97,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "fc9d67f418ce7389",
                children: ".board-wrap.jsx-fc9d67f418ce7389{max-width:1400px;margin:10px auto;padding:10px;font-family:Arial,sans-serif}.topbar.jsx-fc9d67f418ce7389{align-items:center;gap:12px;margin-bottom:10px;display:flex}.title.jsx-fc9d67f418ce7389{letter-spacing:.5px;font-size:28px;font-weight:900}.spacer.jsx-fc9d67f418ce7389{flex:1}.btn.jsx-fc9d67f418ce7389{border:1px solid var(--border);color:#fff;background:#155acb;border-radius:8px;padding:8px 12px;font-weight:800}.cols.jsx-fc9d67f418ce7389{grid-template-columns:1fr 1fr;gap:12px;display:grid}.card.jsx-fc9d67f418ce7389{border:1px solid var(--border);background:#fff;border-radius:14px;padding:12px}.head.jsx-fc9d67f418ce7389{border-left:4px solid;align-items:center;gap:10px;margin-bottom:10px;padding-left:8px;display:flex}h2.jsx-fc9d67f418ce7389{margin:0;font-size:20px}.count.jsx-fc9d67f418ce7389{margin-left:auto;font-weight:900}.grid.jsx-fc9d67f418ce7389{grid-template-columns:repeat(3,1fr);gap:8px;display:grid}.item.jsx-fc9d67f418ce7389{background:#fbfdff;border:1px solid #e5e7eb;border-radius:10px;gap:4px;padding:10px;display:grid}.item.jsx-fc9d67f418ce7389 .tag.jsx-fc9d67f418ce7389{letter-spacing:.5px;font-size:22px;font-weight:900}.item.jsx-fc9d67f418ce7389 .name.jsx-fc9d67f418ce7389{white-space:nowrap;text-overflow:ellipsis;font-weight:700;overflow:hidden}.item.jsx-fc9d67f418ce7389 .meta.jsx-fc9d67f418ce7389{color:#6b7280;font-size:12px}.empty.jsx-fc9d67f418ce7389{color:#6b7280;font-size:14px}@media (max-width:1100px){.grid.jsx-fc9d67f418ce7389{grid-template-columns:repeat(2,1fr)}}@media (max-width:740px){.grid.jsx-fc9d67f418ce7389,.cols.jsx-fc9d67f418ce7389{grid-template-columns:1fr}}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/board/page.tsx",
        lineNumber: 86,
        columnNumber: 5
    }, this);
}
_s(ReadyBoard, "Xkwij08JVzh68kT0SknH9perGL8=");
_c = ReadyBoard;
var _c;
__turbopack_context__.k.register(_c, "ReadyBoard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_579c8339._.js.map