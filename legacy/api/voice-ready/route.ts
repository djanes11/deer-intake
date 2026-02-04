import { NextResponse } from 'next/server';

// GET /api/voice-ready?name=First&tag=12345&total=246.55
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || 'there').trim();
  const tag  = (searchParams.get('tag')  || '').trim();
  const total = searchParams.get('total');

  const friendly = name.split(' ')[0] || 'there';
  const due = total ? ` Total due: ${total} dollars.` : '';

  const message =
    `Hi ${friendly}. Your deer` +
    (tag ? `, tag ${tag},` : '') +
    ` is ready for pickup at McAfee Custom Deer Processing.` +
    due +
    ` If you have questions, please call 502 643 3916. Thank you.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
}
