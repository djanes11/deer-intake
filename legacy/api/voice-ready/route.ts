import { NextResponse } from 'next/server';
import { getPublicSiteSettings } from '@/lib/siteSettings';

// GET /api/voice-ready?name=First&tag=12345&total=246.55
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || 'there').trim();
  const tag  = (searchParams.get('tag')  || '').trim();
  const total = searchParams.get('total');

  const friendly = name.split(' ')[0] || 'there';
  const due = total ? ` Total due: ${total} dollars.` : '';
  const settings = await getPublicSiteSettings().catch(() => null);
  const businessName = String(settings?.branding?.name || 'Wild Game Butcher Board');
  const phoneDisplay = String(settings?.branding?.phoneDisplay || '').trim();
  const spokenPhone = phoneDisplay ? ` If you have questions, please call ${phoneDisplay}.` : '';

  const message =
    `Hi ${friendly}. Your deer` +
    (tag ? `, tag ${tag},` : '') +
    ` is ready for pickup at ${businessName}.` +
    due +
    spokenPhone +
    ` Thank you.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
