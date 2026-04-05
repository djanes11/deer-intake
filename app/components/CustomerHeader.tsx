// app/components/CustomerHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
  { href: '/', label: 'Home', exact: true },
  { href: '/status', label: 'Check Status' },
  { href: '/overnight', label: 'Public Intake' },
  { href: '/faq-public', label: 'FAQ' },
  { href: '/hours', label: 'Hours' },
  { href: '/contact', label: 'Contact' },
];

type Branding = {
  name?: string;
  locationLabel?: string;
  logoUrl?: string;
};

export default function CustomerHeader(props: { branding?: Branding }) {
  const pathname = usePathname();
  const branding = props.branding || {};

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <header
      style={{
        borderBottom: '1px solid rgba(200,138,61,.18)',
        background: 'linear-gradient(180deg, rgba(29,23,20,.98) 0%, rgba(19,15,13,.98) 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="public-header-shell">
        <Link href="/" aria-label={`${branding.name || 'Home'}`} className="brand-link">
          <div className="logo-wrap">
            <Image
              src={branding.logoUrl || '/wgbb-logo.png'}
              alt={`${branding.name || 'Processor'} logo`}
              fill
              sizes="44px"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="brand-copy">
            <div className="brand-title">{branding.name || 'Game Butcher Board'}</div>
            <div className="brand-sub">{branding.locationLabel || ''}</div>
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
          background: #231813;
          border: 1px solid rgba(200,138,61,.24);
          flex: 0 0 auto;
        }
        .brand-copy {
          line-height: 1;
          min-width: 0;
        }
        .brand-title {
          font-weight: 900;
          color: #f1e7cf;
          white-space: nowrap;
        }
        .brand-sub {
          font-size: 12px;
          color: #c4bbaf;
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
          border: 1px solid rgba(200,138,61,.14);
          background: transparent;
          color: #f1e7cf;
          white-space: nowrap;
          flex: 0 0 auto;
        }
        .public-header-link.active {
          background: rgba(139,90,43,.22);
          color: #fff8ee;
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
