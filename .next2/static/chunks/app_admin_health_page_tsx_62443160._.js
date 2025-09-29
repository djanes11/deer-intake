(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/admin/health/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AdminHealth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
const BASE = '/api/gas2'; // <-- the only thing that matters here
function AdminHealth() {
    _s();
    const [log, setLog] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    async function run(label, fn) {
        setLog((p)=>p + "\n=== ".concat(label, " ==="));
        try {
            const res = await fn();
            const hdr = res.headers.get('X-Route'); // we set this in the new routes
            const data = await res.json().catch(()=>({}));
            setLog((p)=>p + "\nURL: ".concat(res.url, "\nStatus: ").concat(res.status, "\nX-Route: ").concat(hdr !== null && hdr !== void 0 ? hdr : '(none)', "\n") + JSON.stringify(data, null, 2) + '\n');
        } catch (e) {
            setLog((p)=>p + "\nERROR: ".concat((e === null || e === void 0 ? void 0 : e.message) || String(e), "\n"));
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        style: {
            maxWidth: 900,
            margin: '16px auto',
            fontFamily: 'system-ui',
            lineHeight: 1.3
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Admin Health"
            }, void 0, false, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    margin: '12px 0'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>run('POST /progress', ()=>fetch("".concat(BASE, "/progress"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        tag: '1'
                                    })
                                })),
                        children: "Test Progress"
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>run('POST /save', ()=>fetch("".concat(BASE, "/save"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        job: {
                                            tag: '1',
                                            status: 'Dropped Off'
                                        }
                                    })
                                })),
                        children: "Test Save"
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 41,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>run('GET /get', ()=>fetch("".concat(BASE, "/get?tag=1"), {
                                    cache: 'no-store'
                                })),
                        children: "Test Get"
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 49,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>run('GET /search', ()=>fetch("".concat(BASE, "/search?q=1"), {
                                    cache: 'no-store'
                                })),
                        children: "Test Search"
                    }, void 0, false, {
                        fileName: "[project]/app/admin/health/page.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                style: {
                    whiteSpace: 'pre-wrap',
                    background: '#0b1220',
                    color: '#dbeafe',
                    padding: 12,
                    borderRadius: 8,
                    minHeight: 240
                },
                children: log || 'Click a test above…'
            }, void 0, false, {
                fileName: "[project]/app/admin/health/page.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/admin/health/page.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_s(AdminHealth, "WIMAQKvJIt6kDeRF/br9VqV5Rcc=");
_c = AdminHealth;
var _c;
__turbopack_context__.k.register(_c, "AdminHealth");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_admin_health_page_tsx_62443160._.js.map