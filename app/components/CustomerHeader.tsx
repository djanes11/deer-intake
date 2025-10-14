// components/CustomerHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import * as React from 'react';

type NavLink = { href: string; label: string; exact?: boolean };

export default function CustomerHeader({
  brand = 'McAfee Custom Deer Processing',
  crestSrc = '/crest.png', // put your crest into /public/crest.png or pass a URL
  nav = [
    { href: '/', label: 'Home', exact: true },
    { href: '/status', label: 'Check Status' },
    { href: '/overnight', label: 'Overnight Drop' },
    { href: '/faq-public', label: 'FAQ' },
    { href: '/contact', label: 'Contact' },
  ],
}: {
  brand?: string;
  crestSrc?: string;
  nav?: NavLink[];
}) {
  const pathname = usePathname() || '/';

  const isActive = (l: NavLink) =>
    l.exact ? pathname === l.href : pathname.startsWith(l.href);

  return (
    <header style={header}>
      <div style={left}>
        <div style={crestWrap}>
          {/* If crest is missing, show a green square fallback */}
          {crestSrc ? (
            <Image
              src={crestSrc}
              alt="McAfee crest"
              width={36}
              height={36}
              priority
              style={{ borderRadius: 8, objectFit: 'cover' }}
            />
          ) : (
            <span aria-hidden style={crestFallback} />
          )}
        </div>
        <Link href="/" style={brandLink}>
          <span style={brandText}>{brand}</span>
        </Link>
      </div>

      <nav aria-label="Customer navigation" style={navWrap}>
        {nav.map((l) => {
          const active = isActive(l);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                ...navItem,
                ...(active ? navItemActive : {}),
              }}
              aria-current={active ? 'page' : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/* ===== styles ===== */

const colors = {
  panelBorder: 'rgba(255,255,255,.10)',
  brand: '#89c096',
  text: '#e6ebe8',
  textDim: 'rgba(230,235,232,.85)',
  activeBg: 'rgba(137,192,150,.15)',
} as const;

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 0',
  gap: 12,
};

const left: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
};

const crestWrap: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  overflow: 'hidden',
  background: colors.brand,
  flex: '0 0 auto',
  display: 'grid',
  placeItems: 'center',
};

const crestFallback: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: colors.brand,
  display: 'inline-block',
};

const brandLink: React.CSSProperties = {
  textDecoration: 'none',
  color: colors.text,
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
};

const brandText: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: '.02em',
  fontSize: 16,
  textTransform: 'uppercase',
  color: colors.text,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '60vw',
};

const navWrap: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const navItem: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: 10,
  textDecoration: 'none',
  color: colors.textDim,
  border: `1px solid ${colors.panelBorder}`,
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1,
};

const navItemActive: React.CSSProperties = {
  color: colors.text,
  background: colors.activeBg,
  borderColor: colors.brand,
};

