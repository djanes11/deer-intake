import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { markIntakeSheetUnprinted } from '@/lib/jobsSupabase';

export async function POST(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();

    if (!tag) {
      return NextResponse.json({ ok: false, error: 'tag is required' }, { status: 400 });
    }

    const result = await markIntakeSheetUnprinted({ tag });
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
