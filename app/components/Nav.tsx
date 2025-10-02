'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Nav() {
  const pathname = usePathname();
  if (pathname.startsWith('/board')) return null;

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <img src="/mcafee-logo.png" alt="McAfee Custom Deer Processing" />
          <Link href="/">McAfee Deer Processing</Link>
        </div>

        <nav className="menu" aria-label="Primary">
          <Link href="/" className={`item ${isActive(pathname, '/') ? 'active' : ''}`}>Home</Link>
          <Link href="/intake" className={`item ${isActive(pathname, '/intake') ? 'active' : ''}`}>Intake form</Link>
          <Link href="/scan" className={`item ${isActive(pathname, '/scan') ? 'active' : ''}`}>Scan Tags</Link>
          <Link href="/search" className={`item ${isActive(pathname, '/search') ? 'active' : ''}`}>Search</Link>
          <Link href="/board" className={`item ${isActive(pathname, '/board') ? 'active' : ''}`}>Board</Link>

          <div className="dropdown">
            <button className={`item ${pathname.startsWith('/reports') ? 'active' : ''}`} aria-haspopup="true" aria-expanded="false">
              Reports
            </button>
            <div className="dropdown-menu" role="menu">
              <Link href="/reports/calls" className="item" role="menuitem">Call Report</Link>
              <Link href="/reports/recalls" className="item" role="menuitem">Recalls (Called, follow-up)</Link>
            </div>
          </div>
        </nav>
      </div>

      <style jsx>{`
        .site-header { border-bottom: 1px solid #e5e7eb; background: #fff; position: sticky; top:0; z-index:10; }
        .wrap { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 800; }
        .brand img { height: 28px; }
        .menu { display: flex; align-items: center; gap: 8px; position: relative; }
        .item { padding: 8px 10px; border-radius: 10px; color: #0b0f12; text-decoration: none; font-weight: 700; background: transparent; border: 0; cursor: pointer; }
        .item.active, .item:hover { background: #eef2ff; color: #1e40af; }

        .dropdown { position: relative; }
        .dropdown > .item::after { content: '▾'; margin-left: 6px; opacity: .8; }
        .dropdown-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          background: #fff; border: 1px solid #e6e9ec; border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,.12);
          padding: 6px; min-width: 260px; display: none;
        }
        .dropdown:hover .dropdown-menu,
        .dropdown:focus-within .dropdown-menu { display: block; }
        .dropdown-menu .item { display:block; border-radius: 8px; }
        .dropdown-menu .item:hover { background: #f2f5f7; }
      `}</style>
    </header>
  );
}




