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
    window.removeEventListener('focus', onFocus);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    onAfterPrint?.();
  };

  const onFocus = () => {
    window.setTimeout(finish, 250);
  };

  window.addEventListener('afterprint', finish, { once: true });
  window.addEventListener('focus', onFocus, { once: true });

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
