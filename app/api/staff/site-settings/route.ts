import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStaffProcessorContext } from '@/lib/staffContext';
import { defaultPublicSiteSettings, getPublicSiteSettings } from '@/lib/siteSettings';

export async function GET(req: Request) {
  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const processor = await getStaffProcessorContext(req);
    const settings = await getPublicSiteSettings(null, processor);
    return NextResponse.json({ ok: true, settings, processor });
  } catch {
    return NextResponse.json({ ok: true, settings: defaultPublicSiteSettings() });
  }
}
