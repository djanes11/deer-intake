  // Prefer chromium-min on Vercel (no local fallback)
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
