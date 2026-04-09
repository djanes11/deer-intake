import { PDFDocument } from 'pdf-lib';
import {
  chunks,
  createPdfFonts,
  drawTextInRect,
  formatDateMMDDYY,
  loadPdfTemplate,
  requireFieldRect,
  stateformDateOut,
} from '@/lib/stateforms/shared';
import { StateFormDefinition, StateFormPreparedPayload } from '@/lib/stateforms/types';

const ROWS = Array.from({ length: 14 }, (_, i) => i + 1);

type OhioRowRects = {
  dateReceived: any;
  animalType: any;
  ownerName: any;
  originState: any;
  confirmation: any;
  dateDisposed: any;
};

function buildRowRects(template: PDFDocument) {
  const form = template.getForm();
  return ROWS.map((rowNumber) => ({
    dateReceived: requireFieldRect(form, `Date Animal ReceivedRow${rowNumber}`),
    animalType: requireFieldRect(form, `Type of Animal ReceivedRow${rowNumber}`),
    ownerName: requireFieldRect(form, `Name of OwnerRow${rowNumber}`),
    originState: requireFieldRect(form, `State or Province Animal Came From if not from OhioRow${rowNumber}`),
    confirmation: requireFieldRect(form, `Tag Seal Certificate or Game Check Confirmation NumberRow${rowNumber}`),
    dateDisposed: requireFieldRect(form, `Date Animal DisposedRow${rowNumber}`),
  })) as OhioRowRects[];
}

export const ohioStateForm: StateFormDefinition = {
  type: 'ohio',
  label: 'Ohio DNR 8812 Processor Record',
  description: 'Official Ohio locker plant and meat processor record form.',
  capacity: 14,
  supportsPageNumber: false,
  preparePayload({ rows, pageNumberStart, context }) {
    const entries = rows.map((row) => {
      const originState = String(row.state || '').trim().toUpperCase();
      return {
        jobId: row.id,
        dateReceived: formatDateMMDDYY(row.dropoff_date),
        animalType: 'Deer',
        ownerName: String(row.customer_name || ''),
        originState: originState && originState !== 'OH' ? originState : '',
        confirmation: String(row.confirmation || ''),
        dateDisposed: stateformDateOut(row),
      };
    });
    return {
      ok: true,
      formType: 'ohio',
      formLabel: 'Ohio DNR 8812 Processor Record',
      formDescription: 'Official Ohio locker plant and meat processor record form.',
      totalEntries: entries.length,
      totalSheets: Math.max(1, Math.ceil(entries.length / 14)),
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
    const bytes = loadPdfTemplate('public/forms/ohio-dnr-8812.pdf');
    const template = await PDFDocument.load(bytes);
    const pdf = await PDFDocument.create();
    const { helv } = await createPdfFonts(pdf);
    const rowRects = buildRowRects(template);
    const sheetGroups = chunks(payload.entries, 14);
    if (!sheetGroups.length) sheetGroups.push([]);

    for (let sheetIndex = 0; sheetIndex < sheetGroups.length; sheetIndex += 1) {
      const [page] = await pdf.copyPages(template, [0]);
      pdf.addPage(page);
    }

    for (const [sheetIndex, sheetEntries] of sheetGroups.entries()) {
      const page = pdf.getPage(sheetIndex);
      for (let i = 0; i < sheetEntries.length; i++) {
        const e = sheetEntries[i] || {};
        const rects = rowRects[i];
        drawTextInRect(page, e.dateReceived, rects.dateReceived, helv);
        drawTextInRect(page, e.animalType, rects.animalType, helv);
        drawTextInRect(page, e.ownerName, rects.ownerName, helv);
        drawTextInRect(page, e.originState, rects.originState, helv);
        drawTextInRect(page, e.confirmation, rects.confirmation, helv);
        drawTextInRect(page, e.dateDisposed, rects.dateDisposed, helv);
      }
    }

    return pdf.save();
  },
};
