// app/api/stateform/render/route.ts
// Renders the Indiana DNR State Form 19433 PDF filled from your GAS payload.
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const runtime = 'nodejs';

const GAS = process.env.NEXT_PUBLIC_API_BASE!;
const TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || process.env.NEXT_PUBLIC_API_KEY || '';

// Try to load from /public/forms/19433.pdf by default.
async function loadTemplateBytes() {
  const fp = path.join(process.cwd(), 'public', 'forms', '19433.pdf');
  return fs.readFile(fp);
}

async function fetchPayload(dry: boolean) {
  const url = `${GAS}?action=stateform_payload&dry=${dry ? '1' : '0'}${TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('GAS stateform_payload failed');
  return res.json();
}

type Entry = {
  dateIn?: string; dateOut?: string; name?: string; address?: string; phone?: string;
  sex?: string; whereKilled?: string; howKilled?: string; donated?: string; confirmation?: string;
};

// Coordinates are based on US Letter (612x792). Adjust if your template differs.
// We fill two pages if > 18 entries.
function headerCoords() {
  return {
    year:         { x: 545, y: 742, size: 11 },
    pageNumber:   { x: 595, y: 742, size: 11 },
    processorName:{ x: 60,  y: 720, size: 10 },
    processorLoc: { x: 298, y: 720, size: 10 },
    processorCounty:{x: 465, y: 720, size: 10 },
    street:       { x: 60,  y: 704, size: 10 },
    city:         { x: 360, y: 704, size: 10 },
    zip:          { x: 520, y: 704, size: 10 },
    phone:        { x: 60,  y: 688, size: 10 },
  };
}

function rowLayout(pageIndex: number) {
  // Page 0 has rows 1..18; Page 1 has rows 19..44 (26 rows).
  const topY = pageIndex === 0 ? 660 : 700;
  const rowH = pageIndex === 0 ? 18 : 15; // the second sheet is slightly tighter
  // Column x positions
  return {
    startY: topY,
    rowH,
    cols: {
      dateIn:       60,
      dateOut:      110,
      name:         160,
      address:      290,
      phone:        440,
      sex:          505,
      whereKilled:  525,
      howKilled:    585,
      donated:      625,
      confirmation: 660
    }
  };
}

export async function GET(req: NextRequest) {
  const dry = (req.nextUrl.searchParams.get('dry') ?? '1') === '1';
  const payload = await fetchPayload(dry);

  const templateBytes = await loadTemplateBytes();
  const pdf = await PDFDocument.load(templateBytes);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const draw = (page: any, text: string, x: number, y: number, size = 10) =>
    page.drawText(String(text ?? ''), { x, y, size, font: helv });

  const ensurePage = (idx: number) => {
    while (pdf.getPageCount() <= idx) {
      pdf.addPage([612, 792]);
    }
    return pdf.getPage(idx);
  };

  // Page 1 header
  const p0 = ensurePage(0);
  const H = headerCoords();
  draw(p0, payload.pageYear,           H.year.x,           H.year.y,           H.year.size);
  draw(p0, String(payload.pageNumber), H.pageNumber.x,     H.pageNumber.y,     H.pageNumber.size);
  draw(p0, payload.processorName,      H.processorName.x,  H.processorName.y,  H.processorName.size);
  draw(p0, payload.processorLocation,  H.processorLoc.x,   H.processorLoc.y,   H.processorLoc.size);
  draw(p0, payload.processorCounty,    H.processorCounty.x,H.processorCounty.y,H.processorCounty.size);
  draw(p0, payload.processorStreet,    H.street.x,         H.street.y,         H.street.size);
  draw(p0, payload.processorCity,      H.city.x,           H.city.y,           H.city.size);
  draw(p0, payload.processorZip,       H.zip.x,            H.zip.y,            H.zip.size);
  draw(p0, payload.processorPhone,     H.phone.x,          H.phone.y,          H.phone.size);

  // Rows
  const entries: Entry[] = Array.isArray(payload.entries) ? payload.entries : [];
  const firstPageCount = Math.min(entries.length, 18);
  const L0 = rowLayout(0);
  for (let i = 0; i < firstPageCount; i++) {
    const y = L0.startY - i * L0.rowH;
    const e = entries[i] || {};
    draw(p0, e.dateIn || '',       L0.cols.dateIn,       y);
    draw(p0, e.dateOut || '',      L0.cols.dateOut,      y);
    draw(p0, e.name || '',         L0.cols.name,         y);
    draw(p0, e.address || '',      L0.cols.address,      y);
    draw(p0, e.phone || '',        L0.cols.phone,        y);
    draw(p0, e.sex || '',          L0.cols.sex,          y);
    draw(p0, e.whereKilled || '',  L0.cols.whereKilled,  y);
    draw(p0, e.howKilled || '',    L0.cols.howKilled,    y);
    draw(p0, e.donated || '',      L0.cols.donated,      y);
    draw(p0, e.confirmation || '', L0.cols.confirmation, y);
  }

  // Second page if needed
  if (entries.length > 18) {
    const p1 = ensurePage(1);
    const L1 = rowLayout(1);
    for (let j = 18; j < entries.length; j++) {
      const rowIdx = j - 18;
      const y = L1.startY - rowIdx * L1.rowH;
      const e = entries[j] || {};
      draw(p1, e.dateIn || '',       L1.cols.dateIn,       y);
      draw(p1, e.dateOut || '',      L1.cols.dateOut,      y);
      draw(p1, e.name || '',         L1.cols.name,         y);
      draw(p1, e.address || '',      L1.cols.address,      y);
      draw(p1, e.phone || '',        L1.cols.phone,        y);
      draw(p1, e.sex || '',          L1.cols.sex,          y);
      draw(p1, e.whereKilled || '',  L1.cols.whereKilled,  y);
      draw(p1, e.howKilled || '',    L1.cols.howKilled,    y);
      draw(p1, e.donated || '',      L1.cols.donated,      y);
      draw(p1, e.confirmation || '', L1.cols.confirmation, y);
    }
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': dry ? 'inline; filename="stateform-preview.pdf"' : 'attachment; filename="stateform.pdf"'
    }
  });
}
