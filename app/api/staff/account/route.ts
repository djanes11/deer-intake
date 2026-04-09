import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffIdentity } from '@/lib/staffContext';
import { updateLocalStaffPassword } from '@/lib/localStaffAuth';
import { writeAuditEntry } from '@/lib/auditLog';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const identity = await getStaffIdentity(req);
    const body = await req.json().catch(() => ({}));

    if (identity.authType === 'local') {
      if (!identity.userId || !identity.processorId || !identity.username) {
        return NextResponse.json({ ok: false, error: 'Local staff login required.' }, { status: 403 });
      }
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
    }

    if (identity.authType === 'supabase') {
      if (!identity.userId) {
        return NextResponse.json({ ok: false, error: 'Email staff login required.' }, { status: 403 });
      }
      const supabase = getSupabase();
      const current = await supabase.auth.admin.getUserById(identity.userId);
      if (current.error) throw current.error;
      const existingAppMetadata = current.data.user?.app_metadata || {};
      const { error } = await supabase.auth.admin.updateUserById(identity.userId, {
        app_metadata: {
          ...existingAppMetadata,
          wgbb_force_password_change: false,
        },
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported account type.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
