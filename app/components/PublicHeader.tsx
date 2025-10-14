// components/PublicHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/status', label: 'Status' },
  { href: '/overnight', label: 'Overnight Drop' },
  { href: '/faq-public', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export default function PublicHeader() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(11,15,13,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}
      aria-label="Public navigation"
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* Crest + Brand */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* Replace the green block with your crest image */}
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image
              src="/mcafee-logo.png"            // put your crest file in /public/crest.png
              alt="McAfee Crest"
              width={36}
              height={36}
              priority
              style={{ borderRadius: 8, objectFit: 'cover' }}
            />
          </span>
          <span
            style={{
              fontWeight: 900,
              letterSpacing: '.02em',
              fontSize: 16,
              textTransform: 'uppercase',
              color: '#d4e7db',
            }}
          >
            McAfee Custom Deer Processing
          </span>
        </Link>

        {/* Primary nav */}
        <nav
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
          aria-label="Primary"
        >
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: active ? '#0b0f0d' : '#e6ebe8',
                  background: active ? '#89c096' : 'transparent',
                  border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,.08)',
                  fontWeight: 800,
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
