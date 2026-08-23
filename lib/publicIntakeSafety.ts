import crypto from 'crypto';

export const PUBLIC_DROP_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
} as const;

export type PublicIntakeSaveError =
  | 'duplicate_confirmation'
  | 'retry_public_token'
  | 'retry_pending_tag'
  | 'fatal';

export function makePublicIntakeToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function makePendingPublicTag(confirmation13: string) {
  const last5 = String(confirmation13 ?? '').replace(/\D/g, '').slice(-5) || '00000';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PENDING-${last5}-${ts}-${rand}`;
}

function uniqueViolationText(error: any) {
  return [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
    error?.constraint,
    error?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function classifyPublicIntakeSaveError(error: any): PublicIntakeSaveError {
  if (error?.code !== '23505') return 'fatal';

  const text = uniqueViolationText(error);
  if (text.includes('confirmation') || text.includes('jobs_confirmation_unique_idx')) {
    return 'duplicate_confirmation';
  }
  if (text.includes('public_token') || text.includes('jobs_public_token_unique_idx')) {
    return 'retry_public_token';
  }
  if (text.includes('processor_tag') || text.includes('jobs_processor_tag_unique_idx') || text.includes('(tag)')) {
    return 'retry_pending_tag';
  }

  return 'fatal';
}
