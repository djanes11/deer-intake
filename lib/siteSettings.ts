import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SITE } from '@/lib/config';

export type PublicHourRow = {
  label: string;
  value: string;
};

export type PublicSiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: PublicHourRow[];
  updated_at?: string | null;
};

function fallbackHours(): PublicHourRow[] {
  return Array.isArray(SITE.hours)
    ? SITE.hours.map((h) => ({ label: String(h.label || ''), value: String(h.value || '') }))
    : [];
}

export function normalizeHours(input: unknown): PublicHourRow[] {
  if (!Array.isArray(input)) return fallbackHours();
  const hours = input
    .map((row: any) => ({
      label: String(row?.label || '').trim(),
      value: String(row?.value || '').trim(),
    }))
    .filter((row) => row.label || row.value);
  return hours.length ? hours : fallbackHours();
}

export function defaultPublicSiteSettings(): PublicSiteSettings {
  return {
    public_intake_enabled: true,
    banner_enabled: false,
    banner_message: '',
    hours: fallbackHours(),
    updated_at: null,
  };
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return defaultPublicSiteSettings();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('site_settings')
      .select('public_intake_enabled,banner_enabled,banner_message,hours,updated_at')
      .eq('id', 1)
      .single();

    if (error || !data) return defaultPublicSiteSettings();

    return {
      public_intake_enabled: !!data.public_intake_enabled,
      banner_enabled: !!data.banner_enabled,
      banner_message: String(data.banner_message || ''),
      hours: normalizeHours(data.hours),
      updated_at: data.updated_at ?? null,
    };
  } catch {
    return defaultPublicSiteSettings();
  }
}
