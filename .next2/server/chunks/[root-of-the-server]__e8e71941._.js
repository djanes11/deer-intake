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
"[project]/app/api/gas2/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// app/api/gas2/route.ts
// Simple pass-through proxy to your Apps Script Web App.
// - Supports GET/POST
// - Adds optional API token automatically
// - 60s upstream timeout with good error messages
__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
const runtime = 'nodejs'; // ensure Node runtime (not edge)
const dynamic = 'force-dynamic';
const GAS_BASE = ("TURBOPACK compile-time value", "https://script.google.com/macros/s/AKfycbzqqEH8s3QPQPENiLQLLvIHRl2MNl5KEZXKSI8F7AwbGGeJGFl-ODypSsPIrePclEmb2g/exec")?.trim() || process.env.GAS_BASE?.trim();
const GAS_TOKEN = process.env.NEXT_PUBLIC_GAS_TOKEN?.trim() || process.env.GAS_TOKEN?.trim() || ''; // leave blank if not using tokens
function buildUpstreamURL(req, extraQS = {}) {
    if (!GAS_BASE) throw new Error('Missing GAS_BASE/NEXT_PUBLIC_GAS_BASE');
    const url = new URL(GAS_BASE);
    // pass existing query
    const inQ = new URL(req.url).searchParams;
    inQ.forEach((v, k)=>url.searchParams.set(k, v));
    // apply extra params
    Object.entries(extraQS).forEach(([k, v])=>url.searchParams.set(k, v));
    if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
    return url.toString();
}
function withTimeout(ms) {
    const ctrl = new AbortController();
    const id = setTimeout(()=>ctrl.abort(), ms);
    return {
        signal: ctrl.signal,
        cancel: ()=>clearTimeout(id)
    };
}
async function passthrough(req, init) {
    const { signal, cancel } = withTimeout(60000); // 60s
    try {
        const upstreamURL = buildUpstreamURL(req);
        const res = await fetch(upstreamURL, {
            ...init,
            signal,
            // never send browser cookies upstream; Apps Script doesn’t need them
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'no-store',
            redirect: 'follow'
        });
        const text = await res.text().catch(()=>'');
        // Try JSON first; if not JSON, pass back text
        try {
            const json = text ? JSON.parse(text) : {};
            return new Response(JSON.stringify(json), {
                status: res.status,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch  {
            // Not JSON from Apps Script — return as text for visibility
            return new Response(text || `Upstream HTTP ${res.status}`, {
                status: res.status,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }
    } catch (err) {
        if (err?.name === 'AbortError') {
            return new Response('Upstream timeout', {
                status: 504
            });
        }
        return new Response(err?.message || 'Proxy error', {
            status: 502
        });
    } finally{
        cancel();
    }
}
async function GET(req) {
    return passthrough(req);
}
async function POST(req) {
    // We POST to GAS with JSON body and the same query string.
    // GAS Web App prefers action in body, which your frontend already sends.
    const body = await req.text().catch(()=>'');
    const { signal, cancel } = withTimeout(60000);
    try {
        const upstreamURL = buildUpstreamURL(req);
        const res = await fetch(upstreamURL, {
            method: 'POST',
            body,
            signal,
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });
        const text = await res.text().catch(()=>'');
        try {
            const json = text ? JSON.parse(text) : {};
            return new Response(JSON.stringify(json), {
                status: res.status,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch  {
            return new Response(text || `Upstream HTTP ${res.status}`, {
                status: res.status,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }
    } catch (err) {
        if (err?.name === 'AbortError') {
            return new Response('Upstream timeout', {
                status: 504
            });
        }
        return new Response(err?.message || 'Proxy error', {
            status: 502
        });
    } finally{
        cancel();
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e8e71941._.js.map