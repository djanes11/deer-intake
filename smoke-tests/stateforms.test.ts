import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFArray, StandardFonts } from 'pdf-lib';
import { drawTextInRect } from '../lib/stateforms/shared.ts';

import { listStateFormOptions, normalizeStateFormType } from '../lib/stateforms/catalog.ts';
import { getStateFormDefinition } from '../lib/stateforms/registry.ts';

export async function run() {
  const options = listStateFormOptions();
  assert.deepEqual(options.map((item) => item.value), ['indiana', 'ohio', 'michigan']);
  assert.equal(normalizeStateFormType('unknown'), 'indiana');

  for (const option of options) {
    const definition = getStateFormDefinition(option.value);
    const rows = Array.from({ length: definition.capacity + 1 }, (_, index) => ({
      id: `test-${index}`, tag: String(10001 + index), customer_name: `Test Hunter ${index + 1}`,
      phone: '5555550100', address: '123 Sample Road', city: 'Example', state: 'IN', zip: '46000',
      dropoff_date: '2026-09-11', county_killed: 'Sample', deer_sex: 'Buck', how_killed: 'Archery',
      confirmation: String(1234567890000 + index), hunting_license_number: 'TEST123',
    }));
    const payload = definition.preparePayload({ rows, pageNumberStart: 7, context: {
      processorName: 'TEST ONLY - Example Processing', processorLocation: 'Sample Location',
      processorCounty: 'Sample', processorStreet: '456 Sample Road', processorCity: 'Example',
      processorZip: '46000', processorPhone: '5555550100', currentYear: '2026',
    } });
    assert.equal(payload.totalSheets, 2, `${option.value} must paginate past one sheet`);
    const bytes = await definition.renderPdf(payload);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), option.value === 'indiana' ? 4 : 2);
    for (const page of pdf.getPages()) assert.equal(page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.size() || 0, 0, 'Report must not retain template widgets over printed text');
    assert.equal(pdf.catalog.has(PDFName.of('AcroForm')), false);
    if (process.env.PDF_QA_OUTPUT) {
      fs.mkdirSync(process.env.PDF_QA_OUTPUT, { recursive: true });
      fs.writeFileSync(path.join(process.env.PDF_QA_OUTPUT, `${option.value}-test.pdf`), bytes);
    }
  }
  const sample = await PDFDocument.create();
  const font = await sample.embedFont(StandardFonts.Helvetica);
  const drawn: any[] = [];
  drawTextInRect({ drawText: (value: string, options: any) => drawn.push({ value, ...options }) },
    '1234567890123', { x: 0, y: 0, width: 65.4, height: 16.32 }, font, 9, 2);
  assert.equal(drawn[0].value, '1234567890123');
  assert.ok(font.widthOfTextAtSize(drawn[0].value, drawn[0].size) <= 61.401, 'Full confirmation must fit inside the printed cell');
}
