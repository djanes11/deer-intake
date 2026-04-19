import assert from 'node:assert/strict';

import { listStateFormOptions, normalizeStateFormType } from '../lib/stateforms/catalog.ts';
import { getStateFormDefinition } from '../lib/stateforms/registry.ts';

export function run() {
  const options = listStateFormOptions();
  assert.deepEqual(options.map((item) => item.value), ['indiana', 'ohio', 'michigan']);
  assert.equal(normalizeStateFormType('unknown'), 'indiana');

  for (const option of options) {
    assert.ok(getStateFormDefinition(option.value));
  }
}
