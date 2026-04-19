import assert from 'node:assert/strict';

import {
  defaultPublicSiteSettings,
  normalizeHours,
  normalizeProcessorFeatures,
  normalizePublicCopy,
} from '../lib/siteSettings.ts';

export function run() {
  const basic = normalizeProcessorFeatures({ plan: 'basic', smsEnabled: true, webbsEnabled: true });
  assert.equal(basic.smsEnabled, false);
  assert.equal(basic.webbsEnabled, false);

  const custom = normalizeProcessorFeatures({ plan: 'custom' });
  assert.equal(custom.specialtyEnabled, true);

  const copy = normalizePublicCopy({
    acceptedPaymentMethods: ['cash', 'card', 'bad-value'],
    faqItems: [{ question: 'Q', answer: 'A' }, { question: '', answer: '' }],
  });
  assert.deepEqual(copy.acceptedPaymentMethods, ['cash', 'card']);
  assert.equal(copy.faqItems.length, 1);

  const defaults = defaultPublicSiteSettings();
  assert.deepEqual(normalizeHours([]), defaults.hours);
}
