import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { normalizePublicIntakeName, publicIntakeNameError } from '../lib/publicIntakeName.ts';

import {
  classifyPublicIntakeSaveError,
  makePendingPublicTag,
  makePublicIntakeToken,
  PUBLIC_DROP_RATE_LIMIT,
} from '../lib/publicIntakeSafety.ts';

export function run() {
  for (const name of ['', ' ', 'John', ' John  ', "O’Connor", 'Anne-Marie']) {
    assert.equal(publicIntakeNameError(name), 'Please enter both your first and last name.');
  }
  for (const name of ['John Smith', '  John   Smith  ', "Anne-Marie O’Connor", 'J. Smith', 'María de la Cruz', '李 明', 'John\tSmith']) {
    assert.equal(publicIntakeNameError(name), null);
  }
  assert.equal(normalizePublicIntakeName('  John \t Smith  '), 'John Smith');

  // Confirm the public API enforces the same rule, independently of browser checks.
  const source = ts.createSourceFile('route.ts', fs.readFileSync('app/api/public-drop/route.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['publicValidationError', 'hasText', 'is10Digits', 'digitsOnly'];
  const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text || ''));
  assert.equal(functions.length, names.length);
  const code = ts.transpileModule(functions.map(n => n.getText(source)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const validate = new Function('publicIntakeNameError', code + '\nreturn publicValidationError;')(publicIntakeNameError);
  const valid = { customer: 'John Smith', phone: '5555550100', address: '123 Test Street', city: 'Test', state: 'KY', zip: '40000', county: 'Test', dropoff: '2026-11-11', sex: 'Buck', howKilled: 'Rifle', processType: 'Standard Processing' };
  assert.equal(validate(valid), null);
  assert.equal(validate({ ...valid, customer: 'John ' }), 'Please enter both your first and last name.');

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
