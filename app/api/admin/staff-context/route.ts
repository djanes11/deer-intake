import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffIdentity, getStaffProcessorContext, isPlatformAdmin, listStaffMemberships } from '@/lib/staffContext';

export async function GET(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const [identity, processor, memberships, platformAdmin] = await Promise.all([
      getStaffIdentity(req),
      getStaffProcessorContext(req),
      listStaffMemberships(req),
      isPlatformAdmin(req),
    ]);

    return NextResponse.json({
      ok: true,
      identity,
      processor,
      memberships,
      platformAdmin,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
