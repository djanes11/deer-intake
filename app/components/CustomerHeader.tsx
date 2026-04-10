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
        background: 'linear-gradient(180deg, rgba(28,22,19,.98) 0%, rgba(18,14,12,.98) 100%)',
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
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }
        .brand-link {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          text-decoration: none !important;
          color: inherit !important;
          padding: 6px 0;
          flex: 0 1 auto;
        }
        .logo-wrap {
          position: relative;
          width: 46px;
          height: 46px;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(200,138,61,.18);
          box-shadow: 0 10px 22px rgba(0,0,0,.18);
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
          text-decoration: none !important;
          font-size: 15px;
          letter-spacing: -.01em;
        }
        .brand-sub {
          font-size: 12px;
          color: #bfb3a3;
          margin-top: 5px;
          text-decoration: none !important;
        }
        .public-header-nav {
          margin-left: auto;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          min-width: 0;
          align-items: center;
        }
        .public-header-link {
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 800;
          text-decoration: none !important;
          border: 1px solid transparent;
          background: transparent;
          color: #e7dbc7;
          white-space: nowrap;
          flex: 0 0 auto;
          transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
        }
        .public-header-link:hover {
          background: rgba(200,138,61,.08);
          border-color: rgba(200,138,61,.18);
          color: #fff7ee;
          transform: translateY(-1px);
        }
        .public-header-link.active {
          background: linear-gradient(180deg, rgba(139,90,43,.28) 0%, rgba(110,67,28,.34) 100%);
          border-color: rgba(200,138,61,.24);
          color: #fff8ee;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        .brand-link:visited,
        .brand-link:hover,
        .brand-link:active,
        .public-header-link:visited,
        .public-header-link:hover,
        .public-header-link:active {
          text-decoration: none !important;
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
