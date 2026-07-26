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
  size: 3.5in 1.125in;
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
  width: 3.5in;
  min-height: 1.125in;
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
  width: 3.5in !important;
  height: 1.125in !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  page: thermal-label;
  break-after: page;
  page-break-after: always;
}

.thermalLabelRoot:last-of-type {
  break-after: auto;
  page-break-after: auto;
}

.thermalLabel {
  width: 3.5in !important;
  height: 1.125in !important;
  max-height: 1.125in !important;
  border: 1px solid #111111;
  background: #ffffff;
  color: #111111;
  padding: 0.035in 0.045in;
  display: grid;
  grid-template-rows: 0.2in minmax(0, 1fr) 0.1in;
  gap: 0.014in;
  font-family: Arial, Helvetica, sans-serif;
  overflow: hidden !important;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.thermalLabel--antler {
  border-width: 1.5px;
}

.thermalLabel__top {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  align-items: center;
  gap: 0.05in;
  border-bottom: 1px solid #111111;
  padding-bottom: 0.012in;
}

.thermalLabel__brandWrap {
  display: flex;
  align-items: center;
  gap: 0.035in;
  min-width: 0;
}

.thermalLabel__logo {
  width: 0.18in;
  height: 0.18in;
  display: block;
  object-fit: contain;
  flex: 0 0 auto;
}

.thermalLabel__logoFallback {
  width: 0.18in;
  height: 0.18in;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid #111111;
  font-size: 6px;
  font-weight: 900;
  line-height: 1;
}

.thermalLabel__brand {
  min-width: 0;
  max-width: 1.62in;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 6.8px;
  font-weight: 800;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  line-height: 1;
}

.thermalLabel__type {
  flex: 0 0 auto;
  font-size: 8px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
}

.thermalLabel__body {
  display: grid;
  grid-template-columns: minmax(0, 2.12in) minmax(0, 1.18in);
  gap: 0.045in;
  align-items: stretch;
  min-height: 0;
}

.thermalLabel__details {
  display: grid;
  grid-template-rows: minmax(0, 1.35fr) repeat(3, minmax(0, 1fr));
  gap: 0.012in;
  min-width: 0;
  min-height: 0;
}

.thermalLabel__field {
  display: grid;
  grid-template-columns: 0.42in minmax(0, 1fr);
  align-items: baseline;
  gap: 0.03in;
  min-width: 0;
  min-height: 0;
}

.thermalLabel__field--customer {
  align-items: start;
}

.thermalLabel__label {
  font-size: 6.2px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
}

.thermalLabel__fieldValue {
  min-width: 0;
  font-size: 8.3px;
  font-weight: 800;
  line-height: 1.04;
  overflow-wrap: anywhere;
}

.thermalLabel__field--customer .thermalLabel__fieldValue {
  font-size: 8.8px;
  font-weight: 900;
  line-height: 1;
}

.thermalLabel__field--customer.thermalLabel__fieldValue--small .thermalLabel__fieldValue {
  font-size: 7.4px;
  line-height: 1;
}

.thermalLabel__field--customer.thermalLabel__fieldValue--tiny .thermalLabel__fieldValue {
  font-size: 6.4px;
  line-height: 1;
}

.thermalLabel__field:not(.thermalLabel__field--customer) .thermalLabel__fieldValue {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thermalLabel__secondary {
  font-size: 8px;
  font-weight: 800;
  line-height: 1.05;
}

.thermalLabel__footer {
  border-top: 1px solid #111111;
  padding-top: 0.012in;
  font-size: 6.2px;
  font-weight: 700;
  letter-spacing: 0.03em;
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
}

.thermalLabel__barcodeWrap svg {
  width: 100%;
  max-width: 1.18in;
  height: 0.42in;
  display: block;
}
`;
