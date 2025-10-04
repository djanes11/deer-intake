'use client';
import { useEffect, useRef } from 'react';

/**
 * Keyboard-wedge barcode listener.
 * Collects fast keystrokes; emits on Enter; resets if typing is slow.
 */
export function useScanner(onScan: (code: string) => void, opts?: { resetMs?: number }) {
  const buf = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetMs = opts?.resetMs ?? 150;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const code = buf.current.trim();
        buf.current = '';
        if (code) onScan(code);
        return;
      }
      if (e.key.length === 1) {
        buf.current += e.key;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          buf.current = '';
        }, resetMs);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScan, resetMs]);
}

