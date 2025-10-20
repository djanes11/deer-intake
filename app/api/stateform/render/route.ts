// app/api/stateform/render/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

// ===== Layout (final) =====
const ROW_H = 18;
const FONT_SIZE = 9;

const FIRST_PAGE_ROWS = 18;  // page 1 shows rows 1..18
const SECOND_PAGE_ROWS = 25; // page 2 shows rows 19..43
const TOTAL_CAPACITY = FIRST_PAGE_ROWS + SECOND_PAGE_ROWS; // 43

const TOP_MARGIN_FIRST = 245; // page 1 baseline (locked)
const TOP_MARGIN_NEXT  = 123; // page 2 baseline (you measured)

// Column X positions
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

// Page-1 header positions (relative to baseline)
const HEADER_X: Record<string, number> = {
  year: 66,
  page: 300,
  name: 58,
  loc: 58,
  county: 325,
  street: 58,
  city: 52,
  zip: 175,
  phone: 275,
};
const HEADER_Y_OFFSETS: Record<string, number> = {
  year: 150,
  page: 150,
  name: 125,
  loc: 100,
  county: 100,
  street: 75,
  city: 55,
  zip: 55,
  phone: 55,
};

// ===== GAS (optional) / sample payload =====
const GAS =
  process.env.API_BASE ||
  process.env.GAS_BASE ||
  process.env.NEXT_PUBLIC_API_BASE;
const TOKEN =
  process.env.API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.NEXT_PUBLIC_API_TOKEN;

function assertValidBase(url?: string) {
  if (!url) throw new Error("Missing GAS_BASE / API_BASE / NEXT_PUBLIC_API_BASE");
}

async function fetchPayload(dry: boolean) {
  assertValidBase(GAS);
  const url = `${GAS}?action=stateform_payload&dry=${dry ? "1" : "0"}${
    TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GAS stateform_payload failed: ${res.status} ${txt.slice(0,200)}`);
  try { return JSON.parse(txt); } catch { throw new Error("GAS returned non-JSON"); }
}

