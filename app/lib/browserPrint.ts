type CleanupFn = () => void;

export function openBrowserPrintPreview(onAfterPrint?: CleanupFn) {
  if (typeof window === 'undefined') {
    onAfterPrint?.();
    return;
  }

  let done = false;
  let fallbackTimer: number | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener('afterprint', finish);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    onAfterPrint?.();
  };

  window.addEventListener('afterprint', finish, { once: true });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const labelElement = document.querySelector('.print-only .thermalLabelPrintJob') as HTMLElement | null;
        if (labelElement && !document.querySelector('.print-only .printsheet')) {
          window.removeEventListener('afterprint', finish);
          if (fallbackTimer) window.clearTimeout(fallbackTimer);
          openElementPrintPreview(labelElement, {
            onAfterPrint: finish,
            onError: () => finish(),
          });
          return;
        }

        try {
          window.print();
          fallbackTimer = window.setTimeout(finish, 120000);
        } catch {
          finish();
        }
      }, 200);
    });
  });
}

export function openElementPrintPreview(
  element: HTMLElement | null | undefined,
  options: { title?: string; onAfterPrint?: CleanupFn; onError?: (message: string) => void } = {}
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    options.onAfterPrint?.();
    return;
  }

  if (!element) {
    options.onError?.('Could not find the label preview to print.');
    options.onAfterPrint?.();
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.appendChild(frame);

  let done = false;
  let fallbackTimer: number | undefined;

  const cleanup = () => {
    if (done) return;
    done = true;
    frame.contentWindow?.removeEventListener('afterprint', cleanup);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    window.setTimeout(() => {
      frame.remove();
      options.onAfterPrint?.();
    }, 250);
  };

  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    options.onError?.('Could not open the print frame.');
    options.onAfterPrint?.();
    return;
  }

  const safeTitle = escapeHtml(options.title || 'Label');
  const baseHref = `${window.location.origin}/`;
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <base href="${escapeHtml(baseHref)}">
  <style>${thermalLabelPrintCss}</style>
</head>
<body>${element.outerHTML}</body>
</html>`);
  doc.close();

  const printWindow = frame.contentWindow;
  if (!printWindow) {
    frame.remove();
    options.onError?.('Could not open the print frame.');
    options.onAfterPrint?.();
    return;
  }

  printWindow.addEventListener('afterprint', cleanup, { once: true });

  const runPrint = async () => {
    try {
      await waitForFrameImages(doc);
      printWindow.focus();
      printWindow.print();
      fallbackTimer = window.setTimeout(cleanup, 120000);
    } catch {
      cleanup();
    }
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => void runPrint(), 250);
    });
  });
}

function waitForFrameImages(doc: Document) {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          window.setTimeout(resolve, 900);
        })
    )
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

const thermalLabelPrintCss = `
@page {
  size: 4in 2.3125in;
  margin: 0;
}

@page thermal-label {
  size: 4in 2.3125in;
  margin: 0;
}

@page thermal-label-antler {
  size: 2.3125in 4in;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #111111;
}

body {
  width: 4in;
  min-height: 2.3125in;
}

.thermalLabelPrintJob {
  display: block !important;
  background: #ffffff !important;
  color: #111111 !important;
}

.thermalLabelRoot + .thermalLabelRoot {
  margin-top: 0;
}

.thermalLabelRoot {
  display: block !important;
  width: 4in !important;
  height: 2.3125in !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  page: thermal-label;
  break-after: page;
  page-break-after: always;
}

.thermalLabelRoot--antler {
  width: 2.3125in !important;
  height: 4in !important;
  page: thermal-label-antler;
}

.thermalLabelRoot:last-of-type {
  break-after: auto;
  page-break-after: auto;
}

