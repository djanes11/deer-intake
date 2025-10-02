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
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function useBeep() {
    var _ctxRef;
    _s();
    // Tiny WebAudio beeps: success & error
    const ctxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const getCtx = ()=>{
        var _current;
        return (_current = (_ctxRef = ctxRef).current) !== null && _current !== void 0 ? _current : _ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    };
    const play = function() {
        let freq = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 880, durMs = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 120, type = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 'sine', gain = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0.04;
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.value = gain;
        osc.connect(g);
        g.connect(ctx.destination);
        const t = ctx.currentTime;
        osc.start(t);
        osc.stop(t + durMs / 1000);
    };
    return {
        ok: ()=>{
            play(1046, 90, 'triangle', 0.05);
            setTimeout(()=>play(1318, 110, 'triangle', 0.05), 60);
        },
        err: ()=>{
            play(220, 140, 'sawtooth', 0.06);
            setTimeout(()=>play(196, 160, 'sawtooth', 0.06), 70);
        }
    };
}
_s(useBeep, "KF/xFKm3ypwgr2A8Vn9bhkjY264=");
function ScanKiosk() {
    _s1();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [last, setLast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        kind: 'idle',
        text: ''
    });
    const guardRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        lastAt: 0,
        lastTag: ''
    });
    const beeps = useBeep();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useScanner"])({
        "ScanKiosk.useScanner": async (rawTag)=>{
            const tag = String(rawTag || '').trim();
            const now = Date.now();
            // Debounce: ignore events within 250ms; also ignore immediate duplicate within 1000ms
            if (now - guardRef.current.lastAt < 250) return;
            if (tag === guardRef.current.lastTag && now - guardRef.current.lastAt < 1000) return;
            guardRef.current = {
                lastAt: now,
                lastTag: tag
            };
            setLast(tag);
            setStatus({
                kind: 'idle',
                text: ''
            });
            try {
                const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["progress"])(tag);
                if (!(res === null || res === void 0 ? void 0 : res.ok)) throw new Error((res === null || res === void 0 ? void 0 : res.error) || 'Could not progress');
                if (res.nextStatus === 'Processing') {
                    setStatus({
                        kind: 'ok',
                        text: 'Processing — opening butcher view…'
                    });
                    beeps.ok();
                    router.push("/butcher/intake?tag=".concat(encodeURIComponent(tag)));
                } else if (res.nextStatus === 'Finished') {
                    setStatus({
                        kind: 'ok',
                        text: 'Marked Finished ✓'
                    });
                    beeps.ok();
                    // Keep kiosk ready for the next scan
                    setTimeout({
                        "ScanKiosk.useScanner": ()=>setStatus({
                                kind: 'idle',
                                text: ''
                            })
                    }["ScanKiosk.useScanner"], 1000);
                } else {
                    setStatus({
                        kind: 'err',
                        text: 'No status change'
                    });
                    beeps.err();
                    setTimeout({
                        "ScanKiosk.useScanner": ()=>setStatus({
                                kind: 'idle',
                                text: ''
                            })
                    }["ScanKiosk.useScanner"], 1000);
                }
            } catch (e) {
                setStatus({
                    kind: 'err',
                    text: (e === null || e === void 0 ? void 0 : e.message) || 'Scan failed'
                });
                beeps.err();
            }
        }
    }["ScanKiosk.useScanner"]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "scan-page",
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
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                style: {
                    color: 'var(--muted)',
                    margin: '0 0 16px'
                },
                children: "Scan once to start Processing; scan again to mark Finished."
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 75,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    fontSize: 56,
                    fontWeight: 900,
                    letterSpacing: 1,
                    margin: '14px 0'
                },
                children: last || '—'
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-live": "polite",
                style: {
                    minHeight: 52,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    margin: '10px auto 0',
                    maxWidth: 680,
                    padding: '10px 12px',
                    background: status.kind === 'ok' ? '#ecfdf5' : status.kind === 'err' ? '#fef2f2' : 'rgba(255,255,255,0.9)',
                    color: status.kind === 'ok' ? '#065f46' : status.kind === 'err' ? '#991b1b' : 'var(--muted)'
                },
                children: status.text || 'Ready for next scan'
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/scan/page.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s1(ScanKiosk, "9lAU5VVY/2mbhl+so2Z7qIumxs0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        useBeep,
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
]);

//# sourceMappingURL=_93c1e4d2._.js.map