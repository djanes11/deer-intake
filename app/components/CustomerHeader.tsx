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
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="public-header-shell">
        <Link href="/" aria-label="McAfee Home" className="brand-link">
          <div className="logo-wrap">
            <Image
              src="/mcafee-logo.png"
              alt="McAfee Crest"
              fill
              sizes="44px"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="brand-copy">
            <div className="brand-title">McAfee Custom Deer Processing</div>
            <div className="brand-sub">Palmyra, IN</div>
          </div>
        </Link>

        <nav className="public-header-nav" aria-label="Public">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`public-header-link ${isActive(item) ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <style jsx>{`
        .public-header-shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }
        .brand-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          text-decoration: none;
        }
        .logo-wrap {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          overflow: hidden;
          background: #153624;
          border: 1px solid #2a5f47;
          flex: 0 0 auto;
        }
        .brand-copy {
          line-height: 1;
          min-width: 0;
        }
        .brand-title {
          font-weight: 900;
          color: #e6e7eb;
          white-space: nowrap;
        }
        .brand-sub {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .public-header-nav {
          margin-left: auto;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .public-header-link {
          padding: 9px 12px;
          border-radius: 10px;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid #1f2937;
          background: transparent;
          color: #c7ced6;
          white-space: nowrap;
          flex: 0 0 auto;
        }
        .public-header-link.active {
          background: #13202c;
          color: #e6e7eb;
        }
        @media (max-width: 720px) {
          .public-header-shell {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 10px 12px;
          }
          .brand-title {
            white-space: normal;
            line-height: 1.15;
          }
          .public-header-nav {
            margin-left: 0;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }
          .public-header-nav::-webkit-scrollbar {
            display: none;
          }
          .public-header-link {
            padding: 10px 12px;
          }
        }
      `}</style>
    </header>
  );
}
