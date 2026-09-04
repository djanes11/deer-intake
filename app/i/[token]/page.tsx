import 'server-only';

import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanPublicToken(token: string | undefined) {
  return String(token || '')
    .trim()
    .replace(/[)"'\]>.,;:!?]+$/g, '');
}

export default async function ShortIntakeLink({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = cleanPublicToken(decodeURIComponent(rawToken || ''));
  redirect(token ? `/intake/view/${encodeURIComponent(token)}` : '/status');
}
