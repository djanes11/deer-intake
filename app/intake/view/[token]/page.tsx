import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import ReadOnlyAccessHelp from '@/app/intake/ReadOnlyAccessHelp';
import { getJobByPublicToken } from '@/lib/jobsSupabase';

function cleanPublicToken(token: string | undefined) {
  return String(token || '')
    .trim()
    .replace(/[)"'\]>.,;:!?]+$/g, '');
}

export default async function TokenIntakeView({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { token: rawToken } = await params;
    const token = cleanPublicToken(decodeURIComponent(rawToken || ''));
    const result = await getJobByPublicToken(token);
    const tag = String(result.job?.tag || '').trim();

    if (result.exists && tag && token) {
      redirect(`/intake/${encodeURIComponent(tag)}?t=${encodeURIComponent(token)}`);
    }

    return (
      <ReadOnlyAccessHelp reason="This intake link is missing its secure access code or no longer matches an active intake form." />
    );
  } catch (err: any) {
    if (String(err?.digest || '').startsWith('NEXT_REDIRECT')) throw err;
    return (
      <ReadOnlyAccessHelp reason="We could not open this intake link. It may need to be resent from the processor." />
    );
  }
}
