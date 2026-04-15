import { NextResponse } from 'next/server';
import { createLocalStaffSession } from '@/lib/localStaffAuth';
import { STAFF_ACCESS_COOKIE, STAFF_LOCAL_SESSION_COOKIE } from '@/lib/staffSession';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await createLocalStaffSession({
      username: body?.username,
      password: body?.password,
    });
    const res = NextResponse.json({ ok: true, session: result.session });
    res.cookies.set(STAFF_LOCAL_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    res.cookies.delete(STAFF_ACCESS_COOKIE);
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
