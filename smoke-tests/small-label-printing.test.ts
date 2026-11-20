import assert from 'node:assert/strict';
import { buildSmallLabelSet, smallLabelXml, smallLabelData, sendSmallLabelSet, UncertainLabelPrintError, type SmallLabelFramework } from '../lib/smallLabelPrinting.ts';
import { isProtectedStaffPath } from '../lib/staffRouteAccess.ts';

export async function run() {
  const data = smallLabelData({ customer_name: 'Anne & O\'Connor <Jr>', tag: '10001', phone: '(555) 555-0100' });
  for (const count of [2, 3] as const) {
    const labels = buildSmallLabelSet(data, count);
    assert.equal(labels.length, count + 1);
    assert.equal(labels[0].heading, 'MEAT TAG');
    assert.equal(labels.filter(l => l.heading === 'PACKAGE LABEL').length, count);
    const xml = smallLabelXml(labels[0]);
    assert.match(xml, /Anne &amp; O&apos;Connor &lt;Jr&gt;/);
    assert.match(xml, /<Width>2<\/Width><Height>1<\/Height>/);
    assert.match(xml, /Tag 10001/);
  }
  assert.throws(() => buildSmallLabelSet({ ...data, tag: 'PENDING-1' }, 2));
  assert.throws(() => buildSmallLabelSet({ ...data, customer: '' }, 2));
  assert.throws(() => buildSmallLabelSet(data, 20 as 2));
  assert.equal(isProtectedStaffPath('/staff/label-printing', true), true);
  for (const scenario of ['ok', 'render-failure', 'print-failure', 'disconnected', 'unauthorized', 'expired-mid-set']) {
    const calls: string[] = [];
    let sends = 0, checks = 0;
    const sdk: SmallLabelFramework = {
      init: cb => cb(),
      getPrintersAsync: async () => [{ name: 'Twin', isConnected: scenario !== 'disconnected', isTwinTurbo: true, isLocal: true }],
      renderLabelAsync: async xml => { calls.push('render'); if (scenario === 'render-failure' && xml.includes('PACKAGE LABEL')) throw Error('render'); return 'png'; },
      createLabelWriterPrintParamsXml: params => { assert.equal(params.twinTurboRoll, 'Right'); assert.equal(params.copies, 1); return ''; },
      printLabelAsync: async () => { calls.push('print'); sends++; if (scenario === 'print-failure' && sends === 2) throw Error('lost response'); return undefined; },
    };
    const send = () => sendSmallLabelSet(sdk, { printer: 'Twin', roll: 'Right', packages: 3 }, buildSmallLabelSet(data, 3), async () => {
      checks++;
      if (scenario === 'unauthorized' || (scenario === 'expired-mid-set' && checks === 3)) throw Error('session');
    });
    if (scenario === 'ok') {
      assert.equal(await send(), 4);
      assert.deepEqual(calls, ['render', 'render', 'render', 'render', 'print', 'print', 'print', 'print']);
    } else {
      await assert.rejects(send, scenario === 'print-failure' || scenario === 'expired-mid-set' ? UncertainLabelPrintError : Error);
      assert.equal(sends, scenario === 'print-failure' ? 2 : scenario === 'expired-mid-set' ? 1 : 0);
    }
  }
}
