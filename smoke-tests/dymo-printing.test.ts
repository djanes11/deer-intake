import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { rollFor, labelData, labelArtwork, emptyDymoSettings } from '../lib/dymoPrinting.ts';

export async function run() {
  assert.equal(rollFor('deer', emptyDymoSettings), 'Left');
  assert.equal(rollFor('antler', emptyDymoSettings), 'Right');
  assert.equal(rollFor('antler', { ...emptyDymoSettings, meatRoll: 'Right' }), 'Left');
  assert.equal(labelData({ Tag: ' 123456 ', Customer: 'Alex & Sam' }).customer, 'Alex & Sam');
  // Exercise the real JsBarcode renderer against a small canvas mock, checking
  // that its complete bitmap (including quiet zones/margins) fits the strip.
  const previousDocument = globalThis.document;
  const drawings: any[] = [];
  (globalThis as any).document = { createElement() {
    const canvas: any = { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,test' };
    const ctx = {
      font: '', fillStyle: '', textBaseline: '', lineWidth: 1,
      save() {}, restore() {}, clearRect() {}, fillRect() {}, translate() {}, fillText() {},
      setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      measureText(text: string) { return { width: text.length * 18 }; },
      drawImage(image: any, x: number, y: number) { drawings.push({ imageWidth: image.width, imageHeight: image.height, x, y, width: canvas.width, height: canvas.height }); },
    };
    canvas.getContext = () => ctx;
    return canvas;
  } };
  try {
    labelArtwork({ tag: '494123', customer: 'Sample Customer', phone: '555-555-0100', processType: 'Caped' }, 'antler', 'Shop');
    assert.equal(drawings.length, 1);
    const d = drawings[0];
    assert.ok(d.x >= 0 && d.x + d.imageWidth <= d.width);
    assert.ok(d.y + d.imageHeight < d.height - 20, 'Barcode must fit with a bottom margin, not be cut off');
    labelArtwork({ tag: '494123', customer: 'Sample Customer', phone: '555-555-0100' }, 'deer', 'Shop');
    assert.equal(drawings.length, 1, 'The meat tag has no barcode');
    assert.throws(() => labelArtwork({ tag: 'PENDING-123' }, 'deer', ''), /real tag/);
  } finally { (globalThis as any).document = previousDocument; }
  const source = ts.createSourceFile('dymoPrinting.ts', fs.readFileSync('lib/dymoPrinting.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sendDymoLabels')!;
  const code = ts.transpileModule(node.getText(source).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const send = new Function('validateTemplate', 'rollFor', code + ';return sendDymoLabels;')((xml: string) => assert.ok(xml), rollFor);
  const calls: any[] = [], renders: string[] = [];
  let failRender = false, failPrint = 0, connected = true;
  const sdk = {
    getPrintersAsync: async () => [{ name: 'Twin', isConnected: connected, isLocal: true, isTwinTurbo: true }],
    openLabelXml: (xml: string) => ({ setObjectText: (name: string, image: string) => { assert.equal(name, 'ARTWORK'); assert.ok(image); }, getLabelXml: () => xml }),
    renderLabelAsync: async (xml: string) => { renders.push(xml); if (failRender && xml === 'antler') throw new Error('Invalid second label'); return 'preview'; },
    createLabelWriterPrintParamsXml: (params: any) => params,
    printLabelAsync: async (_printer: string, params: any) => { assert.equal(renders.length, 2, 'Both layouts must validate before either is printed'); calls.push(params); if (calls.length === failPrint) throw new Error('timeout'); },
  };
  const settings = { printer: 'Twin', meatRoll: 'Right', meatTemplate: 'meat', antlerTemplate: 'antler' };
  const labels = [{ kind: 'deer', image: 'png' }, { kind: 'antler', image: 'png' }];
  await send(sdk, settings, labels, '123456');
  assert.deepEqual(calls.map(c => c.twinTurboRoll), ['Right', 'Left']);
  assert.ok(calls.every(c => c.copies === 1 && c.printQuality === 'BarcodeAndGraphics'));
  calls.length = 0; renders.length = 0; failRender = true;
  await assert.rejects(() => send(sdk, settings, labels, '123456'), /Invalid second/);
  assert.equal(calls.length, 0, 'Preflight failure must not print the first label');
  failRender = false; renders.length = 0; failPrint = 2;
  await assert.rejects(() => send(sdk, settings, labels, '123456'), /meat label was already sent.*may already have printed/);
  assert.equal(calls.length, 2, 'Ambiguous results must never retry automatically');
  calls.length = 0; connected = false;
  await assert.rejects(() => send(sdk, settings, labels, '123456'), /not connected/);
  assert.equal(calls.length, 0);
}
