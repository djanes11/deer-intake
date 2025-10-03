// lib/pdf.ts (no React/Next imports; builds static HTML; server-only PDF via puppeteer-core)
import 'server-only';

type AnyRec = Record<string, any>;

export async function renderPrintSheetPDF(job: AnyRec & { tag?: string }) {
  const esc = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rows = [
    ['Tag', job.tag],
    ['Customer', job.customer],
    ['Phone', job.phone],
    ['Email', job.email],
    ['Address', [job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')],
    ['Drop-off', job.dropoff],
    ['Status', job.status],
    ['Process Type', job.processType],
    ['Beef Fat', job.beefFat ? 'Yes' : 'No'],
    ['Webbs Order', job.webbsOrder ? 'Yes' : 'No'],
  ];

  const html = `<!DOCTYPE html>
<html><head>
<meta charSet="utf-8" />
<title>Deer Intake — ${esc(job.tag)}</title>
<style>
  @page { size: Letter; margin: 10mm; }
  body { font-family: Arial, sans-serif; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .sub { color:#555; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; text-align: left; }
  th { width: 180px; background: #f8fafc; }
</style>
</head>
<body>
  <h1>Deer Intake</h1>
  <div class="sub">Tag ${esc(job.tag || '')}</div>
  <table>
    ${rows.map(([k,v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
  </table>
</body></html>`;

  // Vercel Lambda: chromium-min + puppeteer-core only (no local fallback)
  const chromium = await import('@sparticuz/chromium-min');
  const puppeteer = await import('puppeteer-core');

  const browser = await puppeteer.launch({
    args: chromium.default.args,
    defaultViewport: chromium.default.defaultViewport,
    executablePath: await chromium.default.executablePath(),
    headless: chromium.default.headless,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    printBackground: true,
    format: 'Letter',
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  });

  await browser.close();
  return Buffer.from(pdf);
}
