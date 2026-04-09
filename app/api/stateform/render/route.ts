import { NextResponse } from 'next/server';
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getStateFormDefinition } from '@/lib/stateforms/registry';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const download = searchParams.get('download') === '1';

  try {
    const auth = await requireStaffAccess(req);
    if (!auth.ok) {
      return new NextResponse(auth.error, {
        status: auth.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const payload = await fetchStateformPayloadFromSupabase();
    const definition = getStateFormDefinition(payload.formType);
    const out = await definition.renderPdf(payload);

    return new NextResponse(Buffer.from(out), {
      headers: {
        'Content-Type': 'application/pdf',
        ...(download
          ? {
              'Content-Disposition': `attachment; filename="${payload.formType}-state-form.pdf"`,
            }
          : {}),
      },
    });
  } catch (err: any) {
    return new NextResponse(`Stateform render error: ${err?.message || err}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
