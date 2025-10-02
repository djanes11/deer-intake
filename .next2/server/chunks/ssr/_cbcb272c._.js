module.exports = [
"[project]/lib/useScanner.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useScanner",
    ()=>useScanner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useScanner(onScan, opts) {
    const buf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])('');
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const resetMs = opts?.resetMs ?? 150;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onKey = (e)=>{
            if (e.key === 'Enter') {
                const code = buf.current.trim();
                buf.current = '';
                if (code) onScan(code);
                return;
            }
            if (e.key.length === 1) {
                buf.current += e.key;
                if (t.current) clearTimeout(t.current);
                t.current = setTimeout(()=>buf.current = '', resetMs);
            }
        };
        window.addEventListener('keydown', onKey);
        return ()=>window.removeEventListener('keydown', onKey);
    }, [
        onScan,
        resetMs
    ]);
}
}),
"[project]/lib/api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
async function fetchJson(url, init, attempts = 3, timeoutMs = 7000) {
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
            lastErr = data?.error || `HTTP ${res.status}`;
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
            lastErr = e?.name === 'AbortError' ? 'Request timed out' : e?.message || e;
            await new Promise((r)=>setTimeout(r, 250 * (i + 1)));
        }
    }
    return {
        ok: false,
        error: String(lastErr || 'Network error')
    };
}
async function getJob(tag) {
    return fetchJson(`${BASE}/get?tag=${encodeURIComponent(tag)}`);
}
async function saveJob(job) {
    return fetchJson(`${BASE}/save`, {
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
    return fetchJson(`${BASE}/progress`, {
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
    const data = await fetchJson(`${BASE}/search?${p.toString()}`);
    const rows = Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const ok = !!data?.ok || Array.isArray(rows);
    const total = typeof data?.total === 'number' ? data.total : rows.length;
    return {
        ok,
        rows,
        total,
        error: data?.error,
        jobs: rows,
        results: rows,
        raw: data
    };
}
}),
"[project]/app/scan/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ScanKiosk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/useScanner.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
function useBeep() {
    // Tiny WebAudio beeps: success & error
    const ctxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const getCtx = ()=>ctxRef.current ??= new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq = 880, durMs = 120, type = 'sine', gain = 0.04)=>{
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
function ScanKiosk() {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const [last, setLast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        kind: 'idle',
        text: ''
    });
    const guardRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        lastAt: 0,
        lastTag: ''
    });
    const beeps = useBeep();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useScanner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useScanner"])(async (rawTag)=>{
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
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["progress"])(tag);
            if (!res?.ok) throw new Error(res?.error || 'Could not progress');
            if (res.nextStatus === 'Processing') {
                setStatus({
                    kind: 'ok',
                    text: 'Processing — opening butcher view…'
                });
                beeps.ok();
                router.push(`/butcher/intake?tag=${encodeURIComponent(tag)}`);
            } else if (res.nextStatus === 'Finished') {
                setStatus({
                    kind: 'ok',
                    text: 'Marked Finished ✓'
                });
                beeps.ok();
                // Keep kiosk ready for the next scan
                setTimeout(()=>setStatus({
                        kind: 'idle',
                        text: ''
                    }), 1000);
            } else {
                setStatus({
                    kind: 'err',
                    text: 'No status change'
                });
                beeps.err();
                setTimeout(()=>setStatus({
                        kind: 'idle',
                        text: ''
                    }), 1000);
            }
        } catch (e) {
            setStatus({
                kind: 'err',
                text: e?.message || 'Scan failed'
            });
            beeps.err();
        }
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "scan-page",
        style: {
            textAlign: 'center'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                style: {
                    margin: '4px 0 8px'
                },
                children: "Scan a Tag"
            }, void 0, false, {
                fileName: "[project]/app/scan/page.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
}),
];

//# sourceMappingURL=_cbcb272c._.js.map