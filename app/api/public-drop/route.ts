// app/api/public-drop/route.ts
import { NextRequest } from 'next/server';
import { sharedRateLimit } from '@/lib/ratelimit';
import { saveJob } from '@/lib/jobsSupabase';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { confirmationSearchCandidates, identifierSettingsFromPublicCopy, normalizeConfirmationInput, validateConfirmation } from '@/lib/identifiers';
import {
  classifyPublicIntakeSaveError,
  makePublicIntakeToken,
  PUBLIC_DROP_RATE_LIMIT,
} from '@/lib/publicIntakeSafety';
import {
  normalizeWebbsAllocations,
  normalizeWebbsOrderItems,
  normalizeWebbsOrderStyle,
  webbsAllocationTotalPercent,
} from '@/lib/webbs';
import { getProcessorContextForHostname } from '@/lib/processorContext';

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
  if (rawJob.prefSMS && !rawJob.smsConsent) {
    return 'SMS consent is required when text updates are selected.';
  }

  if (rawJob.webbsOrder) {
    const orderStyle = normalizeWebbsOrderStyle(rawJob.webbsOrderStyle);
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

function json(payload: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function confirmationExists(
  confirmation: string,
  hostname: string | null | undefined,
  settings: ReturnType<typeof identifierSettingsFromPublicCopy>
) {
  const supabase = getSupabaseServer();
  const processor = await getProcessorContextForHostname(hostname);
  const candidates = confirmationSearchCandidates(confirmation, settings);
  if (!candidates.length) return false;

  let query = supabase
    .from('jobs')
    .select('id')
    .in('confirmation', candidates);

  if (processor.id) query = query.eq('processor_id', processor.id);

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = await sharedRateLimit(ip, 'public-drop', PUBLIC_DROP_RATE_LIMIT.limit, PUBLIC_DROP_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return json({ ok: false, error: 'Too many intake submissions from this connection. Please wait a minute and try again.' }, 429);
  }

  const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const settings = await getPublicSiteSettings(hostname);
  const processor = await getProcessorContextForHostname(hostname);
  if (!settings.public_intake_enabled) {
    return json(
      {
        ok: false,
        error: settings.banner_message || 'Public intake is currently unavailable.',
      },
      503
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
    return json({ ok: false, error: 'Name and a contact (phone or email) are required.' }, 400);
  }

  const validationError = publicValidationError(rawJob);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400);
  }

  const identifierSettings = identifierSettingsFromPublicCopy(settings.publicCopy);
  const confirmation = normalizeConfirmationInput(String(rawJob.confirmation || ''), identifierSettings).trim();
  const confirmationError = validateConfirmation(confirmation, identifierSettings);
  if (confirmationError) {
    return json({ ok: false, error: confirmationError }, 400);
  }

  if (await confirmationExists(confirmation, hostname, identifierSettings)) {
    return json(
      {
        ok: false,
        error: `That ${identifierSettings.confirmationLabel.toLowerCase()} has already been submitted. If you need to fix the form, contact the shop instead of submitting it again.`,
      },
      409
    );
  }

  let publicToken = makePublicIntakeToken();

  try {
    let result: Awaited<ReturnType<typeof saveJob>> | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        result = await saveJob(
          {
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
          },
          { processorContext: processor }
        );
        break;
      } catch (error: any) {
        const saveError = classifyPublicIntakeSaveError(error);
        if (saveError === 'duplicate_confirmation') {
          return json(
            {
              ok: false,
              error: `That ${identifierSettings.confirmationLabel.toLowerCase()} was submitted by another request. If you need to fix the form, contact the shop instead of submitting it again.`,
            },
            409
          );
        }
        if (saveError === 'retry_public_token') {
          publicToken = makePublicIntakeToken();
          continue;
        }
        if (saveError === 'retry_pending_tag') {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new Error('Submit failed');
    }

    return json(
      {
        ok: true,
        confirmation: result.job?.confirmation || confirmation,
        publicToken: result.job?.publicToken || publicToken,
        job: result.job || null,
      },
      200
    );
  } catch (error: any) {
    console.error('public-drop save error', error);
    return json({ ok: false, error: String(error?.message || error || 'Submit failed') }, 500);
  }
}
