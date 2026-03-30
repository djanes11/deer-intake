import 'server-only';

type SendSmsOpts = {
  to: string;
  body: string;
};

export type SmsSendResult =
  | { ok: true; sid: string; to: string; status: string | null; mode: 'live' }
  | { ok: false; error: string; code: string; to: string | null; mode: 'blocked' | 'disabled' };

function digitsOnly(v: string) {
  return String(v || '').replace(/\D/g, '');
}

export function normalizeUsPhone(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (String(phone || '').trim().startsWith('+') && digits.length >= 11) return `+${digits}`;
  return '';
}

function smsEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.TWILIO_SMS_ENABLED || '').trim().toLowerCase());
}

function smsAllowlist() {
  return String(process.env.TWILIO_SMS_ALLOWLIST || '')
    .split(',')
    .map((v) => normalizeUsPhone(v))
    .filter(Boolean);
}

export function canSendSmsTo(phone: string) {
  const normalized = normalizeUsPhone(phone);
  if (!normalized) return { ok: false as const, code: 'invalid-phone', to: null };

  if (!smsEnabled()) {
    return { ok: false as const, code: 'sms-disabled', to: normalized };
  }

  const allowlist = smsAllowlist();
  if (allowlist.length && !allowlist.includes(normalized)) {
    return { ok: false as const, code: 'not-allowlisted', to: normalized };
  }

  return { ok: true as const, to: normalized };
}

export async function sendSms(opts: SendSmsOpts): Promise<SmsSendResult> {
  const gate = canSendSmsTo(opts.to);
  if (!gate.ok) {
    return {
      ok: false,
      error:
        gate.code === 'sms-disabled'
          ? 'SMS sending is disabled.'
          : gate.code === 'not-allowlisted'
            ? 'Phone number is not on the SMS allowlist.'
            : 'Phone number is invalid.',
      code: gate.code,
      to: gate.to,
      mode: gate.code === 'sms-disabled' ? 'disabled' : 'blocked',
    };
  }

  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = normalizeUsPhone(String(process.env.TWILIO_FROM_NUMBER || '').trim());
  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error: 'Missing Twilio env vars.',
      code: 'missing-env',
      to: gate.to,
      mode: 'blocked',
    };
  }

  const twilio = (await import('twilio')).default;
  const client = twilio(accountSid, authToken);
  const msg = await client.messages.create({
    from,
    to: gate.to,
    body: String(opts.body || '').trim(),
  });

  return {
    ok: true,
    sid: String(msg.sid),
    to: gate.to,
    status: msg.status ?? null,
    mode: 'live',
  };
}
