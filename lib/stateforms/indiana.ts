import { PDFDocument } from 'pdf-lib';
import { headerFields, pdfFieldMap } from '@/lib/stateform/map';
import {
  buildAddress,
  chunks,
  createPdfFonts,
  digitsOnly,
  donatedValue,
  drawTextInRect,
  formatDateMMDDYY,
  loadPdfTemplate,
  normalizeHowKilled,
  normalizeSex,
  Rect,
  requireFieldRect,
  stateformDateOut,
} from '@/lib/stateforms/shared';
import { StateFormDefinition, StateFormPreparedPayload } from '@/lib/stateforms/types';

const ROW_FIELD_ORDER = Array.from({ length: 44 }, (_, i) => i + 1).filter((i) => i !== 23);
const HEADER_PADDING_X = 2;
const ROW_PADDING_X = 2;

type RowFieldRects = Record<
  'dateIn' | 'dateOut' | 'name' | 'address' | 'phone' | 'sex' | 'whereKilled' | 'howKilled' | 'donated' | 'confirmation',
  Rect
>;
type RowSlot = {
  pageOffset: 0 | 1;
  rects: RowFieldRects;
};

function buildRowSlots(template: PDFDocument): RowSlot[] {
  const form = template.getForm();
  return ROW_FIELD_ORDER.map((rowNumber) => {
    const fieldNames = pdfFieldMap(rowNumber);
    return {
      pageOffset: rowNumber <= 18 ? 0 : 1,
      rects: {
        dateIn: requireFieldRect(form, fieldNames.dateIn),
        dateOut: requireFieldRect(form, fieldNames.dateOut),
        name: requireFieldRect(form, fieldNames.name),
        address: requireFieldRect(form, fieldNames.address),
        phone: requireFieldRect(form, fieldNames.phone),
        sex: requireFieldRect(form, fieldNames.sex),
        whereKilled: requireFieldRect(form, fieldNames.whereKilled),
        howKilled: requireFieldRect(form, fieldNames.howKilled),
        donated: requireFieldRect(form, fieldNames.donated),
        confirmation: requireFieldRect(form, fieldNames.confirmation),
      },
    };
  });
}

function splitPhoneForHeader(phone: string | undefined) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return { areaCode: '', phoneNumber: '' };
  if (digits.length <= 3) return { areaCode: digits, phoneNumber: '' };
  return {
    areaCode: digits.slice(0, 3),
    phoneNumber: digits.slice(3, 10),
  };
}

function drawPage1Header(page: any, template: PDFDocument, helvBold: any, headerVals: Record<string, string>) {
  const form = template.getForm();
  const areaCode = String(headerVals.phoneAreaCode || '').trim();
  const phoneNumber = String(headerVals.phoneNumber || '').trim();

  drawTextInRect(page, headerVals.year, requireFieldRect(form, headerFields.year), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.page, requireFieldRect(form, headerFields.pageNumber), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.name, requireFieldRect(form, headerFields.processorName), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.loc, requireFieldRect(form, headerFields.processorLocation), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.county, requireFieldRect(form, headerFields.processorCounty), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.street, requireFieldRect(form, headerFields.processorStreet), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.city, requireFieldRect(form, headerFields.processorCity), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, headerVals.zip, requireFieldRect(form, headerFields.processorZip), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, areaCode, requireFieldRect(form, headerFields.processorAreaCode), helvBold, 10, HEADER_PADDING_X);
  drawTextInRect(page, phoneNumber, requireFieldRect(form, headerFields.processorPhoneNumber), helvBold, 10, HEADER_PADDING_X);
}

