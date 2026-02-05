'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Options = {
  when: boolean;                 // true => guard is active
  message?: string;              // confirm text
  onConfirmLeave?: () => void;   // optional callback when user confirms leaving
};

/**
 * Blocks navigation when `when` is true:
 * - hard nav (refresh/close) via beforeunload
 * - Next.js client nav by intercepting clicks on internal <a>
 * - browser Back/Forward via popstate + a guard history state
 *
 * Why the Back/Forward trick:
 * App Router doesn't expose beforePopState. So we push a "guard" state entry
 * when dirty. Pressing Back hits that entry first; if user cancels, we re-push it.
 */
export function useUnsavedChanges(opts: Options) {
  const { when, message = 'You have unsaved changes. Leave without saving?', onConfirmLeave } = opts;

  const router = useRouter();
  const pathname = usePathname();

  const armedRef = useRef(false);
  const allowPopRef = useRef(false);
  const guardKeyRef = useRef('__unsaved_guard__');

  // (A) Refresh/close/tab close
  useEffect(() => {
    if (!when) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  // (B) Intercept internal anchor clicks (client nav)
  useEffect(() => {
    if (!when) return;

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const a = (t.closest ? t.closest('a') : null) as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute('href') || '';
      if (!href) return;

      // Ignore new tab / download / mailto/tel / hash-only
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('#')) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // If only hash changes on same page, don't bother guarding
      const cur = new URL(window.location.href);
      const samePath = url.pathname === cur.pathname && url.search === cur.search;
      if (samePath && url.hash !== cur.hash) return;

      const ok = window.confirm(message);
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      onConfirmLeave?.();
      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [when, message, router, onConfirmLeave]);

  // (C) Back/Forward guard via popstate + guard history state
  useEffect(() => {
    // Arm/disarm the guard state depending on `when`
    if (when) {
      // Push a guard state once per "dirty session"
      if (!armedRef.current) {
        try {
          const st = window.history.state || {};
          // Don't stack multiple guards
          if (!st?.[guardKeyRef.current]) {
            window.history.pushState({ ...st, [guardKeyRef.current]: true }, '', window.location.href);
          }
          armedRef.current = true;
        } catch {
          // ignore
        }
      }
    } else {
      // Disarm: allow normal back/forward again
      armedRef.current = false;
      allowPopRef.current = false;
      return;
    }

    const onPopState = (e: PopStateEvent) => {
      // If we explicitly allowed pop (user confirmed), do nothing.
      if (allowPopRef.current) return;

      // Only guard when currently dirty.
      if (!when) return;

      const ok = window.confirm(message);
      if (!ok) {
        // User cancelled: re-push the guard so URL stays put.
        try {
          const st = window.history.state || {};
          window.history.pushState({ ...st, [guardKeyRef.current]: true }, '', window.location.href);
        } catch {
          // ignore
        }
        return;
      }

      // User confirmed: allow one pop, then actually go back one more step
      // because the first Back only hit our guard entry.
      onConfirmLeave?.();
      allowPopRef.current = true;
      try {
        window.history.go(-1);
      } catch {
        // fallback: hard nav to previous (rare)
      } finally {
        // reset shortly after to re-arm if they come back dirty again
        setTimeout(() => { allowPopRef.current = false; }, 250);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [when, message, onConfirmLeave, pathname]);
}
