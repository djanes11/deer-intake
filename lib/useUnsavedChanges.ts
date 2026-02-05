'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Options = {
  when: boolean;                 // true => warn
  message?: string;              // used for in-app confirms (not browser prompt)
  onConfirmLeave?: () => void;   // optional callback when user confirms leave
};

/**
 * Unsaved-changes guard:
 * - Browser close/refresh/address-bar nav: beforeunload (generic browser prompt)
 * - In-app link clicks: confirm() then router.push()
 *
 * NOTE: Browsers do NOT allow custom text in the beforeunload prompt anymore.
 */
export function useUnsavedChanges({ when, message, onConfirmLeave }: Options) {
  const router = useRouter();
  const enabledRef = useRef(when);
  enabledRef.current = when;

  // Tab close / refresh / address bar nav
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // In-app navigation via <a href="/...">
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // left click only
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const a = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute('href') || '';
      // only intercept internal navigations
      if (!href.startsWith('/') || a.target === '_blank') return;

      e.preventDefault();
      const ok = window.confirm(message || 'You have unsaved changes. Leave without saving?');
      if (!ok) return;

      onConfirmLeave?.();
      router.push(href);
    };

    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [router, message, onConfirmLeave]);
}
