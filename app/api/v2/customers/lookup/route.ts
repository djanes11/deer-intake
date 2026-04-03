import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { lookupCustomerByName } from '@/lib/jobsSupabase';

export async function GET(req: NextRequest) {
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';
    if (!name.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    }
    const result = await lookupCustomerByName(name);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
