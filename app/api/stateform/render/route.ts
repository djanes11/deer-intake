// app/api/stateform/render/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';
import { headerFields, pdfFieldMap } from '@/lib/stateform/map';

const FONT_SIZE = 9;
const ROW_FIELD_ORDER = Array.from({ length: 44 }, (_, i) => i + 1).filter((i) => i !== 23);
const HEADER_PADDING_X = 2;
const ROW_PADDING_X = 2;

type Rect = { x: number; y: number; width: number; height: number };
type RowFieldRects = Record<
  "dateIn" | "dateOut" | "name" | "address" | "phone" | "sex" | "whereKilled" | "howKilled" | "donated" | "confirmation",
  Rect
>;
type RowSlot = {
  pageOffset: 0 | 1;
  rects: RowFieldRects;
};

function getFieldRect(form: any, name: string): Rect | null {
  const field = form.getFieldMaybe(name);
  const widget = field?.acroField?.getWidgets?.()?.[0];
  const rect = widget?.getRectangle?.();
  if (!rect) return null;
  return {
    x: Number(rect.x ?? 0),
    y: Number(rect.y ?? 0),
    width: Number(rect.width ?? 0),
    height: Number(rect.height ?? 0),
  };
}

function requireFieldRect(form: any, name: string): Rect {
  const rect = getFieldRect(form, name);
  if (!rect) {
    throw new Error(`Missing PDF field rectangle for "${name}"`);
  }
  return rect;
}

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

