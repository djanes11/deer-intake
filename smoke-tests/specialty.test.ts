import assert from 'node:assert/strict';

import { specialtyBreakdown, specialtyTotalLbs } from '../lib/specialty.ts';
import { specialtyMeatLbs, specialtyTakeHomeLbs } from '../lib/specialtyYield.ts';
import { defaultPublicSiteSettings } from '../lib/siteSettings.ts';
import { publicIntakeInput } from '../lib/publicIntakeInput.ts';
import { normalizeJobSpecialtyItems } from '../lib/specialtyCatalog.ts';

export function run() {
  const settings = defaultPublicSiteSettings();
  const selections = settings.specialtyCatalog.map(item => {
    const quantity = specialtyTakeHomeLbs(item, 5);
    assert.equal(quantity, /snack/i.test(item.name) ? 2.5 : 5);
    assert.equal(specialtyMeatLbs(item, quantity), 5);
    return { ...item, quantity, pricePerUnit: 999, total: 999 };
  });
  const validated = publicIntakeInput({
    sex: 'Buck', processType: settings.processCatalog.find(item => item.active && !/donat/i.test(item.name))!.name,
    specialtyProducts: true, specialtyItems: selections,
  }, settings);
  const saved = normalizeJobSpecialtyItems(validated.specialtyItems);
  assert.equal(saved.length, selections.length);
  for (const item of saved) {
    const catalogItem = settings.specialtyCatalog.find(entry => entry.slug === item.slug)!;
    assert.equal(item.total, item.quantity * catalogItem.price, 'Server charges for take-home pounds at catalog price');
    assert.equal(specialtyMeatLbs(item, item.quantity), 5, 'Saved order restores meat input without converting twice');
  }
  assert.equal(specialtyMeatLbs({ name: 'Snack Sticks' }, 10), 20, 'Existing take-home orders retain their quantity');
  const savedOnly = specialtyBreakdown(
    {
      specialtyProducts: true,
      specialtyItems: [
        {
          slug: 'maple-breakfast-links',
          name: 'Maple Breakfast Links',
          shortName: 'Maple Links',
          unit: 'lb',
          priceType: 'per_lb',
          quantity: 12,
          pricePerUnit: 6,
          total: 72,
          sortOrder: 50,
        },
      ],
    },
    null,
    [
      {
        slug: 'original-summer-sausage',
        name: 'Original Summer Sausage',
        shortName: 'Original SS',
        unit: 'lb',
        priceType: 'per_lb',
        price: 5,
        active: true,
        sortOrder: 10,
      },
    ],
  ).filter((item) => item.pounds > 0);

  assert.equal(savedOnly.length, 1);
  assert.equal(savedOnly[0].label, 'Maple Breakfast Links');
  assert.equal(savedOnly[0].pounds, 12);

  const totalOnly = { specialtyProducts: true, specialtyPounds: 18, priceSpecialty: 90 };
  assert.equal(specialtyTotalLbs(totalOnly), 18);
  assert.equal(specialtyBreakdown(totalOnly).filter((item) => item.pounds > 0)[0].label, 'Specialty Order');
}
