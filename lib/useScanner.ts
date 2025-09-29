'use client';
import { useEffect, useRef } from 'react';

/**
 * useScanner - captures fast keyboard-wedge barcode scans that end with Enter.
 * Resets buffer if typing is slow (i.e., a human).
 */
export function useScanner(onScan: (code: string) => void, opts?: { resetMs?: number }) {
  const buf = useRef('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => (buf.current = ''), resetMs);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScan, resetMs]);
}
