// app/components/CustomerHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
  { href: '/', label: 'Home', exact: true },
  { href: '/status', label: 'Check Status' },
  { href: '/overnight', label: 'Overnight Drop' },
  { href: '/faq-public', label: 'FAQ' },
  { href: '/hours', label: 'Hours' },
  { href: '/contact', label: 'Contact' },
];

export default function CustomerHeader() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <header
      style={{
        borderBottom: '1px solid #1f2937',
        background: '#0b0f12',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Link href="/" aria-label="McAfee Home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {/* Crest image in the “green block” spot */}
          <div
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              borderRadius: 10,
              overflow: 'hidden',
              background: '#153624',
              border: '1px solid #2a5f47',
            }}
          >
            {/* Update src to your actual crest asset in /public if different */}
            <Image
              src="/mcafee-logo.png"
              alt="McAfee Crest"
              fill
              sizes="44px"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontWeight: 900, color: '#e6e7eb' }}>McAfee Custom Deer Processing</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Fort Branch, IN</div>
          </div>
        </Link>

        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
                border: '1px solid #1f2937',
                background: isActive(item) ? '#13202c' : 'transparent',
                color: isActive(item) ? '#e6e7eb' : '#c7ced6',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
