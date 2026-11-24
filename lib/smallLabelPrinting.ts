import { smallLabelTemplate } from '@/lib/smallLabelTemplate';

export type SmallLabelData = { customer: string; tag: string; phone: string };
export type SmallLabelSettings = { printer: string; roll: 'Left' | 'Right'; packages: 2 | 3 };
export type SmallLabel = { heading: 'MEAT TAG' | 'CRATE LABEL'; data: SmallLabelData };
export type LabelPrinter = { name: string; isConnected: boolean; isLocal: boolean; isTwinTurbo: boolean };
export type SmallLabelFramework = {
  init(callback: () => void): void;
  getPrintersAsync(): PromiseLike<LabelPrinter[]>;
  renderLabelAsync(xml: string, params: string, printer: string): PromiseLike<string>;
  createLabelWriterPrintParamsXml(params: Record<string, unknown>): string;
  printLabelAsync(printer: string, params: string, xml: string, records: string): PromiseLike<unknown>;
};

const SETTINGS_KEY = 'wgbb.small-label-test.v1';
export const defaultSmallLabelSettings: SmallLabelSettings = { printer: '', roll: 'Left', packages: 2 };
export function readSmallLabelSettings(): SmallLabelSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { printer: String(value.printer || ''), roll: value.roll === 'Right' ? 'Right' : 'Left', packages: value.packages === 3 ? 3 : 2 };
  } catch { return { ...defaultSmallLabelSettings }; }
}
export function saveSmallLabelSettings(settings: SmallLabelSettings) {
  // Store only workstation preferences, never customer details.
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
export function smallLabelData(job: Record<string, unknown>): SmallLabelData {
  const field = (...keys: string[]) => String(keys.map(key => job[key]).find(v => v != null && String(v).trim()) ?? '').trim().replace(/\s+/g, ' ');
  return {
    customer: field('customer', 'customer_name', 'Customer', 'customerName', 'Customer Name'),
    tag: field('tag', 'Tag', 'tag_number'),
    phone: field('phone', 'Phone', 'customer_phone', 'Phone Number'),
  };
}
export function buildSmallLabelSet(data: SmallLabelData, packages: 2 | 3): SmallLabel[] {
  if (packages !== 2 && packages !== 3) throw new Error('Choose 2 or 3 crate labels.');
  if (!data.tag.trim() || /^pending/i.test(data.tag)) throw new Error('Assign a permanent tag before printing.');
  if (!data.customer.trim() || !data.phone.trim()) throw new Error('A name and phone number are required for these labels.');
  if (data.customer.length > 70 || data.tag.length > 20 || data.phone.length > 30) throw new Error('These details are too long for the small label. Check the record before printing.');
  return [ { heading: 'MEAT TAG', data: { ...data } }, ...Array.from({ length: packages }, (): SmallLabel => ({ heading: 'CRATE LABEL', data: { ...data } })) ];
}
const xmlText = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Native Connect layout, in inches. Separate text objects let long names
// shrink independently without shrinking the tag number or label heading.
export const dymoTextObject = (name: string, text: string, y: number, height: number, size: number, bold: boolean, x = 0.11, width = 1.84) => `
    <TextObject><Name>${name}</Name>
      <Brushes><BackgroundBrush><SolidColorBrush><Color A="0" R="1" G="1" B="1"/></SolidColorBrush></BackgroundBrush>
        <BorderBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></BorderBrush>
        <StrokeBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></StrokeBrush>
        <FillBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></FillBrush></Brushes>
      <Rotation>Rotation0</Rotation><OutlineThickness>1</OutlineThickness><IsOutlined>False</IsOutlined><BorderStyle>SolidLine</BorderStyle>
      <Margin><DYMOThickness Left="0" Top="0" Right="0" Bottom="0"/></Margin>
      <HorizontalAlignment>Left</HorizontalAlignment><VerticalAlignment>Middle</VerticalAlignment><FitMode>AlwaysFit</FitMode><IsVertical>False</IsVertical>
      <FormattedText><FitMode>AlwaysFit</FitMode><HorizontalAlignment>Left</HorizontalAlignment><VerticalAlignment>Middle</VerticalAlignment><IsVertical>False</IsVertical>
        <LineTextSpan><TextSpan><Text>${xmlText(text)}</Text><FontInfo><FontName>Arial</FontName><FontSize>${size}</FontSize><IsBold>${bold ? 'True' : 'False'}</IsBold><IsItalic>False</IsItalic><IsUnderline>False</IsUnderline>
          <FontBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></FontBrush></FontInfo></TextSpan></LineTextSpan>
      </FormattedText><ObjectLayout><DYMOPoint><X>${x}</X><Y>${y}</Y></DYMOPoint><Size><Width>${width}</Width><Height>${height}</Height></Size></ObjectLayout>
    </TextObject>`;

export function crateNameLines(customer: string): string[] {
  const words = customer.trim().split(/\s+/);
  if (words.length < 2) return words;
  // Balance the two lines without splitting any part of a person's name.
  let split = 1;
  let shortest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const longest = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
    if (longest < shortest) { shortest = longest; split = i; }
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}

export function smallLabelXml(label: SmallLabel): string {
  const object = dymoTextObject;
  const nameLines = crateNameLines(label.data.customer);
  // The supplied file is portrait. Rotate its printable rectangle to landscape
  // while preserving the actual stock identifier and Connect v4 metadata.
  return smallLabelTemplate
    // A saved .dymo file can start with a UTF-8 BOM. Once embedded in a JS
    // string it becomes XML text, which the web service rejects at position 1.
    .trimStart()
    .replace('<Orientation>Portrait</Orientation>', '<Orientation>Landscape</Orientation>')
    .replace(/<DYMORect>[\s\S]*?<\/DYMORect>/, '<DYMORect><DYMOPoint><X>0.09</X><Y>0.039999966</Y></DYMOPoint><Size><Width>1.9766666</Width><Height>0.90333337</Height></Size></DYMORect>')
    .replace(/<LabelObjects>[\s\S]*?<\/LabelObjects>/, () => '<LabelObjects>' + [
      ...(label.heading === 'CRATE LABEL' ? [
        ...nameLines.map((line, i) => object('CUSTOMER_' + i, line,
          0.05 + i * 0.32, nameLines.length === 1 ? 0.64 : 0.32,
          nameLines.length === 1 ? 44 : 28, true, 0.10, 1.94)),
        object('TAG', label.data.tag, 0.70, 0.10, 7, false),
        // Handwritten counts intentionally do not depend on the print quantity.
        object('CRATE_COUNT', 'CRATE ____ OF ____', 0.81, 0.13, 9, true),
      ] : [
        object('KIND', label.heading, 0.05, 0.15, 9, true),
        object('DIVIDER', ' ', 0.215, 0.009, 1, false)
          .replace('<Color A="0" R="1" G="1" B="1"/>', '<Color A="1" R="0" G="0" B="0"/>'),
        object('TAG', 'TAG ' + label.data.tag, 0.27, 0.26, 16, true),
        object('CUSTOMER', label.data.customer, 0.55, 0.19, 11, true),
        object('PHONE', label.data.phone, 0.77, 0.16, 10, false),
      ]),
    ].join('') + '</LabelObjects>');
}

export function withLabelTimeout<T>(promise: PromiseLike<T>, message: string, ms = 25000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
let connection: Promise<SmallLabelFramework> | undefined;
export function connectSmallLabelPrinter(): Promise<SmallLabelFramework> {
  if (connection) return connection;
  connection = withLabelTimeout(new Promise<SmallLabelFramework>((resolve, reject) => {
    const initialize = () => {
      const sdk = (window as any).dymo?.label?.framework as SmallLabelFramework | undefined;
      if (!sdk) { reject(new Error('DYMO printing support could not load.')); return; }
      try { sdk.init(() => resolve(sdk)); } catch (error) { reject(error); }
    };
    if ((window as any).dymo?.label?.framework) { initialize(); return; }
    const script = document.createElement('script');
    script.src = '/vendor/dymo/dymo.connect.framework.js';
    script.onload = initialize;
    script.onerror = () => { script.remove(); reject(new Error('Could not load DYMO printing support.')); };
    document.head.appendChild(script);
  }), 'The DYMO service did not respond. Open this page on the computer connected to the printer and check DYMO Connect.').catch(error => { connection = undefined; throw error; });
  return connection;
}
export async function smallLabelPrinters(sdk: SmallLabelFramework) {
  const printers = await withLabelTimeout(sdk.getPrintersAsync(), 'Printer discovery timed out. Check the DYMO service on this computer.');
  return Array.from(printers).filter(p => p.isLocal && p.isTwinTurbo && p.isConnected);
}
export class UncertainLabelPrintError extends Error {}
export async function sendSmallLabelSet(sdk: SmallLabelFramework, settings: SmallLabelSettings, labels: SmallLabel[], authorize: () => Promise<void>) {
  if (!labels.length || labels.length > 4) throw new Error('Choose between 1 and 4 labels.');
  if (!['Left', 'Right'].includes(settings.roll)) throw new Error('Choose the small-label roll.');
  await authorize();
  if (!(await smallLabelPrinters(sdk)).some(p => p.name === settings.printer)) throw new Error('The saved Twin Turbo is not connected. Check the printer setup.');
  const prepared = labels.map(smallLabelXml);
  // All labels must render successfully before any paper is sent.
  for (const xml of prepared) await withLabelTimeout(sdk.renderLabelAsync(xml, '', settings.printer), 'DYMO could not preview the small label. Nothing was sent.');
  let sent = 0;
  for (let i = 0; i < prepared.length; i++) {
    try { await authorize(); }
    catch (error) {
      if (sent) throw new UncertainLabelPrintError(`${sent} label request(s) were accepted before the session check failed. Remaining labels were not sent. Check the printer before continuing.`);
      throw error;
    }
    const params = sdk.createLabelWriterPrintParamsXml({ copies: 1, twinTurboRoll: settings.roll, jobTitle: `${labels[i].heading} ${labels[i].data.tag}`, printQuality: 'Text' });
    try {
      await withLabelTimeout(sdk.printLabelAsync(settings.printer, params, prepared[i], ''), 'Print response timed out.', 45000);
      sent++;
    } catch {
      // Never automatically retry a request that might already be in the spooler.
      throw new UncertainLabelPrintError(`${sent} label request(s) accepted; label ${i + 1} has an uncertain result. Check the printer and Windows print queue before printing again. Remaining labels were not sent.`);
    }
  }
  return sent;
}
