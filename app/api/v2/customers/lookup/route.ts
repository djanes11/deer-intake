import { NextRequest, NextResponse } from 'next/server';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { lookupCustomerByName } from '@/lib/jobsSupabase';

export async function GET(req: NextRequest) {
  const { denied, context: processor } = await requireProcessorPermission(req, 'view');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';
    if (!name.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing name' }, { status: 400 });
    }
    const result = await lookupCustomerByName(name, { processorContext: processor });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
