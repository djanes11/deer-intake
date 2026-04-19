import assert from 'node:assert/strict';

import {
  calcCatalogProcessingPrice,
  defaultAddOnCatalog,
  defaultProcessCatalog,
  deriveSelectedAddOnItems,
  filterProcessCatalogBySex,
  filterVisibleAddOnItems,
  normalizeNotificationTemplates,
} from '../lib/processorCatalog.ts';

export function run() {
  const filtered = filterProcessCatalogBySex(defaultProcessCatalog(), 'Doe');
  assert.equal(filtered.some((item) => item.slug === 'caped'), false);
  assert.equal(filtered.some((item) => item.slug === 'donate'), true);

  const selected = deriveSelectedAddOnItems(
    { beefFat: true, webbsOrder: false },
    defaultAddOnCatalog(),
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].slug, 'beef-fat');

  const visible = filterVisibleAddOnItems(defaultAddOnCatalog(), true);
  assert.equal(visible.some((item) => item.slug === 'webbs-order'), false);

  const total = calcCatalogProcessingPrice(
    { processType: 'Standard Processing', beefFat: true },
    [
      {
        slug: 'standard-processing',
        name: 'Standard Processing',
        basePrice: 130,
        pricingMode: 'flat',
        pricePerLb: 0,
        minimumPrice: 0,
        active: true,
        sortOrder: 10,
        triggersCapeWorkflow: false,
        donationOnly: false,
        allowBuck: true,
        allowDoe: true,
      },
    ],
    [
      {
        slug: 'beef-fat',
        name: 'Beef Fat',
        price: 5,
        active: true,
        sortOrder: 10,
        legacyBooleanKey: 'beefFat',
      },
    ],
  );
  assert.equal(total, 135);

  const templates = normalizeNotificationTemplates({}, 'Pilot Shop');
  assert.match(templates.meat_finished.emailBody, /\{\{pickupHours\}\}/);
}