.thermalLabel {
  width: 4in !important;
  height: 2.3125in !important;
  max-height: 2.3125in !important;
  border: 1px solid #111111;
  background: #ffffff;
  color: #111111;
  padding: 0.075in 0.085in;
  display: grid;
  grid-template-rows: 0.31in minmax(0, 0.67in) minmax(0, 0.92in) 0.13in;
  gap: 0.035in;
  font-family: Arial, Helvetica, sans-serif;
  overflow: hidden !important;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.thermalLabel--antler {
  border-width: 1.5px;
  width: 2.3125in !important;
  height: 4in !important;
  max-height: 4in !important;
  padding: 0.08in;
  grid-template-rows: minmax(0, 1fr) 0.18in 0.72in;
  gap: 0.045in;
}

.thermalLabel__top {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  align-items: center;
  gap: 0.08in;
  border-bottom: 2px solid #111111;
  padding-bottom: 0.026in;
}

.thermalLabel__brandWrap {
  display: flex;
  align-items: center;
  gap: 0.06in;
  min-width: 0;
}

.thermalLabel__logo {
  width: 0.26in;
  height: 0.26in;
  display: block;
  object-fit: contain;
  flex: 0 0 auto;
}

.thermalLabel__logoFallback {
  width: 0.26in;
  height: 0.26in;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid #111111;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.thermalLabel__brand {
  min-width: 0;
  max-width: 2.45in;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.8px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  line-height: 1;
}

.thermalLabel__type {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0;
  line-height: 1;
}

.thermalLabel__body {
  display: block;
  min-height: 0;
}

.thermalLabel__details {
  display: grid;
  grid-template-columns: 1.25fr 0.95fr;
  gap: 0.035in 0.12in;
  min-width: 0;
  min-height: 0;
}

.thermalLabel__field {
  display: grid;
  grid-template-columns: 0.52in minmax(0, 1fr);
  align-items: baseline;
  gap: 0.045in;
  min-width: 0;
  min-height: 0;
}

.thermalLabel__field--customer {
  grid-column: 1 / -1;
  align-items: start;
  grid-template-columns: 0.74in minmax(0, 1fr);
}

.thermalLabel__label {
  font-size: 8.6px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0;
  line-height: 1;
  white-space: nowrap;
}

.thermalLabel__fieldValue {
  min-width: 0;
  font-size: 14.6px;
  font-weight: 800;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.thermalLabel__field--customer .thermalLabel__fieldValue {
  font-size: 19px;
  font-weight: 900;
  line-height: 1;
}

.thermalLabel__field--customer.thermalLabel__fieldValue--small .thermalLabel__fieldValue {
  font-size: 16px;
  line-height: 1;
}

.thermalLabel__field--customer.thermalLabel__fieldValue--tiny .thermalLabel__fieldValue {
  font-size: 13.4px;
  line-height: 1;
}

.thermalLabel__field:not(.thermalLabel__field--customer) .thermalLabel__fieldValue {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thermalLabel__secondary {
  display: grid;
  align-content: center;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.1;
}

.thermalLabel__footer {
  border-top: 2px solid #111111;
  padding-top: 0.028in;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thermalLabel__barcodeWrap {
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border: 2px solid #111111;
  padding: 0.035in 0.04in;
  background: #ffffff;
}

.thermalLabel__barcodeWrap svg {
  width: 100%;
  max-width: 3.72in;
  height: 0.86in;
  display: block;
}

.thermalLabel__antlerInfo {
  display: grid;
  grid-template-rows: 0.34in 0.28in minmax(0, 1fr) 0.16in;
  gap: 0.055in;
  min-height: 0;
  overflow: hidden;
}

.thermalLabel__antlerBrandRow {
  display: flex;
  align-items: center;
  gap: 0.055in;
  min-width: 0;
  border-bottom: 2px solid #111111;
  padding-bottom: 0.035in;
}

.thermalLabel--antler .thermalLabel__brand {
  max-width: 1.8in;
  font-size: 8.8px;
}

.thermalLabel__antlerTitle {
  font-size: 21px;
  font-weight: 950;
  line-height: 0.95;
  text-transform: uppercase;
  letter-spacing: 0;
}

.thermalLabel__antlerFields {
  display: grid;
  grid-template-rows: minmax(0, 0.62in) repeat(3, minmax(0, 0.36in));
  gap: 0.055in;
  min-height: 0;
}

.thermalLabel__antlerField {
  min-width: 0;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 0.012in;
  border-bottom: 1px solid #111111;
  padding-bottom: 0.025in;
}

.thermalLabel__antlerLabel {
  font-size: 9.2px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0;
}

.thermalLabel__antlerValue {
  min-width: 0;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thermalLabel__antlerField--customer .thermalLabel__antlerValue {
  font-size: 20px;
  line-height: 1.02;
  white-space: normal;
  overflow-wrap: anywhere;
  max-height: 0.43in;
  overflow: hidden;
}

.thermalLabel__antlerField--customer.thermalLabel__fieldValue--small .thermalLabel__antlerValue {
  font-size: 17px;
}

.thermalLabel__antlerField--customer.thermalLabel__fieldValue--tiny .thermalLabel__antlerValue {
  font-size: 14px;
}

.thermalLabel__antlerFooter {
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  border-top: 2px solid #111111;
  padding-top: 0.035in;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thermalLabel__cutLine {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 2px dotted #111111;
  color: #111111;
  font-size: 7.8px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0;
  min-height: 0;
}

.thermalLabel__cutLine span {
  display: inline-block;
  background: #ffffff;
  padding: 0 0.04in;
  transform: translateY(-0.01in);
}

.thermalLabel__barcodeWrap--antler,
.thermalLabel__secondary--antler {
  padding: 0.035in;
}

.thermalLabel__barcodeWrap--antler svg {
  max-width: 2.05in;
  height: 0.58in;
}
`;
