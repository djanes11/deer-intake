import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FONT_SIZE = 9;
const SHOP_TIME_ZONE = 'America/New_York';
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Rect = { x: number; y: number; width: number; height: number };

export function digitsOnly(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

export function formatDateMMDDYY(v: any) {
  const s = String(v || '').trim();
  if (!s) return '';
  const dateOnly = s.match(DATE_ONLY_RE);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${month}/${day}/${year.slice(-2)}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(d);
}

export function currentSeasonStart() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

export function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function nextMonthStart() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

export function currentMonthLabel() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function splitAddress(address: string) {
  const raw = String(address || '').trim();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const street = parts[0] || raw;
  const city = parts[1] || 'Palmyra';
  const stateZip = parts[2] || 'IN 47164';
  const zip = (stateZip.match(/\b(\d{5}(?:-\d{4})?)\b/) || [])[1] || '47164';
  return { street, city, zip };
}

export function buildAddress(row: any) {
  return [row?.address, row?.city, row?.state, row?.zip].filter(Boolean).join(' ');
}

export function normalizeSex(v: any) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('buck')) return 'Buck';
  if (s.includes('doe')) return 'Doe';
  if (s.includes('antler')) return 'Antlerless';
  return String(v || '').trim();
}

export function normalizeHowKilled(v: any) {
  const s = String(v || '').trim().toLowerCase();
  if (s.includes('gun')) return 'Gun';
  if (s.includes('arch')) return 'Archery';
  if (s.includes('veh')) return 'Vehicle';
  return String(v || '').trim();
}

export function donatedValue(row: any) {
  const proc = String(row?.process_type || '').toLowerCase();
  return proc.includes('donate') ? 'Y' : 'N';
}

export function stateformDateOut(row: any) {
  if (row?.picked_up_processing_at) {
    return formatDateMMDDYY(row.picked_up_processing_at);
  }
  if (row?.picked_up_processing && row?.updated_at) {
    return formatDateMMDDYY(row.updated_at);
  }
  return '';
}

export function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function loadPdfTemplate(relativePath: string) {
  const formPath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(formPath);
}

export function getFieldRect(form: any, name: string): Rect | null {
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

export function requireFieldRect(form: any, name: string): Rect {
  const rect = getFieldRect(form, name);
  if (!rect) {
    throw new Error(`Missing PDF field rectangle for "${name}"`);
  }
  return rect;
}

export async function createPdfFonts(pdf: PDFDocument) {
  return {
    helv: await pdf.embedFont(StandardFonts.Helvetica),
    helvBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

export function drawTextInRect(
  page: any,
  text: any,
  rect: Rect,
  font: any,
  size = FONT_SIZE,
  paddingX = 2,
) {
  if (text === undefined || text === null || text === '') return;
  const baselineOffset = Math.max((rect.height - size) / 2, 1);
  page.drawText(String(text), {
    x: rect.x + paddingX,
    y: rect.y + baselineOffset,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}
