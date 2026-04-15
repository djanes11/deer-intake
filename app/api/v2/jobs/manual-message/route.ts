import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sendManualCustomerMessage } from '@/lib/jobsSupabase';
import { requireProcessorPermission } from '@/lib/staffPermissions';
import { writeAuditEntry } from '@/lib/auditLog';

export async function POST(req: Request) {
  try {
    const { denied, context: processor } = await requireProcessorPermission(req, 'manage_notifications');
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const tag = String(body?.tag || '').trim();
    const channel = String(body?.channel || '').trim() as 'email' | 'sms';
    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();

    if (!tag || !message || (channel !== 'email' && channel !== 'sms')) {
      return NextResponse.json({ ok: false, error: 'tag, channel, and message are required' }, { status: 400 });
    }

    const result = await sendManualCustomerMessage({
      tag,
      channel,
      subject,
      body: message,
      processorContext: processor,
    });

    if (result.ok) {
      await writeAuditEntry({
        req,
        processorId: processor?.id,
        action: 'notification.manual_sent',
        targetType: 'job',
        targetLabel: tag,
        summary: `Sent manual ${channel} message for tag ${tag}`,
        details: {
          tag,
          channel,
          destination: result.destination,
          subject: channel === 'email' ? result.subject : null,
          preview: message.slice(0, 200),
        },
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(result, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
