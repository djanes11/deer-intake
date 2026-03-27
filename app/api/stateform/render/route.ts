// app/api/stateform/render/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import { fetchStateformPayloadFromSupabase } from '@/lib/stateform/supabase';
import { requireStaffAccess } from '@/lib/staffAuth';

// ===== Layout (your tuned values) =====
const ROW_H = 18;
const FONT_SIZE = 9;
const FIRST_PAGE_ROWS = 18;
const SECOND_PAGE_ROWS = 25;
const STATEFORM_CAPACITY = FIRST_PAGE_ROWS + SECOND_PAGE_ROWS; // 43

const TOP_MARGIN_FIRST = 245;
const TOP_MARGIN_NEXT  = 123;

const COLS = {
  dateIn: 35,
  dateOut: 75,
  name: 120,
  address: 230,
  phone: 493,
  sex: 590,
  whereKilled: 690,
  howKilled: 790,
  donated: 880,
  confirmation: 923,
};

const HEADER_X: Record<string, number> = {
  year: 66, page: 300, name: 58, loc: 58, county: 325,
  street: 58, city: 52, zip: 175, phone: 275,
};
const HEADER_Y_OFFSETS: Record<string, number> = {
  year: 150, page: 150, name: 125, loc: 100, county: 100,
  street: 75, city: 55, zip: 55, phone: 55,
};

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

function drawPage1Header(
  pdf: PDFDocument,
  helv: any,
  helvBold: any,
  headerVals: Record<string, string>,
  debug: string
) {
  const page = pdf.getPage(0);
  const { height: h } = page.getSize();
  const baselineY = h - TOP_MARGIN_FIRST;
  const HY: Record<string, number> = {
    year:   baselineY + HEADER_Y_OFFSETS.year,
    page:   baselineY + HEADER_Y_OFFSETS.page,
    name:   baselineY + HEADER_Y_OFFSETS.name,
    loc:    baselineY + HEADER_Y_OFFSETS.loc,
    county: baselineY + HEADER_Y_OFFSETS.county,
    street: baselineY + HEADER_Y_OFFSETS.street,
    city:   baselineY + HEADER_Y_OFFSETS.city,
    zip:    baselineY + HEADER_Y_OFFSETS.zip,
    phone:  baselineY + HEADER_Y_OFFSETS.phone,
  };
  for (const key of Object.keys(HEADER_X)) {
    const x = HEADER_X[key];
    const y = HY[key];
    drawText(page, headerVals[key] || "", x, y, helvBold, 10);
    if (debug === "header") {
      page.drawCircle({ x, y, size: 3, color: rgb(0, 0.6, 0) });
      page.drawText(key, { x: x + 5, y: y + 3, size: 8, font: helv, color: rgb(0,0.6,0) });
    }
  }
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
        phone: payload.processorPhone ?? "",
      };

      const pairPdf = {
        getPage: (idx: number) => pdf.getPage(page1Index + idx),
      } as unknown as PDFDocument;
      drawPage1Header(pairPdf, helv, helvBold, headerVals, debug);

      const p0 = pdf.getPage(page1Index);
      const { height: h0 } = p0.getSize();
      const startY = h0 - TOP_MARGIN_FIRST;
      const firstPageEntries = sheetEntries.slice(0, FIRST_PAGE_ROWS);
      for (let i = 0; i < firstPageEntries.length; i++) {
        const e = firstPageEntries[i] || {};
        const y = startY - i * ROW_H;
        drawText(p0, e.dateIn,       COLS.dateIn,       y, helv);
        drawText(p0, e.dateOut,      COLS.dateOut,      y, helv);
        drawText(p0, e.name,         COLS.name,         y, helv);
        drawText(p0, e.address,      COLS.address,      y, helv);
        drawText(p0, e.phone,        COLS.phone,        y, helv);
        drawText(p0, e.sex,          COLS.sex,          y, helv);
        drawText(p0, e.whereKilled,  COLS.whereKilled,  y, helv);
        drawText(p0, e.howKilled,    COLS.howKilled,    y, helv);
        drawText(p0, e.donated,      COLS.donated,      y, helv);
        drawText(p0, e.confirmation, COLS.confirmation, y, helv);
      }

      const p1 = pdf.getPage(page2Index);
      const { height: h1 } = p1.getSize();
      const startY2 = h1 - TOP_MARGIN_NEXT;
      const secondPageEntries = sheetEntries.slice(FIRST_PAGE_ROWS, STATEFORM_CAPACITY);
      for (let j = 0; j < secondPageEntries.length; j++) {
        const e = secondPageEntries[j] || {};
        const y = startY2 - j * ROW_H;
        drawText(p1, e.dateIn,       COLS.dateIn,       y, helv);
        drawText(p1, e.dateOut,      COLS.dateOut,      y, helv);
        drawText(p1, e.name,         COLS.name,         y, helv);
        drawText(p1, e.address,      COLS.address,      y, helv);
        drawText(p1, e.phone,        COLS.phone,        y, helv);
        drawText(p1, e.sex,          COLS.sex,          y, helv);
        drawText(p1, e.whereKilled,  COLS.whereKilled,  y, helv);
        drawText(p1, e.howKilled,    COLS.howKilled,    y, helv);
        drawText(p1, e.donated,      COLS.donated,      y, helv);
        drawText(p1, e.confirmation, COLS.confirmation, y, helv);
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
