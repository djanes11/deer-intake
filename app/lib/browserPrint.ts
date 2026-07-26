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
