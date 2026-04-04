import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { isPlatformAdmin } from '@/lib/staffContext';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type StaffRole = 'admin' | 'staff' | 'readonly';

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

async function verifyPlatformAdmin(req: Request) {
  const auth = await requireStaffAccess(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!(await isPlatformAdmin(req))) {
    return NextResponse.json({ ok: false, error: 'Platform admin access required.' }, { status: 403 });
  }
  return null;
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

export async function GET(req: Request) {
  try {
    const denied = await verifyPlatformAdmin(req);
    if (denied) return denied;

    const supabase = getSupabase();
    const [processorResp, membershipResp, adminResp, authUsers] = await Promise.all([
      supabase.from('processors').select('id,slug,name,public_name,active').order('slug', { ascending: true }),
      supabase
        .from('processor_users')
        .select('id,processor_id,user_id,email,role,active,created_at,updated_at,processors!inner(slug,name,public_name)')
        .order('email', { ascending: true }),
      supabase.from('platform_admins').select('id,user_id,email,active').order('email', { ascending: true }),
      listAllAuthUsers(supabase),
    ]);

    if (processorResp.error) throw processorResp.error;
    if (membershipResp.error) throw membershipResp.error;
    if (adminResp.error) throw adminResp.error;

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
      processors: (processorResp.data || []).map((row: any) => ({
        id: String(row.id),
        slug: String(row.slug || ''),
        name: String(row.public_name || row.name || ''),
        active: !!row.active,
      })),
      platformAdmins: (adminResp.data || []).map((row: any) => ({
        id: String(row.id),
        email: normalizeEmail(row.email),
        userId: String(row.user_id || ''),
        active: !!row.active,
      })),
      memberships: (membershipResp.data || []).map((row: any) => {
        const processor = Array.isArray(row.processors) ? row.processors[0] : row.processors;
        const email = normalizeEmail(row.email);
        const authUser = (row.user_id && authById.get(String(row.user_id))) || authByEmail.get(email);
        return {
          id: String(row.id),
          processorId: String(row.processor_id),
          processorSlug: String(processor?.slug || ''),
          processorName: String(processor?.public_name || processor?.name || ''),
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
    const denied = await verifyPlatformAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '').trim();
    const processorId = String(body?.processorId || '').trim();
    const role = normalizeRole(body?.role);
    const platformAdmin = body?.platformAdmin === true;

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!platformAdmin && !processorId) {
      return NextResponse.json({ ok: false, error: 'Processor is required for staff users.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const authUsers = await listAllAuthUsers(supabase);
    let authUser = authUsers.find((user) => normalizeEmail(user?.email) === email) || null;

    if (!authUser) {
      const created = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      authUser = created.data.user;
    }

    const authUserId = String(authUser?.id || '').trim();
    if (!authUserId) throw new Error('Unable to resolve auth user.');

    let membership: any = null;
    if (processorId) {
      const { data, error } = await supabase
        .from('processor_users')
        .upsert(
          {
            processor_id: processorId,
            user_id: authUserId,
            email,
            role,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'processor_id,email' }
        )
        .select('id,processor_id,user_id,email,role,active,created_at,updated_at,processors!inner(slug,name,public_name)')
        .single();
      if (error) throw error;
      membership = data;
    }

    if (platformAdmin) {
      const { error } = await supabase
        .from('platform_admins')
        .upsert(
          {
            user_id: authUserId,
            email,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );
      if (error) throw error;
    }

    const processor = membership ? (Array.isArray(membership.processors) ? membership.processors[0] : membership.processors) : null;

    return NextResponse.json({
      ok: true,
      created: !authUsers.some((user) => normalizeEmail(user?.email) === email),
      membership: membership
        ? {
            id: String(membership.id),
            processorId: String(membership.processor_id),
            processorSlug: String(processor?.slug || ''),
            processorName: String(processor?.public_name || processor?.name || ''),
            email: normalizeEmail(membership.email),
            userId: String(membership.user_id || ''),
            role: normalizeRole(membership.role),
            active: !!membership.active,
            createdAt: membership.created_at || null,
            updatedAt: membership.updated_at || null,
            lastSignInAt: authUser?.last_sign_in_at || null,
            authCreatedAt: authUser?.created_at || null,
          }
        : null,
      platformAdmin,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const denied = await verifyPlatformAdmin(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const role = normalizeRole(body?.role);
    const active = body?.active !== false;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Membership id is required.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('processor_users')
      .update({
        role,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id,processor_id,user_id,email,role,active,created_at,updated_at,processors!inner(slug,name,public_name)')
      .single();
    if (error) throw error;

    const authUsers = await listAllAuthUsers(supabase);
    const email = normalizeEmail(data.email);
    const authUser =
      authUsers.find((user) => String(user?.id || '') === String(data.user_id || '')) ||
      authUsers.find((user) => normalizeEmail(user?.email) === email) ||
      null;
    const processor = Array.isArray((data as any).processors) ? (data as any).processors[0] : (data as any).processors;

    return NextResponse.json({
      ok: true,
      membership: {
        id: String(data.id),
        processorId: String(data.processor_id),
        processorSlug: String(processor?.slug || ''),
        processorName: String(processor?.public_name || processor?.name || ''),
        email,
        userId: String(data.user_id || ''),
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
