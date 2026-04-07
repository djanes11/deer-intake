import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSmsHealth } from '@/lib/sms';
import { requireProcessorPermission } from '@/lib/staffPermissions';

export async function GET(req: Request) {
  try {
    const { denied } = await requireProcessorPermission(req, 'manage_settings');
    if (denied) return denied;
    const health = await getSmsHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
