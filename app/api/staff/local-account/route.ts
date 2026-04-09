import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffIdentity } from '@/lib/staffContext';
import { updateLocalStaffPassword } from '@/lib/localStaffAuth';
import { writeAuditEntry } from '@/lib/auditLog';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const identity = await getStaffIdentity(req);
    if (identity.authType !== 'local' || !identity.userId || !identity.processorId || !identity.username) {
      return NextResponse.json({ ok: false, error: 'Local staff login required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || '').trim();
    const confirmPassword = String(body?.confirmPassword || '').trim();
    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'Passwords do not match.' }, { status: 400 });
    }

    const updated = await updateLocalStaffPassword({
      localUserId: identity.userId,
      password,
      clearMustChangePassword: true,
    });

    await writeAuditEntry({
      req,
      processorId: identity.processorId,
      action: 'staff.local.password_changed',
      targetType: 'staff_local_user',
      targetId: String(updated.id),
      targetLabel: String(identity.username),
      summary: `Local staff user ${identity.username} changed their password`,
      details: { username: identity.username, selfService: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
