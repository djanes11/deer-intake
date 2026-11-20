import JsBarcode from 'jsbarcode';
import { antlerLabelTemplate } from '@/lib/antlerLabelTemplate';
import { dymoTextObject, smallLabelData, smallLabelPrinters, withLabelTimeout, UncertainLabelPrintError, type SmallLabelFramework, type SmallLabelSettings } from '@/lib/smallLabelPrinting';

export function antlerData(job: Record<string, any>) {
  return {
    ...smallLabelData(job),
    confirmation: String(job.confirmation || job.confirmation_number || job['Confirmation #'] || '').trim(),
    processType: String(job.processType || job.process_type || job['Process Type'] || '').trim(),
  };
}
export function directAntlerEligible(job: Record<string, any> | null | undefined) {
  const type = antlerData(job || {}).processType.toLowerCase().replace(/&/g, 'and').replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
  return ['caped', 'cape and donate', 'caped and donate', 'skull cap', 'european'].includes(type);
}
export function antlerRoll(settings: SmallLabelSettings) {
  if (!['Left', 'Right'].includes(settings.roll)) throw new Error('Choose the small-label roll in Printer setup first.');
  return settings.roll === 'Left' ? 'Right' : 'Left';
}
export function antlerBarcode(tag: string) {
  const encoded: any = {};
  JsBarcode(encoded, tag, { format: 'CODE128', displayValue: false });
  const bits = encoded.encodings.map((part: any) => part.data).join('') as string;
  const module = Math.floor(2.04 * 300 / (bits.length + 20));
  if (module < 2) throw new Error('This tag is too long for a reliably scannable barcode on the antler label.');
  // Integer 300-dpi bars, with ten modules of quiet space at each side.
  return { bits, module, start: Math.round((2.33 * 300 - (bits.length + 20) * module) / 2) / 300 + 10 * module / 300 };
}
export function antlerLabelXml(job: Record<string, any>, brandingName = 'Wild Game Butcher Board') {
  const data = antlerData(job);
  if (!directAntlerEligible(job)) throw new Error('Antler tags are available only for cape, cape and donate, skull-cap, or European processing.');
  if (!data.tag || /^pending/i.test(data.tag) || !data.customer || !data.phone) throw new Error('Save a permanent tag, customer name and phone before printing.');
  const text = (name: string, value: string, y: number, height: number, size: number, bold = true) => dymoTextObject(name, value, y, height, size, bold, 0.14, 2.04);
  const rule = (name: string, y: number, x = 0.14, width = 2.04, height = 0.007) => dymoTextObject(name, ' ', y, height, 1, false, x, width)
    .replace('<Color A="0" R="1" G="1" B="1"/>', '<Color A="1" R="0" G="0" B="0"/>');
  const objects = [
    text('BRAND', brandingName, 0.25, 0.22, 10), rule('HEADER_RULE', 0.49),
    text('TITLE', 'ANTLER TAG', 0.54, 0.25, 19),
    text('CUSTOMER_LABEL', 'CUSTOMER', 0.87, 0.12, 7),
    text('CUSTOMER', data.customer, 1.02, 0.39, 15), rule('CUSTOMER_RULE', 1.43),
    text('CONF_LABEL', 'CONFIRMATION', 1.47, 0.12, 7),
    text('CONF', data.confirmation || '-', 1.61, 0.20, 12), rule('CONF_RULE', 1.84),
    text('TAG_LABEL', 'TAG', 1.88, 0.12, 7),
    text('TAG', data.tag, 2.02, 0.23, 17), rule('TAG_RULE', 2.28),
    text('PHONE_LABEL', 'PHONE', 2.32, 0.12, 7),
    text('PHONE', data.phone, 2.46, 0.20, 12), rule('PHONE_RULE', 2.69),
    text('PROCESSING', 'Processing: ' + data.processType, 2.76, 0.20, 9),
    text('CUT', '- - - - CUT OFF BARCODE - - - -', 3.02, 0.13, 7),
  ];
  const barcode = antlerBarcode(data.tag);
  for (const match of barcode.bits.matchAll(/1+/g)) {
    objects.push(rule('BAR_' + match.index, 3.18, barcode.start + match.index! * barcode.module / 300, match[0].length * barcode.module / 300, 0.63));
  }
  objects.push(text('CUTOFF_TAG', 'Tag ' + data.tag, 3.82, 0.115, 8));
  return antlerLabelTemplate.trimStart()
    .replace('<Orientation>Landscape</Orientation>', '<Orientation>Portrait</Orientation>')
    .replace(/<DYMORect>[\s\S]*?<\/DYMORect>/, '<DYMORect><DYMOPoint><X>0.056666665</X><Y>0.23333333</Y></DYMOPoint><Size><Width>2.2166667</Width><Height>3.7066667</Height></Size></DYMORect>')
    .replace(/<LabelObjects\s*\/>|<LabelObjects>[\s\S]*?<\/LabelObjects>/, () => '<LabelObjects>' + objects.join('') + '</LabelObjects>');
}
export async function sendAntlerLabel(sdk: SmallLabelFramework, settings: SmallLabelSettings, job: Record<string, any>, brand: string, authorize: () => Promise<void>) {
  const roll = antlerRoll(settings);
  const xml = antlerLabelXml(job, brand);
  await authorize();
  if (!(await smallLabelPrinters(sdk)).some(p => p.name === settings.printer)) throw new Error('The saved Twin Turbo is not connected. Check Printer setup.');
  await withLabelTimeout(sdk.renderLabelAsync(xml, '', settings.printer), 'Antler preview timed out. Nothing was printed.');
  await authorize();
  const params = sdk.createLabelWriterPrintParamsXml({ copies: 1, twinTurboRoll: roll, jobTitle: 'Antler tag ' + antlerData(job).tag, printQuality: 'BarcodeAndGraphics' });
  try { await withLabelTimeout(sdk.printLabelAsync(settings.printer, params, xml, ''), 'Print response timed out.', 45000); }
  catch { throw new UncertainLabelPrintError('The antler tag result is uncertain. Check the printer and Windows print queue before printing again; the label may already have printed.'); }
}
