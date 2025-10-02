module.exports = [
"[project]/.next-internal/server/app/api/gas2/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/gas2/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// app/api/gas2/route.ts
__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const GAS_BASE = ("TURBOPACK compile-time value", "https://script.google.com/macros/s/AKfycbz0KOKVaQ85Nt_DWN-Jbt5YytD0nkH_EOK6sp34u-ypEj2_r0sd4lG67TJreAYgxIGBTQ/exec") || process.env.GAS_BASE || '';
function bad(msg, status = 400) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        ok: false,
        error: msg
    }, {
        status
    });
}
function ok(data, status = 200) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data, {
        status
    });
}
function toURL(base, params) {
    const u = new URL(base);
    for (const [k, v] of Object.entries(params)){
        if (v != null && v !== '') u.searchParams.set(k, String(v));
    }
    return u.toString();
}
async function GET(req) {
    try {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        const { searchParams } = new URL(req.url);
        const action = (searchParams.get('action') || '').trim().toLowerCase();
        if (![
            'ping',
            'get',
            'search'
        ].includes(action)) {
            return bad('Unsupported GET action. Use action=ping|get|search.');
        }
        const tag = searchParams.get('tag') || '';
        const q = searchParams.get('q') || '';
        const token = searchParams.get('token') || process.env.NEXT_PUBLIC_GAS_TOKEN || process.env.GAS_TOKEN || '';
        const gasUrl = toURL(GAS_BASE, {
            action,
            tag,
            q,
            token
        });
        const res = await fetch(gasUrl, {
            method: 'GET',
            cache: 'no-store'
        });
        let data = null;
        try {
            data = await res.json();
        } catch  {}
        if (!res.ok) return bad(data?.error || `GAS HTTP ${res.status}`, res.status);
        return ok(data, 200);
    } catch (e) {
        return bad(e?.message || 'Proxy GET failed', 500);
    }
}
async function POST(req) {
    try {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        let body = {};
        try {
            body = await req.json();
        } catch  {
            return bad('Invalid JSON body', 400);
        }
        const action = String(body?.action || '').toLowerCase();
        const allowed = new Set([
            'save',
            'progress',
            'log-call',
            'markcalled',
            'get',
            'search'
        ]);
        if (!allowed.has(action)) return bad(`Unsupported POST action "${action}".`, 400);
        const token = body?.token || process.env.NEXT_PUBLIC_GAS_TOKEN || process.env.GAS_TOKEN || '';
        const forwardBody = token ? {
            ...body,
            token
        } : body;
        const gasRes = await fetch(GAS_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(forwardBody),
            cache: 'no-store'
        });
        let data = null;
        try {
            data = await gasRes.json();
        } catch  {}
        if (!gasRes.ok) return bad(data?.error || `GAS HTTP ${gasRes.status}`, gasRes.status);
        return ok(data, 200);
    } catch (e) {
        return bad(e?.message || 'Proxy POST failed', 500);
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e0ce6ba2._.js.map