export const indianaStateForm: StateFormDefinition = {
  type: 'indiana',
  label: 'Indiana DNR Processor Record',
  description: 'Official Indiana processor record PDF with season entry pagination.',
  capacity: 43,
  supportsPageNumber: true,
  preparePayload({ rows, pageNumberStart, context }) {
    const entries = rows.map((row) => ({
      jobId: row.id,
      dateIn: formatDateMMDDYY(row.dropoff_date),
      dateOut: stateformDateOut(row),
      name: String(row.customer_name || ''),
      address: buildAddress(row),
      phone: digitsOnly(row.phone).slice(-10),
      sex: normalizeSex(row.deer_sex),
      whereKilled: [row.county_killed, row.state].filter(Boolean).join(', '),
      howKilled: normalizeHowKilled(row.how_killed),
      donated: donatedValue(row),
      confirmation: digitsOnly(row.confirmation),
    }));
    const totalSheets = Math.max(1, Math.ceil(entries.length / 43));
    return {
      ok: true,
      formType: 'indiana',
      formLabel: 'Indiana DNR Processor Record',
      formDescription: 'Official Indiana processor record PDF with season entry pagination.',
      totalEntries: entries.length,
      totalSheets,
      pageNumber: pageNumberStart,
      pageNumberStart,
      canSetPageNumber: true,
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
    const bytes = loadPdfTemplate('public/forms/19433.pdf');
    const template = await PDFDocument.load(bytes);
    const pdf = await PDFDocument.create();
    const { helv, helvBold } = await createPdfFonts(pdf);
    const rowSlots = buildRowSlots(template);
    const page1Rows = rowSlots.filter((slot) => slot.pageOffset === 0);
    const page2Rows = rowSlots.filter((slot) => slot.pageOffset === 1);
    const sheetGroups = chunks(payload.entries, 43);
    if (!sheetGroups.length) sheetGroups.push([]);

    for (let sheetIndex = 0; sheetIndex < sheetGroups.length; sheetIndex += 1) {
      const [page1, page2] = await pdf.copyPages(template, [0, 1]);
      pdf.addPage(page1);
      pdf.addPage(page2);
    }

    for (const [sheetIndex, sheetEntries] of sheetGroups.entries()) {
      const page1Index = sheetIndex * 2;
      const page2Index = page1Index + 1;
      const headerVals = {
        year: payload.pageYear ?? '',
        page: String(payload.pageNumberStart + sheetIndex),
        name: payload.processorName ?? '',
        loc: payload.processorLocation ?? '',
        county: payload.processorCounty ?? '',
        street: payload.processorStreet ?? '',
        city: payload.processorCity ?? '',
        zip: payload.processorZip ?? '',
        ...splitPhoneForHeader(payload.processorPhone),
      };
      drawPage1Header(pdf.getPage(page1Index), template, helvBold, headerVals);

      const p0 = pdf.getPage(page1Index);
      const firstPageEntries = sheetEntries.slice(0, page1Rows.length);
      for (let i = 0; i < firstPageEntries.length; i++) {
        const e = firstPageEntries[i] || {};
        const rects = page1Rows[i].rects;
        drawTextInRect(p0, e.dateIn, rects.dateIn, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.dateOut, rects.dateOut, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.name, rects.name, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.address, rects.address, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.phone, rects.phone, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.sex, rects.sex, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.whereKilled, rects.whereKilled, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.howKilled, rects.howKilled, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.donated, rects.donated, helv, 9, ROW_PADDING_X);
        drawTextInRect(p0, e.confirmation, rects.confirmation, helv, 9, ROW_PADDING_X);
      }

      const p1 = pdf.getPage(page2Index);
      const secondPageEntries = sheetEntries.slice(page1Rows.length, 43);
      for (let j = 0; j < secondPageEntries.length; j++) {
        const e = secondPageEntries[j] || {};
        const rects = page2Rows[j].rects;
        drawTextInRect(p1, e.dateIn, rects.dateIn, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.dateOut, rects.dateOut, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.name, rects.name, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.address, rects.address, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.phone, rects.phone, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.sex, rects.sex, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.whereKilled, rects.whereKilled, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.howKilled, rects.howKilled, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.donated, rects.donated, helv, 9, ROW_PADDING_X);
        drawTextInRect(p1, e.confirmation, rects.confirmation, helv, 9, ROW_PADDING_X);
      }
    }

    return pdf.save();
  },
};
