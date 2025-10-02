// app/api/gas2/route.ts
// Simple pass-through proxy to your Apps Script Web App.
// - Supports GET/POST
// - Adds optional API token automatically
// - 60s upstream timeout with good error messages

export const runtime = 'nodejs'; // ensure Node runtime (not edge)
export const dynamic = 'force-dynamic';

const GAS_BASE =
  process.env.NEXT_PUBLIC_GAS_BASE?.trim() ||
  process.env.GAS_BASE?.trim();

const GAS_TOKEN =
  process.env.GAS_TOKEN?.trim() ||
  ''; // leave blank if not using tokens

function buildUpstreamURL(req: Request, extraQS: Record<string, string> = {}) {
  if (!GAS_BASE) throw new Error('Missing GAS_BASE/NEXT_PUBLIC_GAS_BASE');
  const url = new URL(GAS_BASE);
  // pass existing query
  const inQ = new URL(req.url).searchParams;
  inQ.forEach((v, k) => url.searchParams.set(k, v));
  // apply extra params
  Object.entries(extraQS).forEach(([k, v]) => url.searchParams.set(k, v));
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  return url.toString();
}

function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

async function passthrough(req: Request, init?: RequestInit) {
  const { signal, cancel } = withTimeout(60000); // 60s
  try {
    const upstreamURL = buildUpstreamURL(req);
    const res = await fetch(upstreamURL, {
      ...init,
      signal,
      // never send browser cookies upstream; Apps Script doesn’t need them
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    const text = await res.text().catch(() => '');
    // Try JSON first; if not JSON, pass back text
    try {
      const json = text ? JSON.parse(text) : {};
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Not JSON from Apps Script — return as text for visibility
      return new Response(text || `Upstream HTTP ${res.status}`, {
        status: res.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new Response('Upstream timeout', { status: 504 });
    }
    return new Response(err?.message || 'Proxy error', { status: 502 });
  } finally {
    cancel();
  }
}

export async function GET(req: Request) {
  return passthrough(req);
}

export async function POST(req: Request) {
  // We POST to GAS with JSON body and the same query string.
  // GAS Web App prefers action in body, which your frontend already sends.
  const body = await req.text().catch(() => '');
  const { signal, cancel } = withTimeout(60000);
  try {
    const upstreamURL = buildUpstreamURL(req);
    const res = await fetch(upstreamURL, {
      method: 'POST',
      body,
      signal,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    try {
      const json = text ? JSON.parse(text) : {};
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(text || `Upstream HTTP ${res.status}`, {
        status: res.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return new Response('Upstream timeout', { status: 504 });
    }
    return new Response(err?.message || 'Proxy error', { status: 502 });
  } finally {
    cancel();
  }
}
