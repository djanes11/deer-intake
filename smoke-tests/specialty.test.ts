import assert from 'node:assert/strict';

import { specialtyBreakdown, specialtyTotalLbs } from '../lib/specialty.ts';

export function run() {
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
