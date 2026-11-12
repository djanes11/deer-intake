import assert from 'node:assert/strict';
import { normRow, needsTagPayment, processingDue, sortNeedsTagRows } from '../lib/needsTagQueue.ts';

export function run() {
  const paid = normRow({ id: 'a', tag: 'PENDING-A', customer_name: 'Zoe', webbs_order: true, process_type: 'Caped', price_processing: 170, amount_paid_processing: 170, price_specialty: 60, created_at: '2026-11-11T12:00:00-05:00' });
  const partial = normRow({ id: 'b', tag: 'PENDING-B', customer_name: 'Alex', webbs_order: false, webbs: true, process_type: 'European', price_processing: 145, amount_paid_processing: 50, created_at: '2026-11-11T16:00:00Z' });
  const zero = normRow({ id: 'c', price_processing: 0, process_type: 'Donate', webbs_order: 'false' });
  assert.equal(paid.webbs, true);
  assert.equal(partial.webbs, false, 'The current saved flag overrides a legacy flag');
  assert.equal(zero.webbs, false);
  assert.equal(paid.processType, 'Caped');
  assert.equal(needsTagPayment(paid), 'Paid', 'Specialty balance does not change processing payment status');
  assert.equal(needsTagPayment(partial), 'Part paid');
  assert.equal(processingDue(partial), 95);
  assert.equal(needsTagPayment(zero), 'No charge');
  assert.equal(needsTagPayment(normRow({ price_processing: 145, amount_paid_processing: 0 })), 'Unpaid');
  const rows = [paid, partial, zero];
  assert.deepEqual(sortNeedsTagRows(rows, 'created_at', 'desc').map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(sortNeedsTagRows(rows, 'created_at', 'asc').map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(sortNeedsTagRows(rows, 'customer_name', 'asc').map(r => r.id), ['b', 'a', 'c']);
  assert.equal(sortNeedsTagRows(rows, 'webbs', 'desc')[0], paid);
  assert.deepEqual(sortNeedsTagRows(rows, 'processingPayment', 'asc').map(r => r.id), ['c', 'a', 'b']);
  assert.deepEqual(rows.map(r => r.id), ['a', 'b', 'c'], 'Sorting does not mutate the original queue');
  assert.equal(sortNeedsTagRows(rows, 'customer_name', 'asc')[0].tag, 'PENDING-B', 'Row identity for assigning tags is retained');
}
