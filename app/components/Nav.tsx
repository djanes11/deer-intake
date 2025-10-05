'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Nav() {
  const pathname = usePathname();
  // Hide nav on board page like before
  if (pathname.startsWith('/board')) return null;

  // Mobile menu checkbox
  const mobileToggleRef = useRef<HTMLInputElement>(null);
  // Reports <details>
  const reportsRef = useRef<HTMLDetailsElement>(null);

  const closeAllMenus = useCallback(() => {
    const t = mobileToggleRef.current;
    if (t && t.checked) t.checked = false;
    const d = reportsRef.current;
    if (d && d.open) d.open = false;
  }, []);

  // Auto-close menus after navigation
  useEffect(() => {
    closeAllMenus();
  }, [pathname, closeAllMenus]);

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <img src="/mcafee-logo.png" alt="McAfee Custom Deer Processing" />
        </div>

        {/* Mobile toggle (CSS controls visibility) */}
        <label htmlFor="nav-check" className="menu-toggle" aria-label="Toggle menu">☰ Menu</label>
        <input id="nav-check" ref={mobileToggleRef} type="checkbox" aria-hidden="true" />

        <nav className="menu" aria-label="Primary">
          <Link href="/" className={`item ${isActive(pathname, '/') ? 'active' : ''}`} onClick={closeAllMenus}>Home</Link>
          <Link href="/intake" className={`item ${isActive(pathname, '/intake') ? 'active' : ''}`} onClick={closeAllMenus}>Intake form</Link>
          <Link href="/scan" className={`item ${isActive(pathname, '/scan') ? 'active' : ''}`} onClick={closeAllMenus}>Scan Tags</Link>
          <Link href="/search" className={`item ${isActive(pathname, '/search') ? 'active' : ''}`} onClick={closeAllMenus}>Search</Link>

          {/* Reports dropdown */}
          <details className="dd" ref={reportsRef}>
            <summary className="item">Reports</summary>
            <div className="dropdown-menu">
              <Link href="/reports/calls" onClick={closeAllMenus}>Call Report</Link>
              {/* add more report links here; they’ll also close the menu */}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

