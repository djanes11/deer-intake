// app/api/stateform/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { gasGetServer } from "@/lib/stateform/server";
import { headerFields, pdfFieldMap } from "@/lib/stateform/map";

export const runtime = "nodejs";

// draw a string into a text field if it exists
function setField(form: any, name: string, value: string | number | undefined) {
  if (value == null) value = "";
  const f = form.getFieldMaybe ? form.getFieldMaybe(name) : (() => {
    try { return form.getTextField(name); } catch { return null; }
  })();
  if (f && f.setText) f.setText(String(value));
}

// Checkbox helpers (for BUCK/DOE/ANTLERLESS group)
function setSex(form: any, fieldName: string, sex: string | undefined) {
  const v = String(sex || "").toUpperCase();
  try {
    // Some forms have a single text field; if so, just write text
    const tf = form.getTextField(fieldName);
    if (tf) { tf.setText(v); return; }
  } catch {} // fallthrough

  // Otherwise assume 3 checkboxes named fieldName + options (rare)
  try { if (v === "BUCK") form.getCheckBox(fieldName + " BUCK").check(); } catch {}
  try { if (v === "DOE") form.getCheckBox(fieldName + " DOE").check(); } catch {}
  try { if (v === "ANTLERLESS") form.getCheckBox(fieldName + " ANTLERLESS").check(); } catch {}
}

async function renderPdf(payload: any): Promise<Uint8Array> {
  const pdfPath = path.join(process.cwd(), "public", "stateform", "19433.pdf");
  const bytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  // Headers
  setField(form, headerFields.year, payload.pageYear);
  setField(form, headerFields.pageNumber, payload.pageNumber);
  setField(form, headerFields.processorName, payload.processorName);
  setField(form, headerFields.processorLocation, payload.processorLocation);
  setField(form, headerFields.processorCounty, payload.processorCounty);
  setField(form, headerFields.processorStreet, payload.processorStreet);
  setField(form, headerFields.processorCity, payload.processorCity);
  setField(form, headerFields.processorZip, payload.processorZip);

  // Lines 1..44
  const entries: any[] = Array.isArray(payload.entries) ? payload.entries : [];
  for (let i = 1; i <= 44; i++) {
    const m = pdfFieldMap(i);
    const e = entries[i - 1] || {};
    setField(form, m.dateIn, e.dateIn || "");
    setField(form, m.dateOut, e.dateOut || "");
    setField(form, m.name, e.name || "");
    setField(form, m.address, e.address || "");
    setField(form, m.phone, e.phone || "");
    // sex is special: either a text field or 3 checkboxes in some PDFs
    setSex(form, m.sex, e.sex || "");
    setField(form, m.whereKilled, e.whereKilled || "");
    setField(form, m.howKilled, e.howKilled || "");
    setField(form, m.donated, e.donated || "N");
    setField(form, m.confirmation, e.confirmation || "");
  }

  try { form.flatten(); } catch {}
  return await pdfDoc.save();
}

// GET → preview (dry=1) OR flush (dry=0) based on query
export async function GET(req: NextRequest) {
  const dry = (new URL(req.url)).searchParams.get("dry") ?? "1";
  // fetch JSON payload from GAS via our proxy (absolute URL)
  const payload = await gasGetServer(req, { action: "stateform_payload", dry });
  if (!payload?.ok) {
    return NextResponse.json(payload ?? { ok: false, error: "payload error" }, { status: 500 });
  }
  const pdf = await renderPdf(payload);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": dry === "1" ? "inline; filename=stateform-preview.pdf"
                                         : `attachment; filename=stateform-${payload.pageNumber}.pdf`,
      "cache-control": "no-store",
    },
  });
}

// POST → always flush (dry=0)
export async function POST(req: NextRequest) {
  const payload = await gasGetServer(req, { action: "stateform_payload", dry: 0 });
  if (!payload?.ok) {
    return NextResponse.json(payload ?? { ok: false, error: "payload error" }, { status: 500 });
  }
  const pdf = await renderPdf(payload);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=stateform-${payload.pageNumber}.pdf`,
      "cache-control": "no-store",
    },
  });
}

