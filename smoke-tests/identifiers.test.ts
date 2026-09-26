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
  assert.equal(normalizeConfirmationInput('001-234-567-890123', defaultSettings), '001234567890123');
  assert.equal(validateConfirmation('001234567890123', defaultSettings), '');
  assert.equal(validateConfirmation('1234567890123', defaultSettings), '');
  assert.equal(validateConfirmation('12345678901234', defaultSettings), 'Confirmation # must be 13 or 15 digits');
  assert.equal(validateConfirmation('123456789012', defaultSettings), 'Confirmation # must be 13 or 15 digits');
  for (const confirmationValidation of ['exact_13', 'exact_15', 'exact_13_or_15']) {
    const legacySettings = identifierSettingsFromPublicCopy({ confirmationValidation } as any);
    assert.equal(legacySettings.confirmationValidation, 'exact_13_or_15');
    assert.equal(normalizeConfirmationInput('001234567890123', legacySettings), '001234567890123');
    assert.equal(validateConfirmation('0012345678901', legacySettings), '');
    assert.equal(validateConfirmation('001234567890123', legacySettings), '');
  }
  assert.deepEqual(confirmationSearchCandidates('0012345678901', defaultSettings), ['0012345678901', '001234-5678901']);
  assert.deepEqual(confirmationSearchCandidates('001234567890123', defaultSettings), ['001234567890123', '001234-567890123']);

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
