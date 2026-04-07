import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeHours, defaultPublicSiteSettings } from '@/lib/siteSettings';
import { normalizePricing } from '@/lib/pricing';
import { requireProcessorPermission } from '@/lib/staffPermissions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'manage_settings');
    if (denied) return denied;
    if (!processor) throw new Error('No processor context found.');
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    let query = supabase.from('site_settings').select('*');
    query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);
    const { data, error } = await query.single();
    if (error) throw error;

    const defaults = defaultPublicSiteSettings().branding;
    let branding = defaults;
    if (processor.id) {
      const { data: processorRow, error: processorError } = await supabase
        .from('processors')
        .select('name,public_name,public_tagline,logo_url,support_phone_display,support_phone_e164,support_email,public_address,public_maps_url,location_label,features')
        .eq('id', processor.id)
        .maybeSingle();
      if (processorError) throw processorError;
      if (processorRow) {
        const rawFeatures = (processorRow as any).features || {};
        branding = {
          name: String(processorRow.public_name || processorRow.name || defaults.name),
          locationLabel: String(processorRow.location_label || defaults.locationLabel),
          tagline: String(processorRow.public_tagline || defaults.tagline),
          logoUrl: String(processorRow.logo_url || defaults.logoUrl),
          phoneDisplay: String(processorRow.support_phone_display || defaults.phoneDisplay),
          phoneE164: String(processorRow.support_phone_e164 || defaults.phoneE164),
          email: String(processorRow.support_email || defaults.email),
          address: String(processorRow.public_address || defaults.address),
          mapsUrl: String(processorRow.public_maps_url || defaults.mapsUrl),
        };
        return NextResponse.json({
          ok: true,
          settings: {
            ...data,
            branding,
            features: {
              plan:
                rawFeatures?.plan === 'basic' || rawFeatures?.plan === 'texting' || rawFeatures?.plan === 'custom'
                  ? rawFeatures.plan
                  : 'custom',
              smsEnabled: rawFeatures?.smsEnabled !== false,
              webbsEnabled: rawFeatures?.webbsEnabled !== false,
            },
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      settings: {
        ...data,
        branding,
        features: defaultPublicSiteSettings().features,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'manage_settings');
    if (denied) return denied;
    if (!processor) throw new Error('No processor context found.');
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');

    const body = await req.json().catch(() => ({}));
    const defaults = defaultPublicSiteSettings().branding;

    const payload = {
      ...(processor?.id ? { processor_id: processor.id } : {}),
      public_intake_enabled: !!body.public_intake_enabled,
      banner_enabled: !!body.banner_enabled,
      banner_message: String(body.banner_message || ''),
      hours: normalizeHours(body.hours),
      ...normalizePricing(body),
    };

    const processorPayload = {
      ...(body?.branding?.name ? { public_name: String(body.branding.name || '').trim() } : {}),
      public_tagline: String(body?.branding?.tagline || defaults.tagline),
      logo_url: String(body?.branding?.logoUrl || defaults.logoUrl),
      support_phone_display: String(body?.branding?.phoneDisplay || defaults.phoneDisplay),
      support_phone_e164: String(body?.branding?.phoneE164 || defaults.phoneE164),
      support_email: String(body?.branding?.email || ''),
      public_address: String(body?.branding?.address || defaults.address),
      public_maps_url: String(body?.branding?.mapsUrl || defaults.mapsUrl),
      location_label: String(body?.branding?.locationLabel || defaults.locationLabel),
      features: {
        plan:
          body?.features?.plan === 'basic' || body?.features?.plan === 'texting' || body?.features?.plan === 'custom'
            ? body.features.plan
            : defaultPublicSiteSettings().features.plan,
        smsEnabled: body?.features?.smsEnabled !== false,
        webbsEnabled: body?.features?.webbsEnabled !== false,
      },
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    let existingQuery = supabase.from('site_settings').select('id');
    existingQuery = processor.id ? existingQuery.eq('processor_id', processor.id) : existingQuery.eq('id', 1);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw existingError;

    let data: any = null;
    let error: any = null;

    if (existing?.id != null) {
      const resp = await supabase
        .from('site_settings')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      data = resp.data;
      error = resp.error;
    } else {
      const { data: latest, error: latestError } = await supabase
        .from('site_settings')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const nextId = Number(latest?.id ?? 0) + 1 || 1;
      const resp = await supabase
        .from('site_settings')
        .insert({ id: nextId, ...payload })
        .select('*')
        .single();
      data = resp.data;
      error = resp.error;
    }

    if (error) throw error;

    if (processor.id) {
      const { error: processorError } = await supabase
        .from('processors')
        .update(processorPayload)
        .eq('id', processor.id);
      if (processorError) throw processorError;
    }

    const merged = {
      ...data,
      branding: {
        name: processorPayload.public_name || defaults.name,
        locationLabel: processorPayload.location_label,
        tagline: processorPayload.public_tagline,
        logoUrl: processorPayload.logo_url,
        phoneDisplay: processorPayload.support_phone_display,
        phoneE164: processorPayload.support_phone_e164,
        email: processorPayload.support_email,
        address: processorPayload.public_address,
        mapsUrl: processorPayload.public_maps_url,
      },
      features: processorPayload.features,
    };

    return NextResponse.json({ ok: true, settings: merged });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
