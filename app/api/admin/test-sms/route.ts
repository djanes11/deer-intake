import 'server-only';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/staffAuth';
import { getSupabaseServer } from '@/lib/supabaseClient';
import { canSendSmsTo, normalizeUsPhone, sendSms } from '@/lib/sms';

function trimBody(value: any) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const to = normalizeUsPhone(String(body?.to || ''));
    const message = trimBody(body?.message);

    if (!to) return NextResponse.json({ ok: false, error: 'A valid phone number is required.' }, { status: 400 });
    if (!message) return NextResponse.json({ ok: false, error: 'A message is required.' }, { status: 400 });
    if (message.length > 320) {
      return NextResponse.json({ ok: false, error: 'Keep the test message under 320 characters.' }, { status: 400 });
    }

    const gate = canSendSmsTo(to);
    const result = await sendSms({ to, body: message });

    try {
      const supabase = getSupabaseServer();
      await supabase.from('sms_logs').insert({
        job_id: null,
        phone: to,
        template: 'staff_test',
        body: message,
        channel: 'sms',
        provider: 'twilio',
        status: result.ok ? result.status || 'queued' : gate.ok ? 'failed' : gate.code,
        provider_message_sid: result.ok ? result.sid : null,
        error_code: result.ok ? null : result.code,
        error_message: result.ok ? null : result.error,
      });
    } catch (logError) {
      console.error('SMS log write failed (non-fatal)', logError);
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code, to: result.to },
        { status: result.code === 'sms-disabled' || result.code === 'not-allowlisted' ? 200 : 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      sid: result.sid,
      to: result.to,
      status: result.status,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
