import assert from 'node:assert/strict';
import { requireFreshJob, validateJobPatch, operationalPayload } from '../lib/jobWriteSafety.ts';
import { publicIntakeInput } from '../lib/publicIntakeInput.ts';
import { defaultPublicSiteSettings } from '../lib/siteSettings.ts';
import { calcCatalogProcessingPrice } from '../lib/processorCatalog.ts';
import { specialtyPrice } from '../lib/specialty.ts';

export function run() {
  const settings = defaultPublicSiteSettings();
  const process = settings.processCatalog.find((item) => item.active && !item.donationOnly)!;
  const specialty = settings.specialtyCatalog[0];
  const addon = settings.addOnCatalog.find((item) => item.active)!;
  const clean = publicIntakeInput({
    processType: process.name, customer: ' Test Hunter ', sex: 'Buck',
    id: 'victim-id', processor_id: 'other-shop', tag: 'other-tag', publicToken: 'chosen-token',
    status: 'Picked Up', capingStatus: 'Called', specialtyStatus: 'Finished',
    priceProcessing: 0, processing_price_override: 0, price: 0,
    paidProcessing: true, amountPaidProcessing: 9999, pickedUpProcessing: true,
    dropoffEmailSentAt: '2026-09-11', publicLinkSentAt: '2026-09-11',
    specialtyProducts: true,
    specialtyItems: [{ slug: specialty.slug, quantity: 3, pricePerUnit: 0, total: 0, id: 'other-item', catalogId: 'other-catalog' }],
    beefFat: true, webbsOrder: true,
    addOnItems: [{ slug: addon.slug, selected: true, price: -1000, name: 'Free' }],
  }, settings);
  for (const key of ['id', 'processor_id', 'tag', 'publicToken', 'priceProcessing', 'processing_price_override',
    'price', 'paidProcessing', 'amountPaidProcessing', 'pickedUpProcessing', 'dropoffEmailSentAt', 'publicLinkSentAt']) {
    assert.equal(Object.hasOwn(clean, key), false, `${key} must not cross the public boundary`);
  }
  assert.equal(clean.customer, 'Test Hunter');
  assert.equal(clean.status, 'Dropped Off');
  assert.equal(clean.specialtyStatus, 'Dropped Off');
  assert.equal(clean.specialtyItems[0].id, undefined);
  assert.equal(specialtyPrice(clean, settings.pricing), specialty.price * 3);
  const price = calcCatalogProcessingPrice(clean, settings.processCatalog, settings.addOnCatalog);
  assert.ok(price >= process.basePrice);
  for (const item of clean.addOnItems) assert.equal(item.price, settings.addOnCatalog.find((entry) => entry.slug === item.slug)?.price);
  assert.throws(() => publicIntakeInput({ processType: 'invented free process' }, settings));
  const disabled = publicIntakeInput({ processType: process.name, specialtyProducts: true, webbsOrder: true,
    specialtyItems: [{ slug: specialty.slug, quantity: 3 }] }, {
    ...settings, features: { ...settings.features, specialtyEnabled: false, webbsEnabled: false },
  });
  assert.equal(disabled.specialtyProducts, false);
  assert.equal(disabled.webbsOrder, false);

  const existing = { id: 'a', tag: '12345', updatedAt: 'v2' } as any;
  assert.throws(() => requireFreshJob({ tag: '12345' }, existing, 'update'), /Reload/);
  assert.throws(() => requireFreshJob({ id: 'a', tag: '12345', updatedAt: 'v1' }, existing, 'update'), /another station/);
  assert.throws(() => requireFreshJob({ id: 'other', tag: '12345', updatedAt: 'v2' }, existing, 'update'));
  assert.doesNotThrow(() => requireFreshJob({ id: 'a', tag: '12345', updatedAt: 'v2' }, existing, 'update'));
  assert.throws(() => validateJobPatch({ tag: '12345', customer: 'Replace customer' }), /intake editor/);
  assert.doesNotThrow(() => validateJobPatch({ tag: '12345', status: 'Picked Up', pickedUpProcessing: true }));
  assert.deepEqual(operationalPayload({ tag: '12345', callNotes: 'Called' }, {
    tag: '12345', call_notes: 'Called', amount_paid_processing: 0, price_processing: 0, status: 'Dropped Off',
  }), { tag: '12345', call_notes: 'Called' });
}
