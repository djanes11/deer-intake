// app/api/stateform/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument } from "pdf-lib";
import { gasGetServer } from "@/lib/stateform/server";
import { headerFields, pdfFieldMap } from "@/lib/stateform/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safe text write to a form field (no-throw if field not present). */
function setField(form: any, name: string | undefined, value: string | number | undefined) {
  if (!name) return;
  const text = value == null ? "" : String(value);
  try {
    const tf = form.getTextField(name);
    if (tf) tf.setText(text);
  } catch {
    // ignore missing field
  }
}

/** Sex field can be a single text field or multiple checkboxes depending on the PDF. */
function setSex(form: any, baseName: string | undefined, sex: string | undefined) {
  if (!baseName) return;
  const v = String(sex || "").toUpperCase();
  // Try a single text field first
  try {
    const tf = form.getTextField(baseName);
    if (tf) {
      tf.setText(v);
      return;
    }
  } catch {
    /* fall through */
  }
  // Otherwise try checkbox variants
  try {
    if (v === "BUCK") form.getCheckBox(`${baseName} BUCK`).check();
  } catch {}
  try {
    if (v === "DOE") form.getCheckBox(`${baseName} DOE`).check();
  } catch {}
  try {
    if (v === "ANTLERLESS") form.getCheckBox(`${baseName} ANTLERLESS`).check();
  } catch {}
}

async function loadTemplate() {
  // Adjust this path if you keep the form elsewhere
  const pdfPath = path.join(process.cwd(), "public", "stateform", "19433.pdf");
  const bytes = await readFile(pdfPath);
  return PDFDocument.load(bytes);
}

/** Fill the PDF and return raw bytes. */
async function renderPdf(payload: any): Promise<Uint8Array> {
  const pdfDoc = await loadTemplate();
  const form = pdfDoc.getForm();

  // ---- Header fields ----
  setField(form, headerFields.year, payload.pageYear);
  setField(form, headerFields.pageNumber, payload.pageNumber);
  setField(form, headerFields.processorName, payload.processorName);
  setField(form, headerFields.processorLocation, payload.processorLocation);
  setField(form, headerFields.processorCounty, payload.processorCounty);
  setField(form, headerFields.processorStreet, payload.processorStreet);
  setField(form, headerFields.processorCity, payload.processorCity);
  setField(form, headerFields.processorZip, payload.processorZip);

  // Split phone into Area Code + Phone Number if your PDF uses two fields
  {
    const raw = (payload.processorPhone ?? "") as string;
    const s = raw.replace(/\s+/g, "");
    // Pull 3-digit area + the rest (accepts (502)643-3916, 502-643-3916, 5026433916, etc.)
    const m = s.match(/\(?(\d{3})\)?[-.\s]*(\d{3}[-.\s]?\d{4}|\d+)/);
    const area = m?.[1] || "";
    const rest = m?.[2] || "";
    setField(form, headerFields.processorAreaCode, area);
    setField(form, headerFields.processorPhoneNumber, rest);
  }

  // ---- Line items (1..44) ----
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
    // default donated to "N" if blank
    setField(form, m.donated, e.donated || "N");
    setField(form, m.confirmation, e.confirmation || "");
  }

  // Flatten so fields become plain text for printing
  try {
    form.flatten();
  } catch {
    // ignore if flatten not supported for some field types
  }

  return pdfDoc.save();
}

/** GET → preview (dry=1) or download (dry=0). Also supports debug=1 to list field names. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") ?? "1";
  const debug = url.searchParams.get("debug") === "1";

  if (debug) {
    const pdfDoc = await loadTemplate();
    const form = pdfDoc.getForm();
    const fields = form.getFields().map((f: any) => f.getName());
    return NextResponse.json({ ok: true, fields }, { status: 200 });
  }

  // Pull the JSON payload from GAS via our server-side proxy
  const payload = await gasGetServer(req, { action: "stateform_payload", dry });
  if (!payload?.ok) {
    return NextResponse.json(payload ?? { ok: false, error: "payload error" }, { status: 500 });
  }

  const pdfBytes = await renderPdf(payload);

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

/** POST → always flush-render (dry=0) and download. */
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
