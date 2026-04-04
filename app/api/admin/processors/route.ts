import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { isPlatformAdmin } from '@/lib/staffContext';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function normalizeFeatures(raw: any) {
  return {
    plan:
      raw?.plan === 'basic' || raw?.plan === 'texting' || raw?.plan === 'custom'
        ? raw.plan
        : 'basic',
    smsEnabled: raw?.smsEnabled !== false,
    webbsEnabled: raw?.webbsEnabled !== false,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (!(await isPlatformAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'Platform admin access required.' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('processors')
      .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,created_at,updated_at')
      .order('slug', { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      rows: (data || []).map((row: any) => ({
        id: String(row.id),
        slug: String(row.slug || ''),
        name: String(row.name || ''),
        publicName: String(row.public_name || row.name || ''),
        active: !!row.active,
        publicHostname: String(row.public_hostname || ''),
        staffHostname: String(row.staff_hostname || ''),
        features: normalizeFeatures(row.features || {}),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (!(await isPlatformAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'Platform admin access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'Processor id is required.' }, { status: 400 });

    const payload = {
      active: body?.active !== false,
      public_hostname: String(body?.publicHostname || '').trim().toLowerCase() || null,
      staff_hostname: String(body?.staffHostname || '').trim().toLowerCase() || null,
      features: normalizeFeatures(body?.features || {}),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('processors')
      .update(payload)
      .eq('id', id)
      .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,created_at,updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      row: {
        id: String(data.id),
        slug: String(data.slug || ''),
        name: String(data.name || ''),
        publicName: String(data.public_name || data.name || ''),
        active: !!data.active,
        publicHostname: String(data.public_hostname || ''),
        staffHostname: String(data.staff_hostname || ''),
        features: normalizeFeatures(data.features || {}),
        createdAt: data.created_at || null,
        updatedAt: data.updated_at || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
