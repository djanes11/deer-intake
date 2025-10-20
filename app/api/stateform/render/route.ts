// app/api/stateform/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { gasGetServer } from "@/lib/stateform/server";
import { headerFields, pdfFieldMap } from "@/lib/stateform/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Write text into a form field if present (no-throw). */
function setField(form: any, name: string, value: string | number | undefined) {
  const text = value == null ? "" : String(value);
  try {
    const tf = form.getTextField(name);
    tf?.setText(text);
    return;
  } catch {}
}

/** Handle sex field (some PDFs have one text field; others 3 checkboxes). */
function setSex(form: any, fieldName: string, sex: string | undefined) {
  const v = String(sex || "").toUpperCase();
  try {
    const tf = form.getTextField(fieldName);
    tf?.setText(v);
    return;
  } catch {}
  try { if (v === "BUCK") form.getCheckBox(`${fieldName} BUCK`).check(); } catch {}
  try { if (v === "DOE") form.getCheckBox(`${fieldName} DOE`).check(); } catch {}
  try { if (v === "ANTLERLESS") form.getCheckBox(`${fieldName} ANTLERLESS`).check(); } catch {}
}

async function renderPdf(payload: any): Promise<Uint8Array> {
  const pdfPath = path.join(process.cwd(), "public", "stateform", "19433.pdf");
  const bytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  // OPTIONAL: dev-only dump of field names to help mapping header fields
  if (process.env.NODE_ENV !== "production" && payload?.debugFields === true) {
    const names = form.getFields().map((f: any) => f.getName());
    throw new Error("PDF_FIELDS::" + JSON.stringify(names));
  }

  // Header fields
  setField(form, headerFields.year, payload.pageYear);
  setField(form, headerFields.pageNumber, payload.pageNumber);
  setField(form, headerFields.processorName, payload.processorName);
  setField(form, headerFields.processorLocation, payload.processorLocation);
  setField(form, headerFields.processorCounty, payload.processorCounty);
  setField(form, headerFields.processorStreet, payload.processorStreet);
  setField(form, headerFields.processorCity, payload.processorCity);
  setField(form, headerFields.processorZip, payload.processorZip);
  setField(form, headerFields.processorPhone, payload.processorPhone);

  // Line items (1..44)
  const entries: any[] = Array.isArray(payload.entries) ? payload.entries : [];
  for (let i = 1; i <= 44; i++) {
    const m = pdfFieldMap(i);
    const e = entries[i - 1] || {};
    setField(form, m.dateIn, e.dateIn || "");
    setField(form, m.dateOut, e.dateOut || "");
    setField(form, m.name, e.name || "");
    setField(form, m.address, e.address || "");
    setField(form, m.phone, e.phone || "");
    setSex(form, m.sex, e.sex || "");
    setField(form, m.whereKilled, e.whereKilled || "");
    setField(form, m.howKilled, e.howKilled || "");
    setField(form, m.donated, e.donated || "N");
    setField(form, m.confirmation, e.confirmation || "");
  }

  try { form.flatten(); } catch {}
  return pdfDoc.save();
}

/** GET → preview (dry=1) or flush (dry=0) */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") ?? "1";
  const debug = url.searchParams.get("debug") === "1";

  const payload = await gasGetServer(req, { action: "stateform_payload", dry });
  if (!payload?.ok) {
    return NextResponse.json(payload ?? { ok: false, error: "payload error" }, { status: 500 });
  }

  const pdfBytes = await renderPdf({ ...payload, debugFields: debug });
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition":
        dry === "1"
          ? "inline; filename=stateform-preview.pdf"
          : `attachment; filename=stateform-${payload.pageNumber}.pdf`,
      "cache-control": "no-store",
    },
  });
}

/** POST → always flush-render (dry=0) */
export async function POST(req: NextRequest) {
  const payload = await gasGetServer(req, { action: "stateform_payload", dry: 0 });
  if (!payload?.ok) {
    return NextResponse.json(payload ?? { ok: false, error: "payload error" }, { status: 500 });
  }

  const pdfBytes = await renderPdf(payload);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=stateform-${payload.pageNumber}.pdf`,
      "cache-control": "no-store",
    },
  });
}
