import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { resendCustomerNotification } from '@/lib/jobsSupabase';

export async function POST(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();
    const event = String(body?.event || '').trim();

    if (!tag || !event) {
      return NextResponse.json({ ok: false, error: 'tag and event are required' }, { status: 400 });
    }

    const result = await resendCustomerNotification({
      tag,
      event: event as any,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
