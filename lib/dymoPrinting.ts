import JsBarcode from 'jsbarcode';

export type LabelKind = 'deer' | 'antler';
export type Roll = 'Left' | 'Right';
export type DymoSettings = { printer: string; meatRoll: Roll; meatTemplate: string; antlerTemplate: string };
export type DymoPrinter = { name: string; isConnected: boolean; isTwinTurbo: boolean; isLocal: boolean };
type Framework = {
  init(callback: () => void): void;
  getPrintersAsync(): PromiseLike<DymoPrinter[]>;
  openLabelXml(xml: string): { getObjectNames(): string[]; setObjectText(name: string, value: string): void; getLabelXml(): string };
  renderLabelAsync(xml: string, params: string, printer: string): PromiseLike<string>;
  createLabelWriterPrintParamsXml(params: Record<string, unknown>): string;
  printLabelAsync(printer: string, params: string, xml: string, labels: string): PromiseLike<unknown>;
};
const KEY = 'wgbb.dymo.twin.v1';
export const emptyDymoSettings: DymoSettings = { printer: '', meatRoll: 'Left', meatTemplate: '', antlerTemplate: '' };
export function readDymoSettings(): DymoSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { printer: String(v.printer || ''), meatRoll: v.meatRoll === 'Right' ? 'Right' : 'Left', meatTemplate: String(v.meatTemplate || ''), antlerTemplate: String(v.antlerTemplate || '') };
  } catch { return { ...emptyDymoSettings }; }
}
export function saveDymoSettings(settings: DymoSettings) { localStorage.setItem(KEY, JSON.stringify(settings)); }
export function rollFor(kind: LabelKind, settings: DymoSettings): Roll {
  return kind === 'deer' ? settings.meatRoll : settings.meatRoll === 'Left' ? 'Right' : 'Left';
}
let frameworkPromise: Promise<Framework> | undefined;
export function getDymo(): Promise<Framework> {
  if (frameworkPromise) return frameworkPromise;
  frameworkPromise = new Promise<Framework>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('DYMO connection timed out. Start DYMO Connect and allow this site to access the local printer service.')), 20000);
    const initialize = () => {
      const framework = (window as any).dymo?.label?.framework as Framework | undefined;
      if (!framework) { clearTimeout(timer); reject(new Error('Could not load DYMO printing support.')); return; }
      try { framework.init(() => { clearTimeout(timer); resolve(framework); }); }
      catch (error) { clearTimeout(timer); reject(error); }
    };
    if ((window as any).dymo?.label?.framework) initialize();
    else {
      const script = document.createElement('script');
      script.src = '/vendor/dymo/dymo.connect.framework.js';
      script.onload = initialize;
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Could not load DYMO printing support. Refresh and try again.')); };
      document.head.appendChild(script);
    }
  }).catch(error => { frameworkPromise = undefined; throw error; });
  return frameworkPromise;
}
export async function listDymoPrinters() {
  const sdk = await getDymo();
  return Array.from(await sdk.getPrintersAsync()).filter(p => p.isTwinTurbo && p.isLocal);
}
function field(job: Record<string, any>, ...keys: string[]) {
  return String(keys.map(k => job[k]).find(v => v != null && String(v).trim()) || '').trim();
}
export function labelData(job: Record<string, any>) {
  return {
    customer: field(job, 'customer', 'Customer', 'customerName', 'Customer Name'),
    tag: field(job, 'tag', 'Tag'), phone: field(job, 'phone', 'Phone', 'Phone Number'),
    confirmation: field(job, 'confirmation', 'Confirmation', 'Confirmation #'),
    processType: field(job, 'processType', 'Process Type', 'process_type'),
  };
}

