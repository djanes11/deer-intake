'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Tone = 'info' | 'warning' | 'danger' | 'success';

export default function AlertBanner({
  id = 'top-banner',
  text,
  tone = 'warning',
  linkText,
  linkHref,
  dismissible = true,
}: {
  id?: string;
  text?: string | null;
  tone?: Tone;
  linkText?: string | null;
  linkHref?: string | null;
  dismissible?: boolean;
}) {
  // If no text, render nothing (lets you turn it off from env)
  if (!text) return null;

  const lsKey = useMemo(() => `alert:${id}:${text}`, [id, text]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!dismissible) return;
    try {
      const v = localStorage.getItem(lsKey);
      if (v === '1') setHidden(true);
    } catch {}
  }, [lsKey, dismissible]);

  if (hidden) return null;

  const toneStyles: Record<Tone, { bg: string; border: string; text: string }> = {
    info:    { bg: '#0b1730', border: '#284b9b', text: '#cfe0ff' },
    warning: { bg: '#2a1e07', border: '#8a6b1b', text: '#f9e6b3' },
    danger:  { bg: '#2a0e0e', border: '#8a2b2b', text: '#ffd6d6' },
    success: { bg: '#0f261c', border: '#2c6b4d', text: '#cfeedd' },
  };

  const s = toneStyles[tone] || toneStyles.warning;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        borderBottom: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <strong style={{ letterSpacing: 0.2 }}>Notice:</strong>
        <span style={{ flex: 1 }}>{text}</span>
        {linkText && linkHref ? (
          <Link
            href={linkHref}
            style={{
              fontWeight: 800,
              textDecoration: 'underline',
              whiteSpace: 'nowrap',
            }}
          >
            {linkText}
          </Link>
        ) : null}
        {dismissible ? (
          <button
            onClick={() => {
              try { localStorage.setItem(lsKey, '1'); } catch {}
              setHidden(true);
            }}
            aria-label="Dismiss announcement"
            style={{
              appearance: 'none',
              border: '1px solid rgba(255,255,255,.2)',
              background: 'transparent',
              color: s.text,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
