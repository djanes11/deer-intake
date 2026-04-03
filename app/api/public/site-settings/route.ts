import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { defaultPublicSiteSettings, getPublicSiteSettings } from '@/lib/siteSettings';

export async function GET() {
  try {
    const settings = await getPublicSiteSettings();
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
  }
}
