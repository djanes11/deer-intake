import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getSmsHealth } from '@/lib/sms';

export async function GET(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const health = await getSmsHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
