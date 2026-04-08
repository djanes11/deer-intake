import { NextResponse } from 'next/server';
import { createLocalStaffSession } from '@/lib/localStaffAuth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await createLocalStaffSession({
      username: body?.username,
      password: body?.password,
    });
    return NextResponse.json({ ok: true, sessionToken: result.sessionToken, session: result.session });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
