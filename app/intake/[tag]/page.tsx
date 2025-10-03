// app/intake/[tag]/page.tsx
import 'server-only';
export const runtime = 'nodejs';          // <-- force Node so 'crypto' works
export const dynamic = 'force-dynamic';

import PrintSheet from '@/app/components/PrintSheet';
import crypto from 'crypto';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE!;
const GAS_TOKEN = process.env.GAS_TOKEN || process.env.EMAIL_SIGNING_SECRET || '';

function hmac16(tag: string) {
  if (!GAS_TOKEN) return '';
  return crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0, 16);
}
function verifyToken(tag: string, token?: string | null) {
  if (!GAS_TOKEN) return true; // if no secret configured, allow
  return token === hmac16(tag);
}

async function getJob(tag: string) {
  const url = new URL(GAS_BASE);
  url.searchParams.set('action', 'get');
  url.searchParams.set('tag', tag);
  if (process.env.GAS_TOKEN) url.searchParams.set('token', process.env.GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`GAS get failed: ${r.status}`);
  const data = await r.json();
  if (!data?.job) throw new Error('Not found');
  return data.job;
}

// Next 15 props are Promises
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
    // Render a friendly error instead of crashing the route
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-bold mb-2">Unable to load form</h1>
        <p style={{whiteSpace: 'pre-wrap', color: '#6b7280'}}>
          {String(err?.message || err || 'Unknown error')}
        </p>
      </div>
    );
  }
}
