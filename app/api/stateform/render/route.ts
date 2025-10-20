// app/api/stateform/render/route.ts
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

const ROWS_PER_PAGE = 22;
const ROW_H = 24;
const FONT_SIZE = 9;

// your tuned offset
const TOP_MARGIN_FIRST = 245;
const TOP_MARGIN_NEXT = 170;

// Column positions you verified
const COLS = {
  dateIn: 35,
  dateOut: 112,
  name: 120,
  address: 230,
  phone: 493,
  sex: 590,
  whereKilled: 690,
  howKilled: 820,
  donated: 880,
  confirmation: 923,
};

// absolute header coordinates (on visible page)
const HEADER_XY = {
  year: { x: 66, y: 756 },
  page: { x: 300, y: 756 },
  name: { x: 58, y: 724 },
  loc: { x: 58, y: 696 },
  county: { x: 325, y: 696 },
  street: { x: 58, y: 668 },
  city: { x: 52, y: 640 },
  zip: { x: 175, y: 640 },
  phone: { x: 275, y: 640 },
};

// GAS references
const GAS =
  process.env.API_BASE ||
  process.env.GAS_BASE ||
  process.env.NEXT_PUBLIC_API_BASE;
const TOKEN =
  process.env.API_TOKEN ||
  process.env.GAS_TOKEN ||
  process.env.NEXT_PUBLIC_API_TOKEN;

function assertValidBase(url?: string) {
  if (!url) throw new Error("Missing GAS_BASE or NEXT_PUBLIC_API_BASE env var");
}

async function fetchPayload(dry: boolean) {
  assertValidBase(GAS);
  const url = `${GAS}?action=stateform_payload&dry=${dry ? "1" : "0"}${
    TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok)
    throw new Error(
      `GAS stateform_payload failed: ${res.status} ${await res.text()}`
    );
  return res.json();
}

function getSamplePayload() {
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
        dateIn: "10/20/25",
        dateOut: "",
        name: "John Doe",
        address: "123 Main St, Palmyra, IN 47164",
        phone: "(555) 555-1212",
        sex: "BUCK",
        whereKilled: "Harrison, IN",
        howKilled: "Archery",
        donated: "N",
        confirmation: "1234567890123",
      },
    ],
  };
}

function drawText(page, text, x, y, font, size = FONT_SIZE) {
  if (!text) return;
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dry = searchParams.get("dry") === "1";
  const debug = searchParams.get("debug");
  const sample = searchParams.get("sample");

  try {
    const payload = sample ? getSamplePayload() : await fetchPayload(dry);
    const formPath = path.join(process.cwd(), "public/forms/19433.pdf");
    const formBytes = fs.readFileSync(formPath);
    const pdfDoc = await PDFDocument.load(formBytes);
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.getPage(0);
    const { height: h } = page.getSize();

    // ---- Draw Header ----
    for (const [key, pos] of Object.entries(HEADER_XY)) {
      const value =
        key === "year"
          ? payload.pageYear
          : key === "page"
          ? String(payload.pageNumber)
          : key === "name"
          ? payload.processorName
          : key === "loc"
          ? payload.processorLocation
          : key === "county"
          ? payload.processorCounty
          : key === "street"
          ? payload.processorStreet
          : key === "city"
          ? payload.processorCity
          : key === "zip"
          ? payload.processorZip
          : key === "phone"
          ? payload.processorPhone
          : "";

      if (value) drawText(page, value, pos.x, pos.y, helvBold, 10);

      if (debug === "header") {
        page.drawCircle({ x: pos.x, y: pos.y, size: 3, color: rgb(1, 0, 0) });
        page.drawText(key, {
          x: pos.x + 5,
          y: pos.y + 3,
          size: 8,
          font: helv,
          color: rgb(1, 0, 0),
        });
      }
    }

    // ---- Draw Rows ----
    const startY = h - TOP_MARGIN_FIRST;
    payload.entries.forEach((e, i) => {
      const y = startY - i * ROW_H;
      drawText(page, e.dateIn, COLS.dateIn, y, helv);
      drawText(page, e.dateOut, COLS.dateOut, y, helv);
      drawText(page, e.name, COLS.name, y, helv);
      drawText(page, e.address, COLS.address, y, helv);
      drawText(page, e.phone, COLS.phone, y, helv);
      drawText(page, e.sex, COLS.sex, y, helv);
      drawText(page, e.whereKilled, COLS.whereKilled, y, helv);
      drawText(page, e.howKilled, COLS.howKilled, y, helv);
      drawText(page, e.donated, COLS.donated, y, helv);
      drawText(page, e.confirmation, COLS.confirmation, y, helv);
    });

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (err: any) {
    return new NextResponse(
      `Stateform render error: ${err?.message || err}`,
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}
