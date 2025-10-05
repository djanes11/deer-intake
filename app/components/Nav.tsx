'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Brand stays hard-coded so it never disappears.
 * You can override both name and logo via env if you want.
 */
const BRAND = process.env.NEXT_PUBLIC_SITE_NAME || 'McAfee Custom Deer Processing';
const LOGO_SRC = process.env.NEXT_PUBLIC_LOGO_SRC || 'mcafee-logo.png'; // put your crest here (e.g., /mcafee-crest.svg)

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/" className="brand-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <img
              src={LOGO_SRC}
              alt="McAfee crest"
              width={28}
              height={28}
              style={{ display: 'block', borderRadius: 6 }}
            />
            <span aria-label="Site name">{BRAND}</span>
          </Link>
        </div>

        {/* Mobile menu toggle (CSS-only; see globals.css) */}
        <input id="nav-check" type="checkbox" aria-label="Toggle navigation menu" />
        <label htmlFor="nav-check" className="menu-toggle">Menu</label>

        <nav className="menu" aria-label="Primary">
          <Link className={`item ${isActive('/intake') ? 'active' : ''}`} href="/intake">Intake</Link>
          <Link className={`item ${isActive('/scan') ? 'active' : ''}`} href="/scan">Scan</Link>
          <Link className={`item ${isActive('/search') ? 'active' : ''}`} href="/search">Search</Link>

          <details className="dd">
            <summary>Reports</summary>
            <div className="dropdown-menu" role="menu">
              <Link href="/reports/calls">Call Report</Link>
              {/* Add more report links here if needed */}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
