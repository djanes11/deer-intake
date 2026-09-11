import assert from 'node:assert/strict';
import { resolveOrderPrices } from '../lib/orderPrices.ts';
import { hasProcessorPermission } from '../lib/staffPermissions.ts';
import { confirmIntakePrint } from '../app/lib/browserPrint.ts';
import { subscribeStaffSessionRefresh } from '../lib/staffSessionRefresh.ts';
import { POST as syncSession } from '../app/api/staff/session/route.ts';

export async function run() {
  const saved = { processType: 'Standard', priceProcessing: 100, priceSpecialty: 30, price: 130,
    specialtyProducts: true, specialtyItems: [{ slug: 'sausage', quantity: 5, pricePerUnit: 6 }] };
  assert.equal(resolveOrderPrices({ ...saved, notes: 'Correct phone' }, saved, 120, 40).price, 130, 'Unchanged orders preserve historical prices');
  assert.equal(resolveOrderPrices({ ...saved, processType: 'Caped' }, saved, 160, 40).price, 190);
  assert.equal(resolveOrderPrices({ ...saved, addOnItems: [{ slug: 'fat', price: 20 }] }, saved, 120, 30).priceProcessing, 120);
  const withAddon = { ...saved, addOnItems: [{ slug: 'custom', price: 20, selected: true }], priceProcessing: 120 };
  assert.equal(resolveOrderPrices({ ...withAddon, addOnItems: [{ slug: 'custom', price: 20, selected: false }] }, withAddon, 100, 30).priceProcessing, 100);
  assert.equal(resolveOrderPrices({ ...saved, specialtyItems: [{ slug: 'sausage', quantity: 10, pricePerUnit: 6 }] }, saved, 100, 60).price, 160);
  assert.equal(resolveOrderPrices({ ...saved, specialtyProducts: false }, saved, 100, 30).price, 100);
  const overridden = { ...saved, processing_price_override: 80, priceProcessing: 80 };
  assert.equal(resolveOrderPrices({ ...overridden, processType: 'Caped' }, overridden, 160, 30).priceProcessing, 80);
  assert.equal(resolveOrderPrices({ ...overridden, processing_price_override: null }, overridden, 100, 30).priceProcessing, 100);
  assert.equal(resolveOrderPrices({ ...saved, price: 0, priceProcessing: 0 }, null, 100, 30).price, 130);
  for (const permission of ['view', 'print', 'edit_jobs'] as const) {
    assert.equal(hasProcessorPermission({ role: null, authType: 'supabase' }, permission), false);
    assert.equal(hasProcessorPermission({ role: 'admin', authType: 'none' }, permission), false);
  }
  assert.equal(hasProcessorPermission({ role: 'readonly', authType: 'supabase' }, 'view'), true);
  assert.equal(hasProcessorPermission({ role: 'readonly', authType: 'supabase' }, 'edit_jobs'), false);
  assert.equal(hasProcessorPermission({ role: 'staff', authType: 'local' }, 'print'), true);

  let event: (type: string, session: any) => void = () => {};
  let unsubscribed = false;
  const sent: any[] = [];
  let failOnce = true;
  const refresh = subscribeStaffSessionRefresh({ onAuthStateChange(callback) {
    event = callback;
    return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
  } }, (async (_url: any, init: any) => {
    if (failOnce) { failOnce = false; throw new Error('Temporary network failure'); }
    sent.push(JSON.parse(init.body));
    return new Response('{}');
  }) as typeof fetch, async () => {});
  event('INITIAL_SESSION', { access_token: 'original-token' });
  event('TOKEN_REFRESHED', { access_token: 'fresh-token' });
  await refresh.settled();
  assert.deepEqual(sent, [{ accessToken: 'original-token', refreshOnly: true }, { accessToken: 'fresh-token', refreshOnly: true }]);
  event('SIGNED_OUT', null);
  refresh.stop();
  event('TOKEN_REFRESHED', { access_token: 'after-unmount' });
  await refresh.settled();
  assert.equal(sent.length, 2);
  assert.equal(unsubscribed, true);
  const localResponse = await syncSession(new Request('http://localhost/api/staff/session', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'staff_local_session=local-test-token' },
    body: JSON.stringify({ refreshOnly: true, accessToken: 'fresh-token' }),
  }));
  assert.equal((await localResponse.json()).skipped, true);
  assert.equal(localResponse.headers.get('set-cookie'), null);

  // Exercise the actual print helper: closing preview is not proof of a successful print.
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  let afterPrint: () => void = () => {};
  let confirms = 0;
  try {
    const fake: any = {
      addEventListener: (_: string, callback: () => void) => { afterPrint = callback; },
      removeEventListener: () => {}, clearTimeout: () => {},
      requestAnimationFrame: (callback: () => void) => callback(),
      setTimeout: (callback: () => void, ms: number) => { if (ms < 120000) queueMicrotask(callback); return 1; },
      print: () => afterPrint(), confirm: () => { confirms++; return false; },
    };
    (globalThis as any).window = fake;
    (globalThis as any).document = { querySelector: () => null };
    assert.equal(await confirmIntakePrint(), false);
    fake.confirm = () => true;
    assert.equal(await confirmIntakePrint(3), true);
    fake.print = () => { throw new Error('Printer unavailable'); };
    fake.confirm = () => { throw new Error('Should not ask after a failure'); };
    assert.equal(await confirmIntakePrint(), false);
    assert.equal(confirms, 1);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  }
}
