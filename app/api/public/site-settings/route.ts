import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultPublicSiteSettings, normalizeHours } from '@/lib/siteSettings';

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
      .select('public_intake_enabled,banner_enabled,banner_message,hours,updated_at')
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
        updated_at: data.updated_at ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
  }
}