async function fetchPayloadPreview() {
  return fetchStateformPayloadFromSupabase();
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function drawText(page: any, text: any, x: number, y: number, font: any, size = FONT_SIZE) {
  if (text === undefined || text === null || text === "") return;
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
}

function drawTextInRect(page: any, text: any, rect: Rect, font: any, size = FONT_SIZE, paddingX = ROW_PADDING_X) {
  if (text === undefined || text === null || text === "") return;
  const baselineOffset = Math.max((rect.height - size) / 2, 1);
  page.drawText(String(text), {
    x: rect.x + paddingX,
    y: rect.y + baselineOffset,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawPage1Header(page: any, template: PDFDocument, helvBold: any, headerVals: Record<string, string>) {
  const form = template.getForm();
  const areaCode = String(headerVals.phoneAreaCode || "").trim();
  const phoneNumber = String(headerVals.phoneNumber || "").trim();

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

function splitPhoneForHeader(phone: string | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return { areaCode: "", phoneNumber: "" };
  if (digits.length <= 3) return { areaCode: digits, phoneNumber: "" };
  return {
    areaCode: digits.slice(0, 3),
    phoneNumber: digits.slice(3, 10),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") || "";
  const download = searchParams.get("download") === "1";

  try {
    const auth = requireStaffAccess(req);
    if (!auth.ok) {
      return new NextResponse(auth.error, {
        status: auth.status,
        headers: { "Content-Type": "text/plain" },
      });
    }
    // PREVIEW ONLY — never clears
    const payload = await fetchPayloadPreview();

    // load the official form
    const formPath = path.join(process.cwd(), "public/forms/19433.pdf");
    const bytes = fs.readFileSync(formPath);
    const template = await PDFDocument.load(bytes);
    const pdf = await PDFDocument.create();

    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const rowSlots = buildRowSlots(template);
    const page1Rows = rowSlots.filter((slot) => slot.pageOffset === 0);
    const page2Rows = rowSlots.filter((slot) => slot.pageOffset === 1);
    const STATEFORM_CAPACITY = rowSlots.length;
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const sheetGroups = chunks(entries, STATEFORM_CAPACITY);
    if (!sheetGroups.length) sheetGroups.push([]);
    const sheets = sheetGroups.length;
    const startPageNumber = Number(payload.pageNumberStart ?? payload.pageNumber ?? 1) || 1;

    for (let sheetIndex = 0; sheetIndex < sheets; sheetIndex += 1) {
      const [page1, page2] = await pdf.copyPages(template, [0, 1]);
      pdf.addPage(page1);
      pdf.addPage(page2);
    }

    // debug axes
    if (debug) {
      for (let p = 0; p < pdf.getPageCount(); p += 1) {
        const page = pdf.getPage(p);
        const { width:w, height:h } = page.getSize();
        page.drawLine({ start:{x:0,y:0}, end:{x:0,y:h}, thickness:0.5, color: rgb(1,0,0) });
        page.drawLine({ start:{x:0,y:0}, end:{x:w,y:0}, thickness:0.5, color: rgb(1,0,0) });
        page.drawText("origin (0,0)", { x:6, y:6, size:8, font:helv, color: rgb(1,0,0) });
      }
    }

    for (const [sheetIndex, sheetEntries] of sheetGroups.entries()) {
      const page1Index = sheetIndex * 2;
      const page2Index = page1Index + 1;
      const headerVals = {
        year: payload.pageYear ?? "",
        page: String(startPageNumber + sheetIndex),
        name: payload.processorName ?? "",
        loc: payload.processorLocation ?? "",
        county: payload.processorCounty ?? "",
        street: payload.processorStreet ?? "",
        city: payload.processorCity ?? "",
        zip: payload.processorZip ?? "",
        ...splitPhoneForHeader(payload.processorPhone),
      };
      drawPage1Header(pdf.getPage(page1Index), template, helvBold, headerVals);

      const p0 = pdf.getPage(page1Index);
      const firstPageEntries = sheetEntries.slice(0, page1Rows.length);
      for (let i = 0; i < firstPageEntries.length; i++) {
        const e = firstPageEntries[i] || {};
        const rects = page1Rows[i].rects;
        drawTextInRect(p0, e.dateIn, rects.dateIn, helv);
        drawTextInRect(p0, e.dateOut, rects.dateOut, helv);
        drawTextInRect(p0, e.name, rects.name, helv);
        drawTextInRect(p0, e.address, rects.address, helv);
        drawTextInRect(p0, e.phone, rects.phone, helv);
        drawTextInRect(p0, e.sex, rects.sex, helv);
        drawTextInRect(p0, e.whereKilled, rects.whereKilled, helv);
        drawTextInRect(p0, e.howKilled, rects.howKilled, helv);
        drawTextInRect(p0, e.donated, rects.donated, helv);
        drawTextInRect(p0, e.confirmation, rects.confirmation, helv);
      }

      const p1 = pdf.getPage(page2Index);
      const secondPageEntries = sheetEntries.slice(page1Rows.length, STATEFORM_CAPACITY);
      for (let j = 0; j < secondPageEntries.length; j++) {
        const e = secondPageEntries[j] || {};
        const rects = page2Rows[j].rects;
        drawTextInRect(p1, e.dateIn, rects.dateIn, helv);
        drawTextInRect(p1, e.dateOut, rects.dateOut, helv);
        drawTextInRect(p1, e.name, rects.name, helv);
        drawTextInRect(p1, e.address, rects.address, helv);
        drawTextInRect(p1, e.phone, rects.phone, helv);
        drawTextInRect(p1, e.sex, rects.sex, helv);
        drawTextInRect(p1, e.whereKilled, rects.whereKilled, helv);
        drawTextInRect(p1, e.howKilled, rects.howKilled, helv);
        drawTextInRect(p1, e.donated, rects.donated, helv);
        drawTextInRect(p1, e.confirmation, rects.confirmation, helv);
      }
    }

    const out = await pdf.save();
    return new NextResponse(Buffer.from(out), {
      headers: {
        "Content-Type": "application/pdf",
        ...(download ? { "Content-Disposition": `attachment; filename="state-form-${payload.pageYear || 'season'}.pdf"` } : {}),
      },
    });
  } catch (err: any) {
    return new NextResponse(`Stateform render error: ${err?.message || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
