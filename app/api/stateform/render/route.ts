import { NextResponse } from 'next/server';
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { getStateFormDefinition } from '@/lib/stateforms/registry';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const download = searchParams.get('download') === '1';

  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'view');
    if (denied) {
      const body = await denied.text().catch(() => 'Unauthorized');
      return new NextResponse(body, {
        status: denied.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const payload = await fetchStateformPayloadFromSupabase(processor);
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
