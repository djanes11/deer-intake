import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { hashLocalPassword } from '@/lib/localStaffAuth';
import { getStaffProcessorContext, isPlatformAdmin } from '@/lib/staffContext';
import { writeAuditEntry } from '@/lib/auditLog';

type StaffRole = 'admin' | 'staff' | 'readonly';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function normalizeRole(raw: unknown): StaffRole {
  return raw === 'admin' || raw === 'readonly' ? raw : 'staff';
}

function normalizeEmail(raw: unknown) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeUsername(raw: unknown) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function listAllAuthUsers(supabase: ReturnType<typeof getSupabase>) {
  const users: any[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

async function upsertProcessorMembership(
  supabase: ReturnType<typeof getSupabase>,
  input: { processorId: string; userId: string | null; email: string; role: StaffRole; active: boolean }
) {
  const existingResp = await supabase
    .from('processor_users')
    .select('id')
    .eq('processor_id', input.processorId)
    .ilike('email', input.email)
    .maybeSingle();
  if (existingResp.error) throw existingResp.error;

  const payload = {
    processor_id: input.processorId,
    user_id: input.userId,
    email: input.email,
    role: input.role,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  const resp = existingResp.data?.id
    ? await supabase.from('processor_users').update(payload).eq('id', existingResp.data.id).select('id,processor_id,user_id,email,role,active,created_at,updated_at').single()
    : await supabase.from('processor_users').insert(payload).select('id,processor_id,user_id,email,role,active,created_at,updated_at').single();
  if (resp.error) throw resp.error;
  return resp.data;
}

async function verifyProcessorAdmin(req: Request) {
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return { denied: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), processor: null as any };
  }
  const processor = await getStaffProcessorContext(req);
  const platformAdmin = await isPlatformAdmin(req);
  if (!processor.id) {
    return { denied: NextResponse.json({ ok: false, error: 'No processor membership found for this account.' }, { status: 403 }), processor: null as any };
  }
  if (!platformAdmin && processor.role !== 'admin') {
    return { denied: NextResponse.json({ ok: false, error: 'Processor admin access required.' }, { status: 403 }), processor: null as any };
  }
  return { denied: null as NextResponse | null, processor };
}

export async function GET(req: Request) {
  try {
    const { denied, processor } = await verifyProcessorAdmin(req);
    if (denied) return denied;

    const supabase = getSupabase();
    const [membershipResp, localResp, authUsers] = await Promise.all([
      supabase.from('processor_users').select('id,processor_id,user_id,email,role,active,created_at,updated_at').eq('processor_id', processor.id).order('email', { ascending: true }),
      supabase.from('staff_local_users').select('id,processor_id,username,role,active,created_at,updated_at').eq('processor_id', processor.id).order('username', { ascending: true }),
      listAllAuthUsers(supabase),
    ]);
    if (membershipResp.error) throw membershipResp.error;
    if (localResp.error) throw localResp.error;

    const authById = new Map<string, any>();
    const authByEmail = new Map<string, any>();
    for (const user of authUsers) {
      const id = String(user?.id || '');
      const email = normalizeEmail(user?.email);
      if (id) authById.set(id, user);
      if (email) authByEmail.set(email, user);
    }

    const memberships = [
      ...(membershipResp.data || []).map((row: any) => {
        const email = normalizeEmail(row.email);
        const authUser = (row.user_id && authById.get(String(row.user_id))) || authByEmail.get(email);
        return {
          id: String(row.id),
          processorId: String(row.processor_id),
          accountType: 'email',
          email,
          username: '',
          userId: String(row.user_id || authUser?.id || ''),
          role: normalizeRole(row.role),
          active: !!row.active,
          createdAt: row.created_at || null,
          updatedAt: row.updated_at || null,
          lastSignInAt: authUser?.last_sign_in_at || null,
          authCreatedAt: authUser?.created_at || null,
        };
      }),
      ...(localResp.data || []).map((row: any) => ({
        id: String(row.id),
        processorId: String(row.processor_id),
        accountType: 'local',
        email: '',
        username: normalizeUsername(row.username),
        userId: String(row.id),
        role: normalizeRole(row.role),
        active: !!row.active,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        lastSignInAt: null,
        authCreatedAt: null,
      })),
    ];

    return NextResponse.json({ ok: true, processor: { id: processor.id, slug: processor.slug }, memberships });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { denied, processor } = await verifyProcessorAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const accountType = body?.accountType === 'local' ? 'local' : 'email';
    const role = normalizeRole(body?.role);
    const supabase = getSupabase();

    if (accountType === 'local') {
      const username = normalizeUsername(body?.username);
      const password = String(body?.password || '').trim();
      if (!username) return NextResponse.json({ ok: false, error: 'Username is required.' }, { status: 400 });
      if (!password || password.length < 8) return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
      if (role === 'admin') return NextResponse.json({ ok: false, error: 'Local staff logins can only be Staff or Read-only.' }, { status: 400 });

      const existingResp = await supabase.from('staff_local_users').select('id,processor_id').ilike('username', username).maybeSingle();
      if (existingResp.error) throw existingResp.error;
      if (existingResp.data?.id && String(existingResp.data.processor_id) !== String(processor.id)) {
        return NextResponse.json({ ok: false, error: 'That username is already in use by another processor. Choose a different username.' }, { status: 400 });
      }

      const payload = {
        processor_id: processor.id,
        username,
        password_hash: hashLocalPassword(password),
        role,
        active: true,
        updated_at: new Date().toISOString(),
      };
      const localResp = existingResp.data?.id
        ? await supabase.from('staff_local_users').update(payload).eq('id', existingResp.data.id).select('id,processor_id,username,role,active,created_at,updated_at').single()
        : await supabase.from('staff_local_users').insert(payload).select('id,processor_id,username,role,active,created_at,updated_at').single();
      if (localResp.error) throw localResp.error;
      await writeAuditEntry({
        req,
        processorId: processor.id,
        action: existingResp.data?.id ? 'staff.local.updated' : 'staff.local.created',
        targetType: 'staff_local_user',
        targetId: String(localResp.data.id),
        targetLabel: username,
        summary: existingResp.data?.id
          ? `Updated local staff login ${username}`
          : `Created local staff login ${username}`,
        details: { username, role, active: true },
      });

      return NextResponse.json({
        ok: true,
        invited: false,
        membership: {
          id: String(localResp.data.id),
          processorId: String(localResp.data.processor_id),
          accountType: 'local',
          email: '',
          username: normalizeUsername(localResp.data.username),
          userId: String(localResp.data.id),
          role: normalizeRole(localResp.data.role),
          active: !!localResp.data.active,
          createdAt: localResp.data.created_at || null,
          updatedAt: localResp.data.updated_at || null,
          lastSignInAt: null,
          authCreatedAt: null,
        },
      });
    }

    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    const authUsers = await listAllAuthUsers(supabase);
    let authUser = authUsers.find((user) => normalizeEmail(user?.email) === email) || null;
    let invited = false;
    if (!authUser) {
      const origin = new URL(req.url).origin;
      const invite = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/staff/reset-password?next=/` });
      if (invite.error) throw invite.error;
      authUser = invite.data.user;
      invited = true;
    }

    const data = await upsertProcessorMembership(supabase, {
      processorId: processor.id,
      userId: authUser?.id || null,
      email,
      role,
      active: true,
    });
    await writeAuditEntry({
      req,
      processorId: processor.id,
      action: invited ? 'staff.invited' : 'staff.access.granted',
      targetType: 'processor_user',
      targetId: String(data.id),
      targetLabel: email,
      summary: invited ? `Invited ${email} to this processor` : `Granted ${email} access to this processor`,
      details: { email, role, invited },
    });

    return NextResponse.json({
      ok: true,
      invited,
      membership: {
        id: String(data.id),
        processorId: String(data.processor_id),
        accountType: 'email',
        email: normalizeEmail(data.email),
        username: '',
        userId: String(data.user_id || authUser?.id || ''),
        role: normalizeRole(data.role),
        active: !!data.active,
        createdAt: data.created_at || null,
        updatedAt: data.updated_at || null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        authCreatedAt: authUser?.created_at || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { denied, processor } = await verifyProcessorAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const accountType = body?.accountType === 'local' ? 'local' : 'email';
    if (!id) return NextResponse.json({ ok: false, error: 'Membership id is required.' }, { status: 400 });

    const supabase = getSupabase();
    if (accountType === 'local') {
      const patch: Record<string, any> = {
        role: normalizeRole(body?.role),
        active: body?.active !== false,
        updated_at: new Date().toISOString(),
      };
      if (body?.password) {
        const password = String(body.password).trim();
        if (password.length < 8) return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
        patch.password_hash = hashLocalPassword(password);
      }
      const localResp = await supabase.from('staff_local_users').update(patch).eq('id', id).eq('processor_id', processor.id).select('id,processor_id,username,role,active,created_at,updated_at').single();
      if (localResp.error) throw localResp.error;
      await writeAuditEntry({
        req,
        processorId: processor.id,
        action: body?.password ? 'staff.local.password_reset' : 'staff.local.access_updated',
        targetType: 'staff_local_user',
        targetId: String(localResp.data.id),
        targetLabel: normalizeUsername(localResp.data.username),
        summary: body?.password
          ? `Reset password for local staff login ${normalizeUsername(localResp.data.username)}`
          : `Updated local staff login ${normalizeUsername(localResp.data.username)}`,
        details: {
          username: normalizeUsername(localResp.data.username),
          role: normalizeRole(localResp.data.role),
          active: !!localResp.data.active,
          passwordReset: !!body?.password,
        },
      });
      return NextResponse.json({
        ok: true,
        membership: {
          id: String(localResp.data.id),
          processorId: String(localResp.data.processor_id),
          accountType: 'local',
          email: '',
          username: normalizeUsername(localResp.data.username),
          userId: String(localResp.data.id),
          role: normalizeRole(localResp.data.role),
          active: !!localResp.data.active,
          createdAt: localResp.data.created_at || null,
          updatedAt: localResp.data.updated_at || null,
          lastSignInAt: null,
          authCreatedAt: null,
        },
      });
    }

    const { data, error } = await supabase.from('processor_users').update({
      role: normalizeRole(body?.role),
      active: body?.active !== false,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('processor_id', processor.id).select('id,processor_id,user_id,email,role,active,created_at,updated_at').single();
    if (error) throw error;
    const email = normalizeEmail(data.email);
    await writeAuditEntry({
      req,
      processorId: processor.id,
      action: 'staff.access_updated',
      targetType: 'processor_user',
      targetId: String(data.id),
      targetLabel: email,
      summary: `Updated staff access for ${email}`,
      details: {
        email,
        role: normalizeRole(data.role),
        active: !!data.active,
      },
    });

    const authUsers = await listAllAuthUsers(supabase);
    const authUser =
      authUsers.find((user) => String(user?.id || '') === String(data.user_id || '')) ||
      authUsers.find((user) => normalizeEmail(user?.email) === email) ||
      null;

    return NextResponse.json({
      ok: true,
      membership: {
        id: String(data.id),
        processorId: String(data.processor_id),
        accountType: 'email',
        email,
        username: '',
        userId: String(data.user_id || authUser?.id || ''),
        role: normalizeRole(data.role),
        active: !!data.active,
        createdAt: data.created_at || null,
        updatedAt: data.updated_at || null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        authCreatedAt: authUser?.created_at || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