// Render at the printer's 300 dpi. No screenshots, remote customer data, or browser scaling.
export function labelArtwork(job: Record<string, any>, kind: LabelKind, brand: string): string {
  const data = labelData(job);
  if (!data.tag || /^pending/i.test(data.tag)) throw new Error('Assign a real tag before printing labels.');
  const canvas = document.createElement('canvas');
  const scale = 300 / 25.4;
  const w = kind === 'deer' ? 50.8 : 59, h = kind === 'deer' ? 25.4 : 102;
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare label artwork.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
  const text = (value: string, y: number, size: number, height: number, bold = false) => {
    let lines: string[] = [];
    let font = size;
    for (; font >= 6; font -= 0.25) {
      ctx.font = `${bold ? 'bold ' : ''}${font * 300 / 72}px Arial`;
      lines = [''];
      for (const word of value.split(/\s+/)) {
        let last = lines.length - 1;
        const candidate = lines[last] ? `${lines[last]} ${word}` : word;
        if (ctx.measureText(candidate).width <= (w - 5) * scale) { lines[last] = candidate; continue; }
        if (lines[last]) { lines.push(''); last++; }
        for (const char of word) {
          if (ctx.measureText(lines[last] + char).width > (w - 5) * scale) { lines.push(''); last++; }
          lines[last] += char;
        }
      }
      if (lines.length * font * 25.4 / 72 * 1.1 <= height) break;
    }
    if (font < 6) throw new Error('Label text is too long to print legibly. Check the customer details.');
    lines.forEach((line, i) => ctx.fillText(line, 2.5 * scale, (y + i * font * 25.4 / 72 * 1.1) * scale));
  };
  if (kind === 'deer') {
    text(data.customer || 'Unknown Customer', 2, 11, 8, true);
    text(`Tag ${data.tag}`, 11, 16, 6.5, true);
    text(data.phone || '-', 19, 11, 4.5);
  } else {
    text(brand || 'Wild Game Butcher Board', 2, 11, 9, true);
    text('Antler Tag', 12, 18, 8, true);
    text(data.customer || 'Unknown Customer', 23, 15, 13, true);
    text(`Tag ${data.tag}`, 38, 19, 9, true);
    text(`Phone ${data.phone || '-'}`, 49, 11, 6);
    text(`Conf ${data.confirmation || '-'}`, 57, 10, 6);
    text(`Processing: ${data.processType || '-'}`, 65, 10, 10, true);
    ctx.setLineDash([12, 8]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(2 * scale, 78 * scale); ctx.lineTo((w - 2) * scale, 78 * scale); ctx.stroke(); ctx.setLineDash([]);
    const barcode = document.createElement('canvas');
    JsBarcode(barcode, data.tag, { format: 'CODE128', width: 3, height: Math.round(18 * scale), displayValue: false, margin: 0, marginLeft: 30, marginRight: 30 });
    // Integer-width bars and a ten-module quiet zone; never stretch or blur the barcode.
    const moduleScale = Math.floor((w - 5) * scale / barcode.width * 3);
    if (moduleScale < 2) throw new Error('This tag is too long for a reliably scannable antler barcode.');
    JsBarcode(barcode, data.tag, { format: 'CODE128', width: moduleScale, height: Math.round(18 * scale), displayValue: false, margin: 0, marginLeft: moduleScale * 10, marginRight: moduleScale * 10 });
    ctx.drawImage(barcode, Math.floor((canvas.width - barcode.width) / 2), Math.round(81 * scale));
  }
  return canvas.toDataURL('image/png').split(',')[1];
}

export function validateTemplate(xml: string) {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Choose a DYMO template without external references, under 2 MB.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !['DieCutLabel', 'DesktopLabel'].includes(doc.documentElement.tagName)) throw new Error('Choose a label saved by DYMO Label or DYMO Connect.');
  const artwork = Array.from(doc.getElementsByTagName('ImageObject')).find(n => n.getElementsByTagName('Name')[0]?.textContent === 'ARTWORK');
  if (!artwork) throw new Error('The DYMO template must contain an image object named ARTWORK.');
  const objects = Array.from(doc.getElementsByTagName('*')).filter(n => /^(Image|Text|Address|Barcode|Shape|Counter|CircularText|DateTime|QRCode)Object$/.test(n.tagName));
  if (objects.length !== 1) throw new Error('Use a blank template containing only the ARTWORK image, so no old customer details print.');
  if (!artwork.getElementsByTagName(doc.documentElement.tagName === 'DesktopLabel' ? 'Data' : 'Image')[0]) throw new Error('Insert an image into ARTWORK and save the template again.');
}

// Validate/render BOTH labels before sending either. Never retry an ambiguous print result.
export async function sendDymoLabels(sdk: Framework, settings: DymoSettings, labels: { kind: LabelKind; image: string }[], tag: string) {
  const printers = Array.from(await sdk.getPrintersAsync());
  const printer = printers.find(p => p.name === settings.printer && p.isLocal && p.isTwinTurbo && p.isConnected);
  if (!printer) throw new Error('The selected Twin Turbo is not connected. Check Label printer setup.');
  const prepared = [];
  for (const item of labels) {
    const xml = item.kind === 'deer' ? settings.meatTemplate : settings.antlerTemplate;
    if (!xml) throw new Error(`Add the ${item.kind === 'deer' ? 'meat' : 'antler'} template in Label printer setup first.`);
    validateTemplate(xml);
    const label = sdk.openLabelXml(xml);
    label.setObjectText('ARTWORK', item.image);
    const output = label.getLabelXml();
    await sdk.renderLabelAsync(output, '', printer.name);
    prepared.push({ kind: item.kind, xml: output });
  }
  let sent = 0;
  for (const item of prepared) {
    const params = sdk.createLabelWriterPrintParamsXml({ copies: 1, jobTitle: `${item.kind === 'deer' ? 'Meat' : 'Antler'} tag ${tag}`, twinTurboRoll: rollFor(item.kind, settings), printQuality: 'BarcodeAndGraphics' });
    try { await sdk.printLabelAsync(printer.name, params, item.xml, ''); sent++; }
    catch { throw new Error(`${sent ? 'The meat label was already sent. ' : ''}DYMO could not confirm the ${item.kind === 'deer' ? 'meat' : 'antler'} label. Check the printer before using the individual reprint button; it may already have printed.`); }
  }
}
