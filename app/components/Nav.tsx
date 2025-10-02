'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Nav() {
  const pathname = usePathname();
  // Hide nav on board page like before
  if (pathname.startsWith('/board')) return null;

  // Auto-close the mobile menu after navigation
  const mobileToggleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = mobileToggleRef.current;
    if (t && t.checked) t.checked = false;
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <img src="/mcafee-logo.png" alt="McAfee Custom Deer Processing" />
          <Link href="/">McAfee Deer Processing</Link>
        </div>

        {/* Mobile toggle (CSS controls visibility) */}
        <label htmlFor="nav-check" className="menu-toggle" aria-label="Toggle menu">☰ Menu</label>
        <input id="nav-check" ref={mobileToggleRef} type="checkbox" aria-hidden="true" />

        <nav className="menu" aria-label="Primary">
          <Link href="/" className={`item ${isActive(pathname, '/') ? 'active' : ''}`}>Home</Link>
          <Link href="/intake" className={`item ${isActive(pathname, '/intake') ? 'active' : ''}`}>Intake form</Link>
          <Link href="/scan" className={`item ${isActive(pathname, '/scan') ? 'active' : ''}`}>Scan Tags</Link>
          <Link href="/search" className={`item ${isActive(pathname, '/search') ? 'active' : ''}`}>Search</Link>
          <Link href="/board" className={`item ${isActive(pathname, '/board') ? 'active' : ''}`}>Board</Link>

          {/* Reports dropdown: <details> works on mobile tap and desktop hover */}
          <details className="dd">
            <summary className="item">Reports</summary>
            <div className="dropdown-menu">
              <Link href="/reports/calls">Call Report</Link>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

