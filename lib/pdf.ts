// lib/pdf.ts
// Render a server-side HTML snapshot of PrintSheet and convert to PDF using puppeteer-core + chrome-aws-lambda (works on Vercel).

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { Job } from '@/lib/api';
import PrintSheet from '@/app/components/PrintSheet';

export async function renderPrintSheetPDF(job: Job & { tag?: string }) {
  // 1) Render HTML string
  const html = ReactDOMServer.renderToString(
    React.createElement(PrintSheet as any, { tag: job.tag || job['Tag'], job })
  );

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charSet="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Deer Intake — ${job.tag || ''}</title>
<style>
  /* basic print css reset so puppeteer fits Letter */
  @page { size: Letter; margin: 8mm; }
  body { margin: 0; }
</style>
</head>
<body>${html}</body>
</html>`;

  // 2) Use headless chromium
  const isVercel = !!process.env.VERCEL;
  try {
    const chromium = await import('@sparticuz/chromium-min');
    const puppeteer = await import('puppeteer-core');
    const browser = await puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      printBackground: true,
      format: 'Letter',
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch (err) {
    // Fallback: try regular puppeteer (dev)
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' as any });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      printBackground: true,
      format: 'Letter',
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
    await browser.close();
    return Buffer.from(pdf);
  }
}
