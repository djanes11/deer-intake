// app/api/stateform/render/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

// ===== Layout (your tuned values, with tighter spacing) =====
const ROWS_PER_PAGE = 22;
const ROW_H = 19;           // <- tightened from 24
const FONT_SIZE = 9;

// Your “perfect” row-1 baseline:
const TOP_MARGIN_FIRST = 245;
const TOP_MARGIN_NEXT = 170;

// Your verified column X positions
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

// RELATIVE header positions (these looked right for you)
// X positions:
const HEADER_X = {
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
// Y offsets relative to first-row baseline (smaller = closer to row 1)
const HEADER_Y_OFFSETS = {
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

function assertValidBase(url) {
  if (!url) throw new Error("Missing GAS_BASE / API_BASE / NEXT_PUBLIC_API_BASE");
}

async function fetchPayload(dry) {
  assertValidBase(GAS);
  const url = `${GAS}?action=stateform_payload&dry=${dry ? "1" : "0"}${
    TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(`GAS stateform_payload failed: ${res.status} ${txt.slice(0,200)}`);
  try { return JSON.parse(txt); } catch { throw new Error("GAS returned non-JSON"); }
}

// Sample has multiple entries with distinct Date In AND Date Out so you can verify both columns.
function samplePayload() {
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
    entries: [
      {
        dateIn: "10/18/25",
        dateOut: "10/19/25",
        name: "Jane Archer",
        address: "44 Walnut Rd, Palmyra, IN 47164",
        phone: "(502) 555-0001",
        sex: "DOE",
        whereKilled: "Harrison, IN",
        howKilled: "Bow",
        donated: "N",
        confirmation: "CONF-001",
      },
      {
        dateIn: "10/19/25",
        dateOut: "10/20/25",
        name: "Luke Hunter",
        address: "9 Creek Ln, Corydon, IN 47112",
        phone: "(502) 555-0002",
        sex: "BUCK",
        whereKilled: "Harrison, IN",
        howKilled: "Rifle",
        donated: "N",
        confirmation: "CONF-002",
      },
      {
        dateIn: "10/20/25",
        dateOut: "10/22/25",
        name: "John Doe",
        address: "123 Main St, Palmyra, IN 47164",
        phone: "(502) 555-0003",
        sex: "BUCK",
        whereKilled: "Harrison, IN",
        howKilled: "Archery",
        donated: "N",
        confirmation: "CONF-003",
      },
    ],
  };
}

// ===== helpers =====
function drawText(page, text, x, y, font, size = FONT_SIZE) {
  if (text === undefined || text === null || text === "") return;
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const dry = (searchParams.get("dry") ?? "1") === "1";
  const debug = searchParams.get("debug") || "";
  const useSample = (searchParams.get("sample") ?? "0") === "1";

  try {
    const payload = useSample ? samplePayload() : await fetchPayload(dry);

    // Load the official form from public/
    const formPath = path.join(process.cwd(), "public/forms/19433.pdf");
    const bytes = fs.readFileSync(formPath);
    const pdf = await PDFDocument.load(bytes);

    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.getPage(0);
    const { width: w, height: h } = page.getSize();

    // ===== Optional debug axes / page size =====
    if (debug) {
      page.drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: h }, thickness: 0.5, color: rgb(1,0,0) });
      page.drawLine({ start: { x: 0, y: 0 }, end: { x: w, y: 0 }, thickness: 0.5, color: rgb(1,0,0) });
      page.drawText("origin (0,0)", { x: 6, y: 6, size: 8, font: helv, color: rgb(1,0,0) });
      page.drawText(`page ${w}x${h}`, { x: w - 90, y: h - 14, size: 8, font: helv, color: rgb(1,0,0) });
    }

    // ===== REL header (this is what you’re using) =====
    const baselineY = h - TOP_MARGIN_FIRST;
    const HY = {
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

    const headerVals = {
      year: payload.pageYear,
      page: String(payload.pageNumber),
      name: payload.processorName,
      loc: payload.processorLocation,
      county: payload.processorCounty,
      street: payload.processorStreet,
      city: payload.processorCity,
      zip: payload.processorZip,
      phone: payload.processorPhone,
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

    // ===== Rows (tighter spacing) =====
    const startY = h - TOP_MARGIN_FIRST;
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i] || {};
      const y = startY - i * ROW_H;
      drawText(page, e.dateIn, COLS.dateIn, y, helv);
      drawText(page, e.dateOut, COLS.dateOut, y, helv);     // <-- Date Out visible now
      drawText(page, e.name, COLS.name, y, helv);
      drawText(page, e.address, COLS.address, y, helv);
      drawText(page, e.phone, COLS.phone, y, helv);
      drawText(page, e.sex, COLS.sex, y, helv);
      drawText(page, e.whereKilled, COLS.whereKilled, y, helv);
      drawText(page, e.howKilled, COLS.howKilled, y, helv);
      drawText(page, e.donated, COLS.donated, y, helv);
      drawText(page, e.confirmation, COLS.confirmation, y, helv);
    }

    const out = await pdf.save();
    return new NextResponse(Buffer.from(out), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (err) {
    return new NextResponse(`Stateform render error: ${err && (err.message || String(err))}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
