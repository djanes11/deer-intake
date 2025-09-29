'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Nav() {
  const pathname = usePathname();

  // Hide the header entirely on the Board page (clean TV view)
  if (pathname.startsWith('/board')) return null;

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <img src="/mcafee-logo.png" alt="McAfee Custom Deer Processing" />
          <Link href="/">McAfee Deer Processing</Link>
        </div>

        <nav className="menu" aria-label="Primary">
          <Link href="/" className={`item ${isActive(pathname, '/') ? 'active' : ''}`}>
            Home
          </Link>
          <Link href="/intake" className={`item ${isActive(pathname, '/intake') ? 'active' : ''}`}>
            New Intake form
          </Link>
          <Link href="/scan" className={`item ${isActive(pathname, '/scan') ? 'active' : ''}`}>
            Scan Tags
          </Link>
          <Link href="/search" className={`item ${isActive(pathname, '/search') ? 'active' : ''}`}>
            Search
          </Link>
          {/* NEW: Board link */}
          <Link href="/board" className={`item ${isActive(pathname, '/board') ? 'active' : ''}`}>
            Board
          </Link>
        </nav>
      </div>
    </header>
  );
}

