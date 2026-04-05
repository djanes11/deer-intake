import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffProcessorContext, isPlatformAdmin } from '@/lib/staffContext';

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
  input: {
    processorId: string;
    userId: string | null;
    email: string;
    role: StaffRole;
    active: boolean;
  }
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

  if (existingResp.data?.id) {
    const { data, error } = await supabase
      .from('processor_users')
      .update(payload)
      .eq('id', existingResp.data.id)
      .select('id,processor_id,user_id,email,role,active,created_at,updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('processor_users')
    .insert(payload)
    .select('id,processor_id,user_id,email,role,active,created_at,updated_at')
    .single();
  if (error) throw error;
  return data;
}

async function verifyProcessorAdmin(req: Request) {
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return { denied: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), processor: null as any };
  }

  const processor = await getStaffProcessorContext(req);
  const platformAdmin = await isPlatformAdmin(req);
  if (!processor.id) {
    return {
      denied: NextResponse.json({ ok: false, error: 'No processor membership found for this account.' }, { status: 403 }),
      processor: null as any,
    };
  }
  if (!platformAdmin && processor.role !== 'admin') {
    return {
      denied: NextResponse.json({ ok: false, error: 'Processor admin access required.' }, { status: 403 }),
      processor: null as any,
    };
  }
  return { denied: null as NextResponse | null, processor, platformAdmin };
}

export async function GET(req: Request) {
  try {
    const { denied, processor } = await verifyProcessorAdmin(req);
    if (denied) return denied;

    const supabase = getSupabase();
    const [membershipResp, authUsers] = await Promise.all([
      supabase
        .from('processor_users')
        .select('id,processor_id,user_id,email,role,active,created_at,updated_at')
        .eq('processor_id', processor.id)
        .order('email', { ascending: true }),
      listAllAuthUsers(supabase),
    ]);

    if (membershipResp.error) throw membershipResp.error;

    const authById = new Map<string, any>();
    const authByEmail = new Map<string, any>();
    for (const user of authUsers) {
      const id = String(user?.id || '');
      const email = normalizeEmail(user?.email);
      if (id) authById.set(id, user);
      if (email) authByEmail.set(email, user);
    }

    return NextResponse.json({
      ok: true,
      processor: {
        id: processor.id,
        slug: processor.slug,
      },
      memberships: (membershipResp.data || []).map((row: any) => {
        const email = normalizeEmail(row.email);
        const authUser = (row.user_id && authById.get(String(row.user_id))) || authByEmail.get(email);
        return {
          id: String(row.id),
          processorId: String(row.processor_id),
          email,
          userId: String(row.user_id || authUser?.id || ''),
          role: normalizeRole(row.role),
          active: !!row.active,
          createdAt: row.created_at || null,
          updatedAt: row.updated_at || null,
          lastSignInAt: authUser?.last_sign_in_at || null,
          authCreatedAt: authUser?.created_at || null,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { denied, processor } = await verifyProcessorAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const role = normalizeRole(body?.role);
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const authUsers = await listAllAuthUsers(supabase);
    let authUser = authUsers.find((user) => normalizeEmail(user?.email) === email) || null;
    let invited = false;

    if (!authUser) {
      const origin = new URL(req.url).origin;
      const invite = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/staff/reset-password?next=/`,
      });
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

    return NextResponse.json({
      ok: true,
      invited,
      membership: {
        id: String(data.id),
        processorId: String(data.processor_id),
        email: normalizeEmail(data.email),
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
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Membership id is required.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('processor_users')
      .update({
        role: normalizeRole(body?.role),
        active: body?.active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('processor_id', processor.id)
      .select('id,processor_id,user_id,email,role,active,created_at,updated_at')
      .single();
    if (error) throw error;

    const authUsers = await listAllAuthUsers(supabase);
    const email = normalizeEmail(data.email);
    const authUser =
      authUsers.find((user) => String(user?.id || '') === String(data.user_id || '')) ||
      authUsers.find((user) => normalizeEmail(user?.email) === email) ||
      null;

    return NextResponse.json({
      ok: true,
      membership: {
        id: String(data.id),
        processorId: String(data.processor_id),
        email,
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
