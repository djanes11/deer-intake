import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { defaultPublicSiteSettings, getPublicSiteSettings } from '@/lib/siteSettings';

export async function GET(req: Request) {
  try {
    const hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const settings = await getPublicSiteSettings(hostname);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
  }
}
