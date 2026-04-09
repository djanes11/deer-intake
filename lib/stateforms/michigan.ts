import { PDFDocument } from 'pdf-lib';
import {
  buildAddress,
  chunks,
  createPdfFonts,
  currentMonthLabel,
  drawTextInRect,
  formatDateMMDDYY,
  loadPdfTemplate,
  requireFieldRect,
} from '@/lib/stateforms/shared';
import { StateFormDefinition, StateFormPreparedPayload } from '@/lib/stateforms/types';

const ROWS = Array.from({ length: 8 }, (_, i) => i);

type MichiganRects = {
  registrant: any;
  county: any;
  reportMonth: any;
  rowRects: Array<{
    species: any;
    acquired: any;
    countyOfOrigin: any;
    ownerName: any;
    address: any;
    license: any;
    confirmation: any;
  }>;
};

function buildRects(template: PDFDocument): MichiganRects {
  const form = template.getForm();
  return {
    registrant: requireFieldRect(form, 'Registrants Name and Business Name If applicable'),
    county: requireFieldRect(form, 'County'),
    reportMonth: requireFieldRect(form, 'Report Month'),
    rowRects: ROWS.map((rowNumber) => ({
      species: requireFieldRect(form, `ANIMALS ACCEPTED SPECIES COMMON NAME.${rowNumber}`),
      acquired: requireFieldRect(form, `DATE ACQUIRED.${rowNumber}`),
      countyOfOrigin: requireFieldRect(form, `COUNTY OF ORIGIN.${rowNumber}`),
      ownerName: requireFieldRect(form, `ANIMAL OWNER NAME.${rowNumber}`),
      address: requireFieldRect(form, `ADDRESS.${rowNumber}`),
      license: requireFieldRect(form, `HUNTING LICENSE NUMBER.${rowNumber}`),
      confirmation: requireFieldRect(form, `HARVEST CONFIRMATION NUMBER.${rowNumber}`),
    })),
  };
}

export const michiganStateForm: StateFormDefinition = {
  type: 'michigan',
  label: 'Michigan Wild Game Processor Report',
  description: 'Official Michigan wild game processor report for the current month.',
  capacity: 8,
  supportsPageNumber: false,
  preparePayload({ rows, pageNumberStart, context }) {
    const reportMonth = currentMonthLabel();
    const entries = rows.map((row) => ({
      jobId: row.id,
      species: 'Deer',
      acquired: formatDateMMDDYY(row.dropoff_date),
      countyOfOrigin: String(row.county_killed || ''),
      ownerName: String(row.customer_name || ''),
      address: buildAddress(row),
      license: String(row.hunting_license_number || ''),
      confirmation: String(row.confirmation || ''),
    }));
    return {
      ok: true,
      formType: 'michigan',
      formLabel: 'Michigan Wild Game Processor Report',
      formDescription: 'Official Michigan wild game processor report for the current month.',
      reportPeriodLabel: reportMonth,
      totalEntries: entries.length,
      totalSheets: Math.max(1, Math.ceil(entries.length / 8)),
      pageNumber: pageNumberStart,
      pageNumberStart,
      canSetPageNumber: false,
      entries,
      processorName: context.processorName,
      processorLocation: context.processorLocation,
      processorCounty: context.processorCounty,
      processorStreet: context.processorStreet,
      processorCity: context.processorCity,
      processorZip: context.processorZip,
      processorPhone: context.processorPhone,
      pageYear: context.currentYear,
    };
  },
  async renderPdf(payload: StateFormPreparedPayload) {
    const bytes = loadPdfTemplate('public/forms/michigan-wild-game-processor-report.pdf');
    const template = await PDFDocument.load(bytes);
    const pdf = await PDFDocument.create();
    const { helv } = await createPdfFonts(pdf);
    const rects = buildRects(template);
    const sheetGroups = chunks(payload.entries, 8);
    if (!sheetGroups.length) sheetGroups.push([]);

    for (let sheetIndex = 0; sheetIndex < sheetGroups.length; sheetIndex += 1) {
      const [page] = await pdf.copyPages(template, [0]);
      pdf.addPage(page);
    }

    for (const [sheetIndex, sheetEntries] of sheetGroups.entries()) {
      const page = pdf.getPage(sheetIndex);
      drawTextInRect(page, payload.processorName, rects.registrant, helv);
      drawTextInRect(page, payload.processorCounty, rects.county, helv);
      drawTextInRect(page, payload.reportPeriodLabel || currentMonthLabel(), rects.reportMonth, helv);

      for (let i = 0; i < sheetEntries.length; i++) {
        const e = sheetEntries[i] || {};
        const rowRects = rects.rowRects[i];
        drawTextInRect(page, e.species, rowRects.species, helv);
        drawTextInRect(page, e.acquired, rowRects.acquired, helv);
        drawTextInRect(page, e.countyOfOrigin, rowRects.countyOfOrigin, helv);
        drawTextInRect(page, e.ownerName, rowRects.ownerName, helv);
        drawTextInRect(page, e.address, rowRects.address, helv);
        drawTextInRect(page, e.license, rowRects.license, helv);
        drawTextInRect(page, e.confirmation, rowRects.confirmation, helv);
      }
    }

    return pdf.save();
  },
};
