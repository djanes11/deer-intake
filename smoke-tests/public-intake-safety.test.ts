import assert from 'node:assert/strict';

import {
  classifyPublicIntakeSaveError,
  makePendingPublicTag,
  makePublicIntakeToken,
  PUBLIC_DROP_RATE_LIMIT,
} from '../lib/publicIntakeSafety.ts';

export function run() {
  assert.equal(PUBLIC_DROP_RATE_LIMIT.limit, 60);
  assert.equal(PUBLIC_DROP_RATE_LIMIT.windowMs, 60_000);

  assert.equal(
    classifyPublicIntakeSaveError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "jobs_confirmation_unique_idx"',
      details: 'Key (confirmation)=(2608231234567) already exists.',
    }),
    'duplicate_confirmation'
  );

  assert.equal(
    classifyPublicIntakeSaveError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "jobs_public_token_unique_idx"',
      details: 'Key (public_token)=(abc) already exists.',
    }),
    'retry_public_token'
  );

  assert.equal(
    classifyPublicIntakeSaveError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "jobs_processor_tag_unique_idx"',
    }),
    'retry_pending_tag'
  );

  const tags = new Set<string>();
  const tokens = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    tags.add(makePendingPublicTag(`260823${String(i).padStart(7, '0')}`));
    tokens.add(makePublicIntakeToken());
  }

  assert.equal(tags.size, 500);
  assert.equal(tokens.size, 500);
}
