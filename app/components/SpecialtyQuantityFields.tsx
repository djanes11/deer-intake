'use client';

import type { SpecialtyCatalogItem } from '@/lib/specialtyCatalog';
import { specialtyMeatLbs, specialtyMeatRatio, SPECIALTY_YIELD_NOTICE } from '@/lib/specialtyYield';

export default function SpecialtyQuantityFields({ items, quantity, onChange }: {
  items: SpecialtyCatalogItem[];
  quantity: (item: SpecialtyCatalogItem) => number;
  onChange: (slug: string, meatLbs: string) => void;
}) {
  return <div>
    <p style={{ background: '#fff3cd', color: '#513c06', padding: 12, borderRadius: 8, fontWeight: 600 }}>{SPECIALTY_YIELD_NOTICE}</p>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 340, borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Product</th><th>Approx. meat lb needed</th><th>Take-home lb</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.slug}>
          <td style={{ padding: '12px 6px' }}>{item.name}<div className="muted">${item.price.toFixed(2)}/take-home lb</div><small>{specialtyMeatRatio(item)} lb meat → 1 lb take-home</small></td>
          <td style={{ padding: 6, width: '28%' }}><input type="number" min="0" step="1" inputMode="numeric" aria-label={`${item.name}: approx. meat lb needed`} value={specialtyMeatLbs(item, quantity(item)) || ''} onChange={e => onChange(item.slug, e.target.value)} placeholder="0" style={{ width: '100%', minWidth: 60 }} /></td>
          <td style={{ textAlign: 'center', fontWeight: 700 }}><output aria-label={`${item.name}: take-home lb`}>{quantity(item)}</output></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
