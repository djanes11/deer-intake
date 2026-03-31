// app/api/public-drop/route.ts
import { NextRequest } from 'next/server';
import { sharedRateLimit } from '@/lib/ratelimit';
import { saveJob } from '@/lib/jobsSupabase';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { getSupabaseServer } from '@/lib/supabaseClient';
import {
  normalizeWebbsAllocations,
  normalizeWebbsOrderItems,
  normalizeWebbsOrderStyle,
  webbsAllocationTotalPercent,
} from '@/lib/webbs';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getIp(req: NextRequest): string {
  return (
    (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function genPublicToken() {
  // 24-ish chars url-safe
  return crypto.randomBytes(18).toString('base64url');
}

function genConfirmation() {
  // Public status expects digits-only confirmation values.
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0');
  return `${yy}${mm}${dd}${rand}`;
}

function digitsOnly(v: unknown) {
  return String(v ?? '').replace(/\D/g, '');
}

function is10Digits(v: unknown) {
  return digitsOnly(v).length === 10;
}

function hasText(v: unknown) {
  return String(v ?? '').trim().length > 0;
}

function publicValidationError(rawJob: Record<string, any>): string | null {
  if (!hasText(rawJob.customer)) return 'Customer Name is required.';
  if (!is10Digits(rawJob.phone)) return 'Phone must be 10 digits.';
  if (!hasText(rawJob.address)) return 'Address is required.';
  if (!hasText(rawJob.city)) return 'City is required.';
  if (!hasText(rawJob.state)) return 'State is required.';
  if (!hasText(rawJob.zip)) return 'Zip is required.';
  if (!hasText(rawJob.county)) return 'County Killed is required.';
  if (!hasText(rawJob.dropoff)) return 'Drop-off Date is required.';
  if (!hasText(rawJob.sex)) return 'Deer Sex is required.';
  if (!hasText(rawJob.howKilled)) return 'How Killed is required.';
  if (!hasText(rawJob.processType)) return 'Process Type is required.';

  if (rawJob.prefEmail && !hasText(rawJob.email)) {
    return 'Email is required when email notifications are selected.';
  }

  if (rawJob.webbsOrder) {
    const orderStyle = normalizeWebbsOrderStyle(rawJob.webbsOrderStyle);
    const pounds = Number(String(rawJob.webbsPounds ?? '').replace(/[^0-9.-]/g, ''));
    if (orderStyle !== 'whole_deer_percent' && (!Number.isFinite(pounds) || pounds <= 0)) {
      return 'Estimated Webbs pounds are required.';
    }
    if (orderStyle === 'whole_deer_percent') {
      const allocations = normalizeWebbsAllocations(rawJob.webbsAllocations);
      if (!allocations.length) return 'Enter at least one Webbs product percentage.';
      if (webbsAllocationTotalPercent(allocations) !== 100) {
        return 'Webbs percentages must add up to 100%.';
      }
    } else if (!normalizeWebbsOrderItems(rawJob.webbsItems).length) {
      return 'Enter at least one Webbs item and pounds.';
    }
  }

  return null;
}

async function confirmationExists(confirmation: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('confirmation', confirmation)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function reserveConfirmation(preferred: string) {
  const initial = digitsOnly(preferred);
  if (initial.length === 13 && !(await confirmationExists(initial))) {
    return initial;
  }

  for (let i = 0; i < 10; i += 1) {
    const candidate = genConfirmation();
    if (!(await confirmationExists(candidate))) {
      return candidate;
    }
  }

  throw new Error('Could not generate a unique confirmation number.');
}

function isUniqueViolation(error: any, column: string) {
  const message = String(error?.message || error || '');
  const details = String(error?.details || '');
  return error?.code === '23505' && `${message} ${details}`.toLowerCase().includes(column.toLowerCase());
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = await sharedRateLimit(ip, 'public-drop', 15, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), { status: 429 });
  }

  const settings = await getPublicSiteSettings();
  if (!settings.public_intake_enabled) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: settings.banner_message || 'Public intake is currently unavailable.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawJob = (body?.job && typeof body.job === 'object' ? body.job : body) as Record<string, any>;
  const customer = String(rawJob.customer || '').trim();
  const phone = String(rawJob.phone || '').trim();
  const email = String(rawJob.email || '').trim();
  const processType = String(rawJob.processType || '').trim();
  const notes = String(rawJob.notes || '').trim();

  if (!customer || (!phone && !email)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Name and a contact (phone or email) are required.' }),
      { status: 400 }
    );
  }

  const validationError = publicValidationError(rawJob);
  if (validationError) {
    return new Response(JSON.stringify({ ok: false, error: validationError }), { status: 400 });
  }

  let confirmation = await reserveConfirmation(String(rawJob.confirmation || '').trim());
  const publicToken = String(rawJob.publicToken || '').trim() || genPublicToken();

  try {
    let result: Awaited<ReturnType<typeof saveJob>> | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await saveJob({
          ...rawJob,
          tag: '',
          confirmation,
          customer,
          phone,
          email: email || '',
          processType: processType || '',
          notes: notes || '',
          requiresTag: true,
          status: rawJob.status || 'Dropped Off',
          dropoff: rawJob.dropoff || new Date().toISOString().slice(0, 10),
          publicToken,
        });
        break;
      } catch (error: any) {
        if (isUniqueViolation(error, 'confirmation')) {
          confirmation = await reserveConfirmation('');
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new Error('Submit failed');
    }

    return new Response(
      JSON.stringify({
        ok: true,
        confirmation: result.job?.confirmation || confirmation,
        publicToken: result.job?.publicToken || publicToken,
        job: result.job || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('public-drop save error', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message || error || 'Submit failed') }),
      { status: 500 }
    );
  }
}
