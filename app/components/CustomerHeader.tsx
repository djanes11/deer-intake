// app/components/CustomerHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <header
      className="public-site-header"
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
        <Link href="/" aria-label={`${branding.name || 'Home'}`} className="public-brand-link">
          <div className="public-logo-wrap">
            <Image
              src={branding.logoUrl || '/wgbb-logo.png'}
              alt={`${branding.name || 'Processor'} logo`}
              fill
              sizes="44px"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="public-brand-copy">
            <div className="public-brand-title">{branding.name || 'Game Butcher Board'}</div>
            <div className="public-brand-sub">{branding.locationLabel || ''}</div>
          </div>
        </Link>

        <nav className="public-header-nav public-header-nav-desktop" aria-label="Public">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`public-header-link ${isActive(item) ? 'active' : ''}`}
            >
              {item.href === '/status' ? (
                <>
                  <span className="public-link-long">Check Status</span>
                  <span className="public-link-short">Status</span>
                </>
              ) : (
                item.label
              )}
            </Link>
          ))}
        </nav>

        <div className={`public-header-menu ${menuOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="public-header-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            Menu
          </button>
          <nav id="public-mobile-nav" className="public-header-nav public-header-nav-mobile" aria-label="Public">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`public-header-link ${isActive(item) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.href === '/status' ? (
                  <>
                    <span className="public-link-long">Check Status</span>
                    <span className="public-link-short">Status</span>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
