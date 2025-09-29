(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/useScanner.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useScanner",
    ()=>useScanner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useScanner(onScan, opts) {
    _s();
    const buf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])('');
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    var _opts_resetMs;
    const resetMs = (_opts_resetMs = opts === null || opts === void 0 ? void 0 : opts.resetMs) !== null && _opts_resetMs !== void 0 ? _opts_resetMs : 150;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useScanner.useEffect": ()=>{
            const onKey = {
                "useScanner.useEffect.onKey": (e)=>{
                    if (e.key === 'Enter') {
                        const code = buf.current.trim();
                        buf.current = '';
                        if (code) onScan(code);
                        return;
                    }
                    if (e.key.length === 1) {
                        buf.current += e.key;
                        if (t.current) clearTimeout(t.current);
                        t.current = setTimeout({
                            "useScanner.useEffect.onKey": ()=>buf.current = ''
                        }["useScanner.useEffect.onKey"], resetMs);
                    }
                }
            }["useScanner.useEffect.onKey"];
            window.addEventListener('keydown', onKey);
            return ({
                "useScanner.useEffect": ()=>window.removeEventListener('keydown', onKey)
            })["useScanner.useEffect"];
        }
    }["useScanner.useEffect"], [
        onScan,
        resetMs
    ]);
}
_s(useScanner, "ctxLuRLJJDyr2OpZ9Ibb58NCBv0=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
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
"[project]/app/scan/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ScanKiosk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/useScanner.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/components/Toast.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function ScanKiosk() {
    _s();
    const sp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const kiosk = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ScanKiosk.useMemo[kiosk]": ()=>sp.get('kiosk') === '1'
    }["ScanKiosk.useMemo[kiosk]"], [
        sp
    ]);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { toast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [last, setLast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    // Enter/exit kiosk styles + fullscreen
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ScanKiosk.useEffect": ()=>{
            if (!kiosk) return;
            document.body.classList.add('kiosk');
            ({
                "ScanKiosk.useEffect": async ()=>{
                    try {
                        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                    } catch (e) {}
                    // @ts-ignore
                    try {
                        var _navigator_wakeLock;
                        if ((_navigator_wakeLock = navigator.wakeLock) === null || _navigator_wakeLock === void 0 ? void 0 : _navigator_wakeLock.request) {
                            await navigator.wakeLock.request('screen');
                        }
                    } catch (e) {}
                }
            })["ScanKiosk.useEffect"]();
            return ({
                "ScanKiosk.useEffect": ()=>document.body.classList.remove('kiosk')
            })["ScanKiosk.useEffect"];
        }
    }["ScanKiosk.useEffect"], [
        kiosk
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useScanner"])({
        "ScanKiosk.useScanner": async (tag)=>{
            setLast(tag);
            setStatus('');
            try {
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["progress"])(tag);
                if (!(res === null || res === void 0 ? void 0 : res.ok)) throw new Error((res === null || res === void 0 ? void 0 : res.error) || 'Could not progress');
                if (res.nextStatus === 'Processing') {
                    toast("Tag ".concat(tag, " → Processing"), 'ok');
                    router.push("/butcher/intake?tag=".concat(encodeURIComponent(tag)));
                } else if (res.nextStatus === 'Finished') {
                    toast("Tag ".concat(tag, " → Finished"), 'ok');
                    setStatus('Marked Finished ✓');
                    setTimeout({
                        "ScanKiosk.useScanner": ()=>setStatus('')
                    }["ScanKiosk.useScanner"], 1200);
                } else {
                    setStatus('No change');
                }
            } catch (e) {
                setStatus((e === null || e === void 0 ? void 0 : e.message) || 'Scan failed');
                toast('Scan failed', 'err');
            }
        }
    }["ScanKiosk.useScanner"]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "page-wrap",
        style: {
            textAlign: 'center'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                style: {
                    margin: '4px 0 8px'
                },
                children: "Scan a Tag"
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                style: {
                    margin: '0 0 16px'
                },
                children: kiosk ? 'Kiosk mode: TV-ready, opens the butcher view automatically.' : 'This screen will open the butcher view automatically.'
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 54,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: kiosk ? 64 : 48,
                    fontWeight: 900,
                    letterSpacing: 1,
                    margin: '12px 0'
                },
                children: last || '—'
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    height: 20,
                    fontWeight: 700,
                    color: status.includes('✓') ? '#065f46' : '#b91c1c'
                },
                children: status
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/scan/page.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
_s(ScanKiosk, "WfXdERfrFpaVRnnmLnS3VJhtqiY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$components$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useScanner"]
    ];
});
_c = ScanKiosk;
var _c;
__turbopack_context__.k.register(_c, "ScanKiosk");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/navigation.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=_94fbef2b._.js.map