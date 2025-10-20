// app/api/stateform/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { headerFields, pdfFieldMap, StateFormPayload } from "@/lib/stateform/map";
import { getPreviewPayload, getFlushPayload } from "@/lib/stateform/client";

export const runtime = "nodejs";

async function loadTemplate() {
  const p = path.join(process.cwd(), "public", "stateform", "19433.pdf");
  return fs.readFile(p);
}

async function fillTemplate(payload: StateFormPayload) {
  const bytes = await loadTemplate();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  // Helper to set text safely (no-throw if field missing)
  const safeSet = (name: string, v?: string) => {
    try {
      const f = form.getTextField(name);
      f.setText(v ?? "");
    } catch (_) {
      // silently ignore missing field (template mismatch)
    }
  };

  // Header
  safeSet(headerFields.year, payload.pageYear);
  safeSet(headerFields.pageNumber, String(payload.pageNumber));
  safeSet(headerFields.processorName, payload.processorName);
  safeSet(headerFields.processorLocation, payload.processorLocation);
  safeSet(headerFields.processorCounty, payload.processorCounty);
  safeSet(headerFields.processorStreet, payload.processorStreet);
  safeSet(headerFields.processorCity, payload.processorCity);
  safeSet(headerFields.processorZip, payload.processorZip);

  // Rows — template has 44 lines total (1..18 page 1, 19..44 page 2)
  const maxRows = Math.min(44, payload.entries.length);
  for (let i = 1; i <= maxRows; i++) {
    const e = payload.entries[i - 1] || {};
    const f = pdfFieldMap(i);
    safeSet(f.dateIn, (e.dateIn || "").replaceAll("-", "/"));
    safeSet(f.dateOut, (e.dateOut || "").replaceAll("-", "/"));
    safeSet(f.name, e.name || "");
    safeSet(f.address, e.address || "");
    safeSet(f.phone, e.phone || "");
    safeSet(f.sex, e.sex || "");
    safeSet(f.whereKilled, e.whereKilled || "");
    safeSet(f.howKilled, e.howKilled || "");
    safeSet(f.donated, e.donated || "");
    safeSet(f.confirmation, e.confirmation || "");
  }

  // Must keep fields "editable" or "flatten" before returning; states usually accept either.
  form.flatten();
  const out = await pdf.save();
  return out;
}

export async function GET(req: NextRequest) {
  const dry = req.nextUrl.searchParams.get("dry") ?? "1";
  const payload = dry === "0" ? await getFlushPayload() : await getPreviewPayload();
  const pdfBytes = await fillTemplate(payload as StateFormPayload);
  return new NextResponse(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="stateform-${payload.pageNumber}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

// POST does a "flush + render"
export async function POST() {
  const payload = await getFlushPayload();
  const pdfBytes = await fillTemplate(payload as StateFormPayload);
  return new NextResponse(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="stateform-${payload.pageNumber}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
