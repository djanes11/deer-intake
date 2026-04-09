import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffAccess } from '@/lib/staffAuth';
import { isPlatformAdmin } from '@/lib/staffContext';
import { SITE } from '@/lib/config';
import { DEFAULT_SITE_PRICING } from '@/lib/pricing';
import { normalizeProcessorFeatures } from '@/lib/siteSettings';
import { buildOnboardingChecklist } from '@/lib/onboardingChecklist';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function normalizeFeatures(raw: any) {
  return normalizeProcessorFeatures(raw);
}

function normalizeText(raw: unknown) {
  return String(raw || '').trim();
}

function normalizeSlug(raw: unknown) {
  return normalizeText(raw)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeEmail(raw: unknown) {
  return normalizeText(raw).toLowerCase();
}

function normalizeBillingStatus(raw: unknown) {
  const v = normalizeText(raw).toLowerCase();
  return ['setup', 'trial', 'active', 'past_due', 'paused', 'internal'].includes(v) ? v : 'setup';
}

function normalizeBillingCycle(raw: unknown) {
  const v = normalizeText(raw).toLowerCase();
  return ['monthly', 'seasonal', 'annual', 'custom'].includes(v) ? v : 'monthly';
}

function normalizeMoney(raw: unknown) {
  const text = normalizeText(raw);
  if (!text) return null;
  const n = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function suggestedPerDeerRate(plan: string) {
  if (plan === 'custom') return 5;
  if (plan === 'texting') return 3;
  return 2;
}

function normalizeIsoDate(raw: unknown) {
  const text = normalizeText(raw);
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function addDaysIso(baseIso: string, days: number) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function applyLifecycleDefaults(input: {
  billingStatus: string;
  trialEndsAt: string | null;
  subscriptionStartedAt: string | null;
  goLiveAt: string | null;
  setupCompletedAt: string | null;
}) {
  const nowIso = new Date().toISOString();
  let billingStatus = normalizeBillingStatus(input.billingStatus);
  let trialEndsAt = input.trialEndsAt;
  let subscriptionStartedAt = input.subscriptionStartedAt;
  let goLiveAt = input.goLiveAt;
  const setupCompletedAt = input.setupCompletedAt;

  if (setupCompletedAt && billingStatus === 'setup') {
    billingStatus = 'trial';
  }

  if (billingStatus === 'trial' && !trialEndsAt) {
    trialEndsAt = addDaysIso(setupCompletedAt || nowIso, 14);
  }

  if (billingStatus === 'active') {
    if (!goLiveAt) goLiveAt = nowIso;
    if (!subscriptionStartedAt) subscriptionStartedAt = goLiveAt;
  }

  return {
    billingStatus,
    trialEndsAt,
    subscriptionStartedAt,
    goLiveAt,
  };
}

function nextSiteSettingsId(supabase: ReturnType<typeof getSupabase>) {
  return supabase
    .from('site_settings')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function enrichProcessorRow(
  supabase: ReturnType<typeof getSupabase>,
  row: any
) {
  const processorId = String(row.id);
  const [settingsResp, adminsResp] = await Promise.all([
    supabase
      .from('site_settings')
      .select('*')
      .eq('processor_id', processorId)
      .maybeSingle(),
    supabase
      .from('processor_users')
      .select('id', { count: 'exact', head: true })
      .eq('processor_id', processorId)
      .eq('active', true)
      .eq('role', 'admin'),
  ]);

  if (settingsResp.error) throw settingsResp.error;
  if (adminsResp.error) throw adminsResp.error;

  const checklist = buildOnboardingChecklist({
    publicHostname: row.public_hostname,
    staffHostname: row.staff_hostname,
    adminCount: adminsResp.count || 0,
    processor: {
      publicName: row.public_name,
      supportPhoneDisplay: row.support_phone_display,
      publicAddress: row.public_address,
    },
    siteSettings: settingsResp.data || {},
  });

  return {
    id: processorId,
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    publicName: String(row.public_name || row.name || ''),
    active: !!row.active,
    publicHostname: String(row.public_hostname || ''),
    staffHostname: String(row.staff_hostname || ''),
    features: normalizeFeatures(row.features || {}),
    billingStatus: normalizeBillingStatus(row.billing_status),
    billingCycle: normalizeBillingCycle(row.billing_cycle),
    monthlyPrice: row.monthly_price == null ? null : Number(row.monthly_price),
    setupFee: row.setup_fee == null ? null : Number(row.setup_fee),
    perDeerRate: row.per_deer_rate == null ? suggestedPerDeerRate(normalizeFeatures(row.features || {}).plan) : Number(row.per_deer_rate),
    trialEndsAt: row.trial_ends_at || null,
    subscriptionStartedAt: row.subscription_started_at || null,
    goLiveAt: row.go_live_at || null,
    setupCompletedAt: row.setup_completed_at || null,
    billingNotes: String(row.billing_notes || ''),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    onboarding: checklist,
  };
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
  input: { processorId: string; userId: string; email: string; role: 'admin' | 'staff' | 'readonly'; active: boolean }
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
    ? await supabase.from('processor_users').update(payload).eq('id', existingResp.data.id)
    : await supabase.from('processor_users').insert(payload);
  if (resp.error) throw resp.error;
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
      .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,billing_status,billing_cycle,monthly_price,setup_fee,per_deer_rate,trial_ends_at,subscription_started_at,go_live_at,setup_completed_at,billing_notes,created_at,updated_at')
      .order('slug', { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      rows: await Promise.all((data || []).map((row: any) => enrichProcessorRow(supabase, row))),
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
    const id = normalizeText(body?.id);
    const supabase = getSupabase();

    if (!id) {
      const slug = normalizeSlug(body?.slug);
      const name = normalizeText(body?.name);
      const publicName = normalizeText(body?.publicName) || name;
      const publicHostname = normalizeText(body?.publicHostname).toLowerCase() || null;
      const staffHostname = normalizeText(body?.staffHostname).toLowerCase() || null;
      const features = normalizeFeatures(body?.features || {});
      const billingStatus = normalizeBillingStatus(body?.billingStatus);
      const billingCycle = normalizeBillingCycle(body?.billingCycle);
      const monthlyPrice = normalizeMoney(body?.monthlyPrice);
      const setupFee = normalizeMoney(body?.setupFee);
      const perDeerRate = normalizeMoney(body?.perDeerRate) ?? suggestedPerDeerRate(features.plan);
      const trialEndsAt = normalizeIsoDate(body?.trialEndsAt);
      const subscriptionStartedAt = normalizeIsoDate(body?.subscriptionStartedAt);
      const goLiveAt = normalizeIsoDate(body?.goLiveAt);
      const setupCompletedAt = normalizeIsoDate(body?.setupCompletedAt);
      const billingNotes = normalizeText(body?.billingNotes) || null;
      const firstAdminEmail = normalizeEmail(body?.firstAdminEmail);
      const firstAdminPassword = normalizeText(body?.firstAdminPassword);
      const lifecycle = applyLifecycleDefaults({
        billingStatus,
        trialEndsAt,
        subscriptionStartedAt,
        goLiveAt,
        setupCompletedAt,
      });

      if (!slug) {
        return NextResponse.json({ ok: false, error: 'Processor slug is required.' }, { status: 400 });
      }
      if (!name) {
        return NextResponse.json({ ok: false, error: 'Processor business name is required.' }, { status: 400 });
      }
      if (firstAdminEmail && (!firstAdminPassword || firstAdminPassword.length < 8)) {
        return NextResponse.json({ ok: false, error: 'First admin password must be at least 8 characters.' }, { status: 400 });
      }

      const { data: createdProcessor, error: createProcessorError } = await supabase
        .from('processors')
        .insert({
          slug,
          name,
          public_name: publicName,
          active: body?.active !== false,
          public_hostname: publicHostname,
          staff_hostname: staffHostname,
          public_tagline: `${publicName} on Wild Game Butcher Board.`,
          logo_url: SITE.logoUrl,
          support_phone_display: '',
          support_phone_e164: '',
          support_email: firstAdminEmail || '',
          public_address: '',
          public_maps_url: '',
          location_label: '',
          features,
          billing_status: lifecycle.billingStatus,
          billing_cycle: billingCycle,
          monthly_price: monthlyPrice,
          setup_fee: setupFee,
          per_deer_rate: perDeerRate,
          trial_ends_at: lifecycle.trialEndsAt,
          subscription_started_at: lifecycle.subscriptionStartedAt,
          go_live_at: lifecycle.goLiveAt,
          setup_completed_at: setupCompletedAt,
          billing_notes: billingNotes,
          updated_at: new Date().toISOString(),
        })
        .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,billing_status,billing_cycle,monthly_price,setup_fee,per_deer_rate,trial_ends_at,subscription_started_at,go_live_at,setup_completed_at,billing_notes,created_at,updated_at')
        .single();
      if (createProcessorError) throw createProcessorError;

      const { data: latestSiteSettings, error: latestSiteSettingsError } = await nextSiteSettingsId(supabase);
      if (latestSiteSettingsError) throw latestSiteSettingsError;
      const nextId = Number(latestSiteSettings?.id ?? 0) + 1 || 1;

      const { error: siteSettingsError } = await supabase.from('site_settings').insert({
        id: nextId,
        processor_id: createdProcessor.id,
        public_intake_enabled: true,
        banner_enabled: false,
        banner_message: '',
        hours: SITE.hours.map((row) => ({ label: String(row.label || ''), value: String(row.value || '') })),
        ...DEFAULT_SITE_PRICING,
      });
      if (siteSettingsError) throw siteSettingsError;

      let firstAdminCreated = false;
      if (firstAdminEmail) {
        const authUsers = await listAllAuthUsers(supabase);
        let authUser = authUsers.find((user) => normalizeEmail(user?.email) === firstAdminEmail) || null;
        if (!authUser) {
          const created = await supabase.auth.admin.createUser({
            email: firstAdminEmail,
            password: firstAdminPassword,
            email_confirm: true,
          });
          if (created.error) throw created.error;
          authUser = created.data.user;
          firstAdminCreated = true;
        }

        const authUserId = String(authUser?.id || '').trim();
        if (!authUserId) throw new Error('Unable to resolve first processor admin.');
        await upsertProcessorMembership(supabase, {
          processorId: String(createdProcessor.id),
          userId: authUserId,
          email: firstAdminEmail,
          role: 'admin',
          active: true,
        });
      }

      return NextResponse.json({
        ok: true,
        created: true,
        firstAdminCreated,
        row: await enrichProcessorRow(supabase, createdProcessor),
      });
    }

    const setupCompletedAt = normalizeIsoDate(body?.setupCompletedAt);
    const lifecycle = applyLifecycleDefaults({
      billingStatus: body?.billingStatus,
      trialEndsAt: normalizeIsoDate(body?.trialEndsAt),
      subscriptionStartedAt: normalizeIsoDate(body?.subscriptionStartedAt),
      goLiveAt: normalizeIsoDate(body?.goLiveAt),
      setupCompletedAt,
    });

    const payload = {
      active: body?.active !== false,
      public_hostname: String(body?.publicHostname || '').trim().toLowerCase() || null,
      staff_hostname: String(body?.staffHostname || '').trim().toLowerCase() || null,
      features: normalizeFeatures(body?.features || {}),
      billing_status: lifecycle.billingStatus,
      billing_cycle: normalizeBillingCycle(body?.billingCycle),
      monthly_price: normalizeMoney(body?.monthlyPrice),
      setup_fee: normalizeMoney(body?.setupFee),
      per_deer_rate: normalizeMoney(body?.perDeerRate) ?? suggestedPerDeerRate(normalizeFeatures(body?.features || {}).plan),
      trial_ends_at: lifecycle.trialEndsAt,
      subscription_started_at: lifecycle.subscriptionStartedAt,
      go_live_at: lifecycle.goLiveAt,
      setup_completed_at: setupCompletedAt,
      billing_notes: normalizeText(body?.billingNotes) || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('processors')
      .update(payload)
      .eq('id', id)
      .select('id,slug,name,public_name,active,public_hostname,staff_hostname,features,billing_status,billing_cycle,monthly_price,setup_fee,per_deer_rate,trial_ends_at,subscription_started_at,go_live_at,setup_completed_at,billing_notes,created_at,updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      row: await enrichProcessorRow(supabase, data),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
