// app/intake/[tag]/page.tsx
import 'server-only';
import PrintSheet from '@/app/components/PrintSheet';
import crypto from 'crypto';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE!;
const GAS_TOKEN = process.env.GAS_TOKEN || process.env.EMAIL_SIGNING_SECRET || '';

function verifyToken(tag: string, t?: string | null) {
  if (!GAS_TOKEN) return true; // if you didn’t set a secret, allow (no auth)
  if (!t) return false;
  const expect = crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0, 16);
  return t === expect;
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

export default async function IntakeView({
  params,
  searchParams,
}: {
  params: { tag: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tag = decodeURIComponent(params.tag);
  const t = (searchParams?.t as string) || null;

  if (!verifyToken(tag, t)) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-bold mb-2">Access denied</h1>
        <p>Invalid or missing token.</p>
      </div>
    );
  }

  const job = await getJob(tag);
  return (
    <div className="mx-auto max-w-3xl p-4">
      <PrintSheet job={job} hideHeader />
    </div>
  );
}