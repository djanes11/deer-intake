import assert from 'node:assert/strict';
import { antlerBarcode, antlerLabelXml, antlerRoll, directAntlerEligible, sendAntlerLabel } from '../lib/antlerLabelPrinting.ts';
import { UncertainLabelPrintError, type SmallLabelFramework } from '../lib/smallLabelPrinting.ts';

export async function run() {
  const job = { tag: '10001', customer: 'Sample & Customer', phone: '5555550100', confirmation: '123456789012345', processType: 'Caped' };
  for (const processType of ['Caped', 'Cape & Donate', 'Caped and Donate', 'Skull-cap', 'European']) assert.equal(directAntlerEligible({ processType }), true);
  for (const processType of ['Standard', 'Donate', '', 'Skinned']) assert.equal(directAntlerEligible({ processType, sex: 'Buck' }), false);
  assert.equal(antlerRoll({ printer: 'Twin', roll: 'Left', packages: 2 }), 'Right');
  assert.equal(antlerRoll({ printer: 'Twin', roll: 'Right', packages: 2 }), 'Left');
  const xml = antlerLabelXml(job, 'Shop');
  assert.ok(xml.startsWith('<?xml'));
  assert.match(xml, /<LabelName>LargeShipping1763982<\/LabelName>/);
  assert.match(xml, /<Orientation>Portrait<\/Orientation>/);
  assert.match(xml, /Sample &amp; Customer/);
  assert.match(xml, /CUT OFF BARCODE/);
  assert.match(xml, /<Name>CUTOFF_TAG<\/Name>/);
  assert.match(xml, /Tag 10001/);
  assert.throws(() => antlerLabelXml({ ...job, processType: 'Standard' }));
  assert.throws(() => antlerLabelXml({ ...job, tag: 'PENDING-1' }));
  for (const tag of ['10001', '12345678', '123456789012345']) {
    const barcode = antlerBarcode(tag);
    assert.ok(barcode.module >= 2 && Number.isInteger(barcode.module));
    assert.ok(barcode.start - 10 * barcode.module / 300 >= 0.056666665);
    assert.ok(barcode.start + (barcode.bits.length + 10) * barcode.module / 300 < 2.273334);
  }
  for (const scenario of ['ok', 'render-error', 'send-error', 'disconnected', 'expired']) {
    let sent = 0, rendered = 0, checks = 0;
    const sdk: SmallLabelFramework = {
      init: cb => cb(),
      getPrintersAsync: async () => [{ name: 'Twin', isConnected: scenario !== 'disconnected', isLocal: true, isTwinTurbo: true }],
      renderLabelAsync: async () => { rendered++; if (scenario === 'render-error') throw Error('render'); return 'png'; },
      createLabelWriterPrintParamsXml: params => { assert.equal(params.twinTurboRoll, 'Right'); assert.equal(params.printQuality, 'BarcodeAndGraphics'); assert.equal(params.copies, 1); return ''; },
      printLabelAsync: async () => { sent++; assert.equal(rendered, 1); if (scenario === 'send-error') throw Error('ambiguous'); return undefined; },
    };
    const send = () => sendAntlerLabel(sdk, { printer: 'Twin', roll: 'Left', packages: 2 }, job, 'Shop', async () => { checks++; if (scenario === 'expired' && checks === 2) throw Error('session'); });
    if (scenario === 'ok') await send();
    else await assert.rejects(send, scenario === 'send-error' ? UncertainLabelPrintError : Error);
    assert.equal(sent, scenario === 'ok' || scenario === 'send-error' ? 1 : 0);
  }
}
