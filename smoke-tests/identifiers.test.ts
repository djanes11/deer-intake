import assert from 'node:assert/strict';

import {
  confirmationSearchCandidates,
  identifierSettingsFromPublicCopy,
  normalizeConfirmationInput,
  normalizeTagInput,
  validateConfirmation,
  validateTag,
} from '../lib/identifiers.ts';

export function run() {
  const defaultSettings = identifierSettingsFromPublicCopy();
  assert.equal(normalizeConfirmationInput('123-456-789-0123', defaultSettings), '1234567890123');
  assert.equal(validateConfirmation('1234567890123', defaultSettings), '');

  const freeformSettings = identifierSettingsFromPublicCopy({
    confirmationValidation: 'freeform',
  } as any);
  assert.equal(normalizeConfirmationInput('AB  12  C', freeformSettings), 'AB 12 C');

  const tagSettings = identifierSettingsFromPublicCopy({
    tagFormat: 'letters_numbers',
    tagMinLength: 3,
  } as any);
  assert.equal(normalizeTagInput('ab-12*', tagSettings), 'AB-12');
  assert.equal(validateTag('AB-12', tagSettings), '');

  const digitsOnlySettings = identifierSettingsFromPublicCopy({
    confirmationValidation: 'digits_only',
  } as any);
  assert.deepEqual(confirmationSearchCandidates('1234567', digitsOnlySettings), ['1234567', '123456-7']);
}