// ---- helpers
function drawText(page: any, text: any, x: number, y: number, font: any, size = FONT_SIZE) {
  if (text === undefined || text === null || text === "") return;
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
}
function fmt(v?: any) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}
function mmddyy(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).toString().slice(-2);
  return `${mm}/${dd}/${yy}`;
}
function addDays(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

// ---- sample payload: exactly 43 rows
function samplePayload() {
  const baseIn = new Date("2025-10-18T00:00:00");
  const rows = Array.from({ length: TOTAL_CAPACITY }).map((_, i) => {
    const inDate = addDays(baseIn, i % 7);
    const outDate = addDays(inDate, (i % 3) + 1);
    return {
      dateIn: mmddyy(inDate),
      dateOut: mmddyy(outDate),
      name: `Sample Person ${String(i + 1).padStart(2, "0")}`,
      address: `${100 + i} Test Rd, Palmyra, IN 47164`,
      phone: `(502) 555-${String(1000 + i).slice(-4)}`,
      sex: i % 2 ? "BUCK" : "DOE",
      whereKilled: "Harrison, IN",
      howKilled: (i % 3 === 0) ? "Archery" : (i % 3 === 1) ? "Rifle" : "Bow",
      donated: (i % 11 === 0) ? "Y" : "N",
      confirmation: `CONF-${String(1_000 + i).slice(-4)}`,
    };
  });

  return {
    ok: true,
    pageYear: "2025",
    pageNumber: 1,
    processorName: "Mcafee Custom Deer Processing",
    processorLocation: "Indiana",
    processorCounty: "Harrison",
    processorStreet: "10977 Buffalo Trace Rd NW",
    processorCity: "Palmyra",
    processorZip: "47164",
    processorPhone: "(502)6433916",
    entries: rows, // exactly 43
  };
}

// Draw page-1 header only (official form)
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
  const dry = (searchParams.get("dry") ?? "1") === "1";
  const debug = searchParams.get("debug") || "";
  const useSample = (searchParams.get("sample") ?? "0") === "1";

  try {
    const payload = useSample ? samplePayload() : await fetchPayload(dry);

    // Load the official 2-page form from public/
    const formPath = path.join(process.cwd(), "public/forms/19433.pdf");
    const bytes = fs.readFileSync(formPath);
    const pdf = await PDFDocument.load(bytes);

    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Ensure exactly two pages
    while (pdf.getPageCount() < 2) pdf.addPage([612, 792]);
    while (pdf.getPageCount() > 2) pdf.removePage(pdf.getPageCount() - 1);

    // Page-1 header values
    const headerVals = {
      year: payload.pageYear ?? "",
      page: String(payload.pageNumber ?? 1),
      name: payload.processorName ?? "",
      loc: payload.processorLocation ?? "",
      county: payload.processorCounty ?? "",
      street: payload.processorStreet ?? "",
      city: payload.processorCity ?? "",
      zip: payload.processorZip ?? "",
      phone: payload.processorPhone ?? "",
    };
    drawPage1Header(pdf, helv, helvBold, headerVals, debug);

    // Cap entries to 43 and split across pages
    const entries = (Array.isArray(payload.entries) ? payload.entries : []).slice(0, TOTAL_CAPACITY);

    // ---- Page 1 rows (1..18) ----
    {
      const p0 = pdf.getPage(0);
      const { height: h0 } = p0.getSize();
      const startY = h0 - TOP_MARGIN_FIRST;
      const count1 = Math.min(entries.length, FIRST_PAGE_ROWS);
      for (let i = 0; i < count1; i++) {
        const e = entries[i] || {};
        const y = startY - i * ROW_H;
        drawText(p0, fmt(e.dateIn),       COLS.dateIn,       y, helv);
        drawText(p0, fmt(e.dateOut),      COLS.dateOut,      y, helv);
        drawText(p0, e.name,              COLS.name,         y, helv);
        drawText(p0, e.address,           COLS.address,      y, helv);
        drawText(p0, e.phone,             COLS.phone,        y, helv);
        drawText(p0, e.sex,               COLS.sex,          y, helv);
        drawText(p0, e.whereKilled,       COLS.whereKilled,  y, helv);
        drawText(p0, e.howKilled,         COLS.howKilled,    y, helv);
        drawText(p0, e.donated,           COLS.donated,      y, helv);
        drawText(p0, e.confirmation,      COLS.confirmation, y, helv);
      }
    }

    // ---- Page 2 rows (19..43) ----
    if (entries.length > FIRST_PAGE_ROWS) {
      const p1 = pdf.getPage(1);
      const { height: h1 } = p1.getSize();
      const startY2 = h1 - TOP_MARGIN_NEXT;
      const count2 = Math.min(entries.length - FIRST_PAGE_ROWS, SECOND_PAGE_ROWS);
      for (let j = 0; j < count2; j++) {
        const e = entries[FIRST_PAGE_ROWS + j] || {};
        const y = startY2 - j * ROW_H;
        drawText(p1, fmt(e.dateIn),       COLS.dateIn,       y, helv);
        drawText(p1, fmt(e.dateOut),      COLS.dateOut,      y, helv);
        drawText(p1, e.name,              COLS.name,         y, helv);
        drawText(p1, e.address,           COLS.address,      y, helv);
        drawText(p1, e.phone,             COLS.phone,        y, helv);
        drawText(p1, e.sex,               COLS.sex,          y, helv);
        drawText(p1, e.whereKilled,       COLS.whereKilled,  y, helv);
        drawText(p1, e.howKilled,         COLS.howKilled,    y, helv);
        drawText(p1, e.donated,           COLS.donated,      y, helv);
        drawText(p1, e.confirmation,      COLS.confirmation, y, helv);
      }
    }

    const out = await pdf.save();
    return new NextResponse(Buffer.from(out), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (err: any) {
    return new NextResponse(`Stateform render error: ${err?.message || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
