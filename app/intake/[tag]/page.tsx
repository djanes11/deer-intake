// app/intake/[tag]/page.tsx
import 'server-only';
export const runtime = 'nodejs';       // Node so 'crypto' works
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import PrintSheet from '@/app/components/PrintSheet';
import crypto from 'crypto';

export async function generateMetadata() {
  return { robots: { index: false, follow: false, nocache: true } };
}

// ---- Config/env ----
const RAW_GAS_BASE =
  (process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = process.env.GAS_TOKEN || process.env.EMAIL_SIGNING_SECRET || '';

// ---- Helpers ----
function assertValidGasBase() {
  if (!RAW_GAS_BASE) {
    throw new Error(
      'NEXT_PUBLIC_GAS_BASE is not set. Set it to your Google Apps Script /exec URL in Vercel env.'
    );
  }
  try {
    // throws if RAW_GAS_BASE is not a full http(s) URL
    new URL(RAW_GAS_BASE);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_GAS_BASE is invalid: "${RAW_GAS_BASE}". Expect https://script.google.com/macros/s/.../exec`
    );
  }
}

function hmac16(tag: string) {
  if (!GAS_TOKEN) return '';
  return crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0, 16);
}
function verifyToken(tag: string, token?: string | null) {
  if (!GAS_TOKEN) return true; // if no secret configured, allow
  return token === hmac16(tag);
}

async function getJob(tag: string) {
  assertValidGasBase();
  const url = new URL(RAW_GAS_BASE);
  url.searchParams.set('action', 'get');
  url.searchParams.set('tag', tag);
  if (process.env.GAS_TOKEN) url.searchParams.set('token', process.env.GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`GAS get failed: HTTP ${r.status}`);
  const data = await r.json();
  if (!data?.job) throw new Error('Form not found for that tag.');
  return data.job;
}

// Next 15: params/searchParams are Promises
type SP = Record<string, string | string[] | undefined>;

export default async function IntakeView({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams?: Promise<SP>;
}) {
  try {
    const { tag } = await params;
    const sp = (await (searchParams ?? Promise.resolve({}))) as SP;

    const tagDec = decodeURIComponent(tag);
    const t = typeof sp.t === 'string' ? sp.t : Array.isArray(sp.t) ? sp.t[0] : undefined;

    if (!verifyToken(tagDec, t)) {
      return (
        <div className="mx-auto max-w-xl p-6">
          <h1 className="text-lg font-bold mb-2">Access denied</h1>
          <p>Invalid or missing token.</p>
        </div>
      );
    }

    const job = await getJob(tagDec);

    return (
      <div className="mx-auto max-w-3xl p-4">
        <PrintSheet job={job} hideHeader />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-bold mb-2">Unable to load form</h1>
        <p style={{ whiteSpace: 'pre-wrap', color: '#6b7280' }}>
          {String(err?.message || err)}
        </p>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
          Tip: ensure <code>NEXT_PUBLIC_GAS_BASE</code> is your Apps Script <code>/exec</code> URL.
        </div>
      </div>
    );
  }
}
