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
            const res = await fetch(url, {
                cache: 'no-store',
                ...init,
                signal: ctrl.signal
            });
            clearTimeout(to);
            const data = await res.json().catch(()=>({}));
            if (res.ok) return data;
            lastErr = (data === null || data === void 0 ? void 0 : data.error) || "HTTP ".concat(res.status);
            // retry on transient
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
    if (o.status) p.set('status', o.status);
    if (o.limit != null) p.set('limit', String(o.limit));
    if (o.offset != null) p.set('offset', String(o.offset));
    return fetchJson("".concat(BASE, "/search?").concat(p.toString()));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/admin/health/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HealthPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function HealthPage() {
    _s();
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [env, setEnv] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "HealthPage.useEffect": ()=>{
            setEnv({
                NEXT_PUBLIC_GAS_BASE: ("TURBOPACK compile-time value", "https://script.google.com/macros/s/AKfycby67R67plsLptTt15jw2srfX2EbhqmZ-lnJNiHB9_AlTtdeXR8C49OAjB7KMRW64l-csQ/exec"),
                GAS_BASE: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.GAS_BASE
            });
            ({
                "HealthPage.useEffect": async ()=>{
                    const out = [];
                    // Search ping
                    try {
                        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["searchJobs"])('1');
                        out.push({
                            label: 'GET /search',
                            ok: !!r.ok,
                            msg: r.ok ? 'ok' : 'fail'
                        });
                    } catch (e) {
                        out.push({
                            label: 'GET /search',
                            ok: false,
                            msg: e === null || e === void 0 ? void 0 : e.message
                        });
                    }
                    // Get
                    try {
                        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getJob"])('1');
                        out.push({
                            label: 'GET /get?tag=1',
                            ok: !!r.ok,
                            msg: r.ok ? r.exists ? 'exists' : 'not found' : r.error || 'fail'
                        });
                    } catch (e) {
                        out.push({
                            label: 'GET /get',
                            ok: false,
                            msg: e === null || e === void 0 ? void 0 : e.message
                        });
                    }
                    // Save (safe dummy)
                    try {
                        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveJob"])({
                            tag: 'HEALTH-CHECK',
                            status: 'Dropped Off',
                            dropoff: '2025-01-01',
                            customer: 'Health',
                            phone: '0000000',
                            email: 'x@x',
                            address: '-',
                            city: '-',
                            state: '-',
                            zip: '-',
                            county: '-',
                            sex: 'Doe',
                            processType: 'Standard Processing'
                        });
                        out.push({
                            label: 'POST /save',
                            ok: !!r.ok,
                            msg: r.ok ? 'ok' : r.error || 'fail'
                        });
                    } catch (e) {
                        out.push({
                            label: 'POST /save',
                            ok: false,
                            msg: e === null || e === void 0 ? void 0 : e.message
                        });
                    }
                    // Progress (harmless if tag missing)
                    try {
                        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["progress"])('HEALTH-CHECK');
                        out.push({
                            label: 'POST /progress',
                            ok: !!r.ok,
                            msg: r.ok ? r.nextStatus || 'ok' : r.error || 'fail'
                        });
                    } catch (e) {
                        out.push({
                            label: 'POST /progress',
                            ok: false,
                            msg: e === null || e === void 0 ? void 0 : e.message
                        });
                    }
                    setRows(out);
                }
            })["HealthPage.useEffect"]();
        }
    }["HealthPage.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "page-wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: "Admin Health"
            }, void 0, false, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "card",
                style: {
                    margin: '8px 0'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "muted",
                        style: {
                            marginBottom: 8
                        },
                        children: "Env"
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "NEXT_PUBLIC_GAS_BASE:"
                            }, void 0, false, {
                                fileName: "[project]/app/admin/health/page.tsx",
                                lineNumber: 52,
                                columnNumber: 14
                            }, this),
                            " ",
                            env.NEXT_PUBLIC_GAS_BASE || /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("em", {
                                children: "(unset)"
                            }, void 0, false, {
                                fileName: "[project]/app/admin/health/page.tsx",
                                lineNumber: 52,
                                columnNumber: 82
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "GAS_BASE:"
                            }, void 0, false, {
                                fileName: "[project]/app/admin/health/page.tsx",
                                lineNumber: 53,
                                columnNumber: 14
                            }, this),
                            " ",
                            env.GAS_BASE || /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("em", {
                                children: "(unset)"
                            }, void 0, false, {
                                fileName: "[project]/app/admin/health/page.tsx",
                                lineNumber: 53,
                                columnNumber: 58
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                className: "tbl",
                style: {
                    marginTop: 12
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Check"
                                }, void 0, false, {
                                    fileName: "[project]/app/admin/health/page.tsx",
                                    lineNumber: 57,
                                    columnNumber: 20
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                    children: "Status"
                                }, void 0, false, {
                                    fileName: "[project]/app/admin/health/page.tsx",
                                    lineNumber: 57,
                                    columnNumber: 34
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/admin/health/page.tsx",
                            lineNumber: 57,
                            columnNumber: 16
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                        children: rows.map((r, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        children: r.label
                                    }, void 0, false, {
                                        fileName: "[project]/app/admin/health/page.tsx",
                                        lineNumber: 61,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        style: {
                                            color: r.ok ? '#065f46' : '#b91c1c',
                                            fontWeight: 700
                                        },
                                        children: [
                                            r.ok ? 'OK' : 'FAIL',
                                            " ",
                                            r.msg ? "— ".concat(r.msg) : ''
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/admin/health/page.tsx",
                                        lineNumber: 62,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, i, true, {
                                fileName: "[project]/app/admin/health/page.tsx",
                                lineNumber: 60,
                                columnNumber: 11
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 56,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/admin/health/page.tsx",
        lineNumber: 48,
        columnNumber: 5
    }, this);
}
_s(HealthPage, "ky2Ri/rh9PvlqtVaRtn9Gq4pKpo=");
_c = HealthPage;
var _c;
__turbopack_context__.k.register(_c, "HealthPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_10e76e8b._.js.map