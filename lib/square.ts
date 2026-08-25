import 'server-only';

import crypto from 'crypto';

export type SquareEnvironment = 'sandbox' | 'production';

export type SquareConfig = {
  environment: SquareEnvironment;
  accessToken: string;
  applicationId: string;
  locationId: string;
  apiBaseUrl: string;
  apiVersion: string;
};

export type SquarePaymentLinkResult = {
  paymentLinkId: string;
  orderId: string;
  url: string;
  longUrl: string;
  raw: any;
};

export const SQUARE_ONLINE_PAYMENT_FEE_CENTS = 600;

function clean(value: unknown) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

export function getSquareConfig(): SquareConfig {
  const environment = clean(process.env.SQUARE_ENVIRONMENT).toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
  const accessToken = clean(process.env.SQUARE_ACCESS_TOKEN);
  const applicationId = clean(process.env.SQUARE_APPLICATION_ID);
  const locationId = clean(process.env.SQUARE_LOCATION_ID);

  if (!accessToken || !applicationId || !locationId) {
    throw new Error('Square is not configured yet.');
  }

  return {
    environment,
    accessToken,
    applicationId,
    locationId,
    apiBaseUrl: environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com',
    apiVersion: clean(process.env.SQUARE_API_VERSION) || '2026-08-19',
  };
}

export function squareMoneyCents(value: unknown) {
  const n = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

export async function createSquareProcessingPaymentLink(params: {
  idempotencyKey: string;
  amountCents: number;
  customerName: string;
  confirmation: string;
  tag?: string | null;
  redirectUrl: string;
  note: string;
}): Promise<SquarePaymentLinkResult> {
  const config = getSquareConfig();
  const amountCents = Math.max(0, Math.trunc(params.amountCents));
  if (amountCents <= 0) {
    throw new Error('Processing payment amount must be greater than zero.');
  }

  const labelBits = [
    'Regular Processing + Online Payment Fee',
    params.customerName || 'Customer',
    params.confirmation ? `Conf ${params.confirmation}` : '',
  ].filter(Boolean);

  const resp = await fetch(`${config.apiBaseUrl}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      'Square-Version': config.apiVersion,
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotency_key: params.idempotencyKey,
      description: labelBits.join(' - '),
      quick_pay: {
        name: labelBits.join(' - ').slice(0, 255),
        price_money: {
          amount: amountCents,
          currency: 'USD',
        },
        location_id: config.locationId,
      },
      checkout_options: {
        redirect_url: params.redirectUrl,
      },
      payment_note: params.note.slice(0, 500),
    }),
  });

  const raw = await resp.json().catch(() => ({}));
  if (!resp.ok || raw?.errors?.length) {
    const message = raw?.errors?.[0]?.detail || raw?.errors?.[0]?.code || `Square payment link failed (${resp.status})`;
    throw new Error(message);
  }

  const link = raw?.payment_link || {};
  const url = String(link.url || link.long_url || '').trim();
  const orderId = String(link.order_id || '').trim();
  const paymentLinkId = String(link.id || '').trim();
  if (!url || !orderId || !paymentLinkId) {
    throw new Error('Square did not return a usable checkout link.');
  }

  return {
    paymentLinkId,
    orderId,
    url,
    longUrl: String(link.long_url || ''),
    raw,
  };
}

export function verifySquareWebhookSignature(params: {
  signature: string | null;
  body: string;
  notificationUrl: string;
  signatureKey?: string | null;
}) {
  const signature = clean(params.signature);
  const signatureKey = clean(params.signatureKey || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  const notificationUrl = clean(params.notificationUrl);
  if (!signature || !signatureKey || !notificationUrl) return false;

  const expected = crypto
    .createHmac('sha256', signatureKey)
    .update(`${notificationUrl}${params.body}`)
    .digest('base64');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
