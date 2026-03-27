import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultPublicSiteSettings, normalizeHours } from '@/lib/siteSettings';
import { normalizePricing } from '@/lib/pricing';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('site_settings')
      .select('public_intake_enabled,banner_enabled,banner_message,hours,updated_at,standard_processing_price,caped_price,cape_donate_price,beef_fat_add_on,webbs_add_on,summer_sausage_price_per_lb,snack_stix_price_per_lb')
      .eq('id', 1)
      .single();

    if (error) throw error;

    // Only return fields safe for the public to see
    return NextResponse.json({
      ok: true,
      settings: {
        public_intake_enabled: !!data.public_intake_enabled,
        banner_enabled: !!data.banner_enabled,
        banner_message: String(data.banner_message || ''),
        hours: normalizeHours(data.hours),
        pricing: normalizePricing(data),
        updated_at: data.updated_at ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
  }
}
