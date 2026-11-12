import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { processingPaymentLabel, sortPickupRows, type PickupSortRow } from '../lib/pickupQueueSort.ts';

export async function run() {
  const base: PickupSortRow = { tag: '10', customer: 'Alex', track: 'meat', processType: 'Caped', webbsOrder: true, priceProc: 170, procDue: 0, totalDue: 60, priceSpec: 60 };
  assert.equal(processingPaymentLabel(base), 'Paid', 'Specialty debt does not make processing unpaid');
  assert.equal(processingPaymentLabel({ ...base, procDue: 70 }), 'Part paid');
  assert.equal(processingPaymentLabel({ ...base, procDue: 170 }), 'Unpaid');
  assert.equal(processingPaymentLabel({ ...base, priceProc: 0 }), 'No charge');
  const rows = [base, { ...base, tag: '2', totalDue: 9, webbsOrder: false, processType: 'Standard Processing' }];
  assert.deepEqual(sortPickupRows(rows, 'tag', 'asc').map(r => r.tag), ['2', '10']);
  assert.deepEqual(sortPickupRows(rows, 'totalDue', 'desc').map(r => r.tag), ['10', '2']);
  assert.deepEqual(sortPickupRows(rows, 'webbsOrder', 'asc').map(r => r.tag), ['2', '10']);
  assert.deepEqual(sortPickupRows(rows, 'processType', 'asc').map(r => r.tag), ['10', '2']);
  assert.equal(rows[0], base, 'Sorting must not mutate the queue or its row identities');
  const dates = [
    { ...base, tag: '1', calledAt: '2026-11-11T12:00:00-05:00' },
    { ...base, tag: '2', readyAt: '2026-11-11T16:00:00Z' },
    { ...base, tag: '3' },
  ];
  assert.deepEqual(sortPickupRows(dates, 'called', 'asc').map(r => r.tag), ['2', '1', '3']);
  assert.deepEqual(sortPickupRows(dates, 'called', 'desc').map(r => r.tag), ['1', '2', '3']);
  assert.deepEqual(sortPickupRows(dates, 'waiting', 'desc').map(r => r.tag), ['2', '1', '3']);

  // Exercise the queue's actual API mapping and payment refresh, not copies of that logic.
  const source = ts.createSourceFile('page.tsx', fs.readFileSync('app/reports/called/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['fetchCalled', 'remaining', 'isCalled', 'isReadyLike', 'mergePaymentUpdate'];
  const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text || ''));
  assert.equal(functions.length, names.length);
  const code = ts.transpileModule(functions.map(n => n.getText(source)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const apiRows = [
    { tag: '10', customer: 'Alex', status: 'Finished', capingStatus: 'Caped', webbsStatus: 'Delivered', processType: 'Caped', webbsOrder: true, priceProcessing: 170, priceSpecialty: 60, amountPaidProcessing: 170 },
    { tag: '11', status: 'Called', processType: 'Standard Processing', priceProcessing: 0, priceSpecialty: 0, specialtyProducts: [{ name: 'Snack sticks', qty: 10 }] },
  ];
  const actual = new Function('searchJobs', code + '\nreturn { fetchCalled, mergePaymentUpdate };')(async (query: string) => { assert.equal(query, '@recall'); return { rows: apiRows }; });
  const queue = await actual.fetchCalled();
  assert.equal(queue.length, 4);
  const tracks = queue.filter((r: any) => r.tag === '10');
  assert.deepEqual(tracks.map((r: any) => r.track), ['meat', 'cape', 'webbs']);
  for (const row of tracks) {
    assert.equal(row.processType, 'Caped'); assert.equal(row.webbsOrder, true);
    assert.equal(processingPaymentLabel(row), 'Paid');
  }
  assert.equal(tracks[0].totalDue, 60);
  const zero = queue.find((r: any) => r.tag === '11');
  assert.equal(zero.totalDue, 0, 'Saved zero overrides must not be replaced by guessed prices');
  assert.equal(processingPaymentLabel(zero), 'No charge');
  const refreshed = actual.mergePaymentUpdate(tracks[0], { amountPaidProcessing: 100 });
  assert.equal(processingPaymentLabel(refreshed), 'Part paid');
  assert.equal(refreshed.totalDue, 130);
  assert.equal(refreshed.processType, 'Caped'); assert.equal(refreshed.webbsOrder, true);
}